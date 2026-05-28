import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";
import {
  getCampaignById,
  getCampaignChildren,
  resolveDateRange,
  type AdObject,
} from "@/lib/utimify";
import { DateFilter } from "../date-filter";
import { AdsTabs } from "../tabs";
import { SortableHeader, compareValues } from "../sortable-header";

export const dynamic = "force-dynamic";

// Drilldown: clica numa campanha em /crm/ads → abre aqui detalhe + adsets + ads.

type LeadAgg = {
  total: number;
  pronta: number;
  esperancosa: number;
  cetica: number;
  won: number;
};

export default async function CampaignDrilldownPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    level?: string;
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

  const { campaignId } = await params;
  const sp = await searchParams;
  const { range, mode, days, from, to } = resolveDateRange({
    range: sp.range ?? "7", // default 7d no drilldown
    from: sp.from,
    to: sp.to,
  });
  const levelParam = sp.level === "adset" ? "adset" : "ad";

  // Utimify: campanha + adsets/ads
  let campaign: AdObject | null = null;
  let children: AdObject[] = [];
  let utimifyError: string | null = null;
  try {
    [campaign, children] = await Promise.all([
      getCampaignById(campaignId, range),
      getCampaignChildren(campaignId, range, levelParam),
    ]);
  } catch (e) {
    utimifyError = e instanceof Error ? e.message : "erro";
  }

  // Supabase: leads dessa campanha no período (match por campaignId no | do utm_campaign)
  const admin = createServiceClient();
  const { data: leadsRaw } = await admin
    .from("leads")
    .select("utm_campaign, utm_content, archetype, status")
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .like("utm_campaign", `%|${campaignId}`)
    .limit(5000);

  const leads = leadsRaw ?? [];
  const totalLeads: LeadAgg = {
    total: leads.length,
    pronta: leads.filter((l) => l.archetype === "PRONTA").length,
    esperancosa: leads.filter((l) => l.archetype === "ESPERANCOSA").length,
    cetica: leads.filter((l) => l.archetype === "CETICA").length,
    won: leads.filter((l) => l.status === "won").length,
  };

  // Agrupa leads por utm_content (= ad name ou ad id) — pra drilldown por ad
  // utm_content vem tipo "SAK-ZAP-S1-MAI-AD2-sorriso-sem-desgaste|120246..."
  const leadsByContentId = new Map<string, LeadAgg>();
  const leadsByContentName = new Map<string, LeadAgg>();
  for (const l of leads) {
    const raw = (l.utm_content as string | null) ?? "";
    const [name, id] = raw.split("|").map((s) => s.trim());
    const target = id ? [leadsByContentId, id] : name ? [leadsByContentName, name] : null;
    if (!target) continue;
    const [map, key] = target as [Map<string, LeadAgg>, string];
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

  type Row = AdObject & {
    leads_supa: LeadAgg;
    cpl_real_cents: number | null;
    cpl_pronta_cents: number | null;
    cpl_esp_cents: number | null;
    cpa_won_cents: number | null;
    quente_pct: number;
  };
  const rows: Row[] = children.map((c) => {
    let supa: LeadAgg = {
      total: 0,
      pronta: 0,
      esperancosa: 0,
      cetica: 0,
      won: 0,
    };
    if (levelParam === "ad") {
      const byId = c.adId ? leadsByContentId.get(c.adId) : null;
      const byName = leadsByContentName.get(c.name);
      supa = byId ?? byName ?? supa;
    } else {
      // adsets — não tem utm_content por adset facilmente. Deixar 0 nessa coluna.
      // (Pode evoluir cruzando pela campanha + somando children futuramente.)
    }
    return {
      ...c,
      leads_supa: supa,
      cpl_real_cents:
        supa.total > 0 ? Math.round(c.spend / supa.total) : null,
      cpl_pronta_cents:
        supa.pronta > 0 ? Math.round(c.spend / supa.pronta) : null,
      cpl_esp_cents:
        supa.esperancosa > 0 ? Math.round(c.spend / supa.esperancosa) : null,
      cpa_won_cents:
        supa.won > 0 ? Math.round(c.spend / supa.won) : null,
      quente_pct:
        supa.total > 0
          ? Math.round(((supa.pronta + supa.esperancosa) / supa.total) * 100)
          : 0,
    };
  });

  const sortKey = sp.sort ?? "spend";
  const sortDir: "asc" | "desc" = sp.dir === "asc" ? "asc" : "desc";
  function valFor(r: Row): number | string | null {
    switch (sortKey) {
      case "name": return r.name;
      case "status": return r.effectiveStatus;
      case "clicks": return r.inlineLinkClicks;
      case "leads": return r.leads_supa.total;
      case "cpl": return r.cpl_real_cents;
      case "cpl_pronta": return r.cpl_pronta_cents;
      case "cpl_esp": return r.cpl_esp_cents;
      case "cpa": return r.cpa_won_cents;
      case "pronta": return r.leads_supa.pronta;
      case "esp": return r.leads_supa.esperancosa;
      case "cetica": return r.leads_supa.cetica;
      case "won": return r.leads_supa.won;
      default: return r.spend;
    }
  }
  rows.sort((a, b) => {
    if (a.effectiveStatus !== b.effectiveStatus) {
      if (a.effectiveStatus === "ACTIVE") return -1;
      if (b.effectiveStatus === "ACTIVE") return 1;
    }
    return compareValues(valFor(a), valFor(b), sortDir);
  });

  const fmtR = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const qsBase = (() => {
    const parts: string[] = [];
    if (mode === "custom" && from) {
      parts.push(`from=${from}`);
      parts.push(`to=${to ?? from}`);
    } else {
      parts.push(`range=${days}`);
    }
    return parts.join("&");
  })();

  return (
    <CrmShell active="funnel" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <AdsTabs
          active="drilldown"
          campaignName={campaign?.name}
          campaignId={campaignId}
          qs={qsBase}
        />
        <header className="mb-5">
          <h1 className="text-xl font-semibold text-slate-900 mt-1">
            📋 {campaign?.name ?? `Campanha ${campaignId.slice(0, 12)}`}
          </h1>
          <DateFilter mode={mode} days={days} from={from} to={to} />
          <div className="mt-2 flex gap-2 flex-wrap items-center">
            <span className="text-[11px] text-slate-500">Nível:</span>
            {(["adset", "ad"] as const).map((lv) => (
              <Link
                key={lv}
                href={`/crm/ads/${campaignId}?range=${days}&level=${lv}`}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                  levelParam === lv
                    ? "bg-rose-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {lv === "adset" ? "Adsets" : "Ads"}
              </Link>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            {range.from.slice(0, 10)} → {range.to.slice(0, 10)} · campaignId={" "}
            {campaignId}
          </p>
        </header>

        {utimifyError && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 mb-4">
            <p className="text-xs font-semibold text-red-900">Utimify falhou</p>
            <p className="text-[11px] text-red-800 mt-1 font-mono">
              {utimifyError}
            </p>
          </div>
        )}

        {/* Resumo da campanha + leads totais Supabase */}
        {campaign && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <Stat
              label="Spend"
              value={fmtR(campaign.spend)}
              fg="text-rose-700"
            />
            <Stat
              label="Leads Supabase"
              value={totalLeads.total.toString()}
              sub={`Meta CAPI: ${campaign.leads}`}
              fg="text-emerald-700"
            />
            <Stat
              label="CPL real"
              value={
                totalLeads.total > 0
                  ? fmtR(Math.round(campaign.spend / totalLeads.total))
                  : "—"
              }
              fg="text-amber-700"
            />
            <Stat
              label="CPL 🔥 PRONTA"
              value={
                totalLeads.pronta > 0
                  ? fmtR(Math.round(campaign.spend / totalLeads.pronta))
                  : "—"
              }
              sub={`${totalLeads.pronta} PRO`}
              fg="text-emerald-800"
            />
            <Stat
              label="CPA 💰 Won"
              value={
                totalLeads.won > 0
                  ? fmtR(Math.round(campaign.spend / totalLeads.won))
                  : "—"
              }
              sub={`${totalLeads.won} won`}
              fg="text-purple-700"
            />
          </div>
        )}

        {/* Tabela adsets/ads */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">
                    <SortableHeader
                      id="name"
                      label={levelParam === "adset" ? "Adset" : "Ad"}
                      defaultDir="asc"
                    />
                  </th>
                  <th className="px-2 py-2 font-semibold">
                    <SortableHeader id="status" label="Status" defaultDir="asc" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="spend" label="Spend" align="right" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="clicks" label="Cliques" align="right" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="leads" label="Leads" align="right" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="cpl" label="CPL" align="right" defaultDir="asc" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-emerald-700">
                    <SortableHeader id="cpl_pronta" label="CPL 🔥" align="right" defaultDir="asc" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-amber-700">
                    <SortableHeader id="cpl_esp" label="CPL 🟡" align="right" defaultDir="asc" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-purple-700">
                    <SortableHeader id="cpa" label="CPA 💰" align="right" defaultDir="asc" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="pronta" label="PRO" align="right" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="esp" label="ESP" align="right" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="cetica" label="CET" align="right" />
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">
                    <SortableHeader id="won" label="Won" align="right" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isWarning =
                    r.effectiveStatus === "ACTIVE" &&
                    r.spend > 20000 &&
                    r.leads_supa.won === 0 &&
                    days >= 3;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-slate-100 ${
                        isWarning ? "bg-red-50" : ""
                      } ${r.effectiveStatus !== "ACTIVE" ? "opacity-50" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {isWarning && <span>⚠️ </span>}
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
                      <td className="px-2 py-2 text-right tabular-nums">
                        {fmtR(r.spend)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {r.inlineLinkClicks}
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
            Nenhum {levelParam} encontrado nessa campanha no período.
          </p>
        )}

        <div className="mt-4 text-[10px] text-slate-400 leading-relaxed">
          <p>
            <strong>Adsets:</strong> match com Supabase ainda não disponível
            (UTM do lead não carrega adsetId). Use o nível <em>Ads</em> pra ver
            performance por criativo.
          </p>
        </div>
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
