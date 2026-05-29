import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";
import {
  getSakAds,
  getSakCampaigns,
  resolveDateRange,
  type AdObject,
} from "@/lib/utimify";
import { DateFilter } from "../date-filter";
import { AdsTabs } from "../tabs";
import { SortableHeader, compareValues } from "../sortable-header";

export const dynamic = "force-dynamic";

// Visão global de TODOS os ads SAK ranqueados (sem precisar entrar campanha
// por campanha). Match Supabase via utm_content → adId.

type LeadAgg = {
  total: number;
  pronta: number;
  esperancosa: number;
  cetica: number;
  won: number;
};

export default async function AdsAllPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (crmUser?.role !== "admin") redirect("/crm");

  const sp = await searchParams;
  const { range, mode, days, from, to } = resolveDateRange(sp);
  const sortKey = sp.sort ?? "spend";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";

  // Utimify
  let ads: AdObject[] = [];
  let campaigns: AdObject[] = [];
  let utimifyError: string | null = null;
  try {
    [ads, campaigns] = await Promise.all([
      getSakAds(range),
      getSakCampaigns(range),
    ]);
  } catch (e) {
    utimifyError = e instanceof Error ? e.message : "erro";
  }

  // Mapa campaignId → name pra exibir contexto
  const campaignNameById = new Map(
    campaigns.map((c) => [c.campaignId ?? c.id, c.name]),
  );

  // Supabase: leads SAK no período. Match por utm_content (adId).
  const admin = createServiceClient();
  const { data: leadsRaw } = await admin
    .from("leads")
    .select("utm_content, archetype, status")
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .not("utm_content", "is", null)
    .limit(10000);

  const leadsByAdId = new Map<string, LeadAgg>();
  const leadsByAdName = new Map<string, LeadAgg>();
  function bump(map: Map<string, LeadAgg>, key: string, l: { archetype: string | null; status: string | null }) {
    const agg = map.get(key) ?? {
      total: 0,
      pronta: 0,
      esperancosa: 0,
      cetica: 0,
      won: 0,
    };
    agg.total += 1;
    if (l.archetype === "PRONTA") agg.pronta += 1;
    else if (l.archetype === "ESPERANCOSA") agg.esperancosa += 1;
    else if (l.archetype === "CETICA") agg.cetica += 1;
    if (l.status === "won") agg.won += 1;
    map.set(key, agg);
  }
  for (const l of leadsRaw ?? []) {
    const raw = (l.utm_content as string | null) ?? "";
    const [name, id] = raw.split("|").map((s) => s.trim());
    if (id) bump(leadsByAdId, id, l as { archetype: string | null; status: string | null });
    else if (name) bump(leadsByAdName, name, l as { archetype: string | null; status: string | null });
  }

  type Row = AdObject & {
    leads_supa: LeadAgg;
    cpl_real_cents: number | null;
    cpl_pronta_cents: number | null;
    cpl_esp_cents: number | null;
    cpa_won_cents: number | null;
    quente_pct: number;
    campaign_name: string;
  };
  const rows: Row[] = ads.map((c) => {
    const empty: LeadAgg = {
      total: 0,
      pronta: 0,
      esperancosa: 0,
      cetica: 0,
      won: 0,
    };
    const byId = c.adId ? leadsByAdId.get(c.adId) : null;
    const byName = leadsByAdName.get(c.name);
    const supa = byId ?? byName ?? empty;
    return {
      ...c,
      leads_supa: supa,
      cpl_real_cents: supa.total > 0 ? Math.round(c.spend / supa.total) : null,
      cpl_pronta_cents:
        supa.pronta > 0 ? Math.round(c.spend / supa.pronta) : null,
      cpl_esp_cents:
        supa.esperancosa > 0 ? Math.round(c.spend / supa.esperancosa) : null,
      cpa_won_cents: supa.won > 0 ? Math.round(c.spend / supa.won) : null,
      quente_pct:
        supa.total > 0
          ? Math.round(((supa.pronta + supa.esperancosa) / supa.total) * 100)
          : 0,
      campaign_name: c.campaignId
        ? (campaignNameById.get(c.campaignId) ?? "—")
        : "—",
    };
  });

  function valFor(r: Row): number | string | null {
    switch (sortKey) {
      case "name": return r.name;
      case "status": return r.effectiveStatus;
      case "campaign": return r.campaign_name;
      case "leads": return r.leads_supa.total;
      case "cpl": return r.cpl_real_cents;
      case "cpl_pronta": return r.cpl_pronta_cents;
      case "cpl_esp": return r.cpl_esp_cents;
      case "cpa": return r.cpa_won_cents;
      case "quente": return r.quente_pct;
      case "pronta": return r.leads_supa.pronta;
      case "esp": return r.leads_supa.esperancosa;
      case "cetica": return r.leads_supa.cetica;
      case "won": return r.leads_supa.won;
      default: return r.spend;
    }
  }
  // QS base sem sort/dir
  const sortBaseQs = (() => {
    const p = new URLSearchParams();
    if (mode === "custom" && from) { p.set("from", from); p.set("to", to ?? from); }
    else { p.set("range", String(days)); }
    return p.toString();
  })();
  rows.sort((a, b) => {
    if (a.effectiveStatus !== b.effectiveStatus) {
      if (a.effectiveStatus === "ACTIVE") return -1;
      if (b.effectiveStatus === "ACTIVE") return 1;
    }
    return compareValues(valFor(a), valFor(b), sortDir);
  });

  // Totais
  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.clicks += r.inlineLinkClicks;
      acc.leads += r.leads_supa.total;
      acc.pronta += r.leads_supa.pronta;
      acc.esperancosa += r.leads_supa.esperancosa;
      acc.cetica += r.leads_supa.cetica;
      acc.won += r.leads_supa.won;
      return acc;
    },
    {
      spend: 0,
      clicks: 0,
      leads: 0,
      pronta: 0,
      esperancosa: 0,
      cetica: 0,
      won: 0,
    },
  );
  const totalCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const totalCplPro = totals.pronta > 0 ? totals.spend / totals.pronta : 0;
  const totalCplEsp =
    totals.esperancosa > 0 ? totals.spend / totals.esperancosa : 0;
  const totalCpa = totals.won > 0 ? totals.spend / totals.won : 0;

  const fmtR = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Querystring base pra preservar período (+sort) entre abas
  const qsBase = (() => {
    const parts: string[] = [];
    if (mode === "custom" && from) {
      parts.push(`from=${from}`);
      parts.push(`to=${to ?? from}`);
    } else {
      parts.push(`range=${days}`);
    }
    if (sortKey !== "spend") parts.push(`sort=${sortKey}`);
    if (sortDir !== "desc") parts.push(`dir=${sortDir}`);
    return parts.join("&");
  })();

  return (
    <CrmShell active="funnel" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <AdsTabs active="ads" qs={qsBase} />
        <header className="mb-5">
          <h1 className="text-xl font-semibold text-slate-900 mt-1">
            🎯 Ads SAK · ranqueados por performance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Todos os ads do prefixo SAK no dashboard Principal, sem precisar
            entrar campanha por campanha.
          </p>
          <DateFilter mode={mode} days={days} from={from} to={to} />
          <p className="text-[10px] text-slate-400 mt-2 italic">
            💡 Clica nos títulos das colunas pra ordenar (▲▼).
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            {range.from.slice(0, 10)} → {range.to.slice(0, 10)} · ads
            encontrados: {rows.length}
          </p>
        </header>

        {utimifyError && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 mb-4">
            <p className="text-xs font-semibold text-red-900">
              Utimify falhou
            </p>
            <p className="text-[11px] text-red-800 mt-1 font-mono">
              {utimifyError}
            </p>
          </div>
        )}

        {/* Stats agregados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="Spend total" value={fmtR(totals.spend)} fg="text-rose-700" />
          <Stat
            label="Leads Supa"
            value={totals.leads.toString()}
            sub={`${totals.pronta} PRO · ${totals.esperancosa} ESP · ${totals.cetica} CET`}
            fg="text-emerald-700"
          />
          <Stat
            label="CPL 🔥 PRONTA"
            value={totals.pronta > 0 ? fmtR(Math.round(totalCplPro)) : "—"}
            sub={`CPL geral: ${totals.leads > 0 ? fmtR(Math.round(totalCpl)) : "—"}`}
            fg="text-emerald-800"
          />
          <Stat
            label="CPA 💰 Won"
            value={totals.won > 0 ? fmtR(Math.round(totalCpa)) : "—"}
            sub={`${totals.won} wons`}
            fg="text-purple-700"
          />
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">
                    <SortableHeader id="name" label="Ad" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <SortableHeader id="status" label="Status" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <SortableHeader id="campaign" label="Campanha" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="spend" label="Spend" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="leads" label="Leads" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="cpl" label="CPL" align="right" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-emerald-700">
                    <SortableHeader id="cpl_pronta" label="CPL 🔥" align="right" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-amber-700">
                    <SortableHeader id="cpl_esp" label="CPL 🟡" align="right" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-purple-700">
                    <SortableHeader id="cpa" label="CPA 💰" align="right" defaultDir="asc" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="quente" label="% qte" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="pronta" label="PRO" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="esp" label="ESP" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="cetica" label="CET" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="won" label="Won" align="right" currentSort={sortKey} currentDir={sortDir} pathname="/crm/ads/all" baseQs={sortBaseQs} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isWarning =
                    r.effectiveStatus === "ACTIVE" &&
                    r.spend > 10000 && // R$100 (limite menor pra ad individual)
                    r.leads_supa.won === 0 &&
                    days >= 3;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 ${
                        isWarning ? "bg-red-50" : ""
                      } ${r.effectiveStatus !== "ACTIVE" ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900 max-w-[280px] truncate">
                        {isWarning && <span title="Spend +R$100 sem Won">⚠️ </span>}
                        {r.name}
                      </td>
                      <td className="px-2 py-2 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            r.effectiveStatus === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {r.effectiveStatus}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-slate-500 max-w-[200px] truncate">
                        {r.campaignId ? (
                          <Link
                            href={`/crm/ads/${r.campaignId}?range=${days}&level=ad`}
                            className="hover:underline hover:text-rose-700"
                          >
                            {r.campaign_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {fmtR(r.spend)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">
                        {r.leads_supa.total}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {r.cpl_real_cents !== null
                          ? fmtR(r.cpl_real_cents)
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-700 font-semibold">
                        {r.cpl_pronta_cents !== null
                          ? fmtR(r.cpl_pronta_cents)
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-amber-700 font-semibold">
                        {r.cpl_esp_cents !== null
                          ? fmtR(r.cpl_esp_cents)
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-purple-700 font-bold">
                        {r.cpa_won_cents !== null
                          ? fmtR(r.cpa_won_cents)
                          : "—"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right tabular-nums font-semibold ${
                          r.quente_pct >= 30
                            ? "text-emerald-700"
                            : r.quente_pct >= 15
                              ? "text-amber-700"
                              : r.quente_pct > 0
                                ? "text-slate-500"
                                : "text-slate-400"
                        }`}
                      >
                        {r.leads_supa.total > 0 ? `${r.quente_pct}%` : "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                        {r.leads_supa.pronta || ""}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                        {r.leads_supa.esperancosa || ""}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-500">
                        {r.leads_supa.cetica || ""}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-800 font-bold">
                        {r.leads_supa.won || ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {rows.length === 0 && !utimifyError && (
          <p className="text-center text-sm text-slate-400 mt-8">
            Nenhum ad SAK encontrado no período.
          </p>
        )}
      </div>
    </CrmShell>
  );
}

function Stat({
  label,
  value,
  sub,
  fg,
}: {
  label: string;
  value: string;
  sub?: string;
  fg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
        {label}
      </p>
      <p className={`text-xl font-bold mt-1 ${fg} tabular-nums`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
