import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import {
  getSakCampaigns,
  getPrincipalSummary,
  dateRangeForDays,
  type AdObject,
} from "@/lib/utimify";

export const dynamic = "force-dynamic";

// Admin-only: cruza performance Meta Ads (Utimify MCP) com leads reais do
// Supabase. Filtro: campanhas SAK no dashboard Principal.

type LeadAgg = {
  total: number;
  pronta: number;
  esperancosa: number;
  cetica: number;
  won: number;
  contacted: number;
};

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
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
  const daysParam = Number(sp.range ?? 1);
  const days = [1, 3, 7, 14, 30].includes(daysParam) ? daysParam : 1;
  const range = dateRangeForDays(days);

  // 1. Utimify: campanhas SAK no Principal
  let campaigns: AdObject[] = [];
  let summary = null;
  let utimifyError: string | null = null;
  try {
    [campaigns, summary] = await Promise.all([
      getSakCampaigns(range),
      getPrincipalSummary(range),
    ]);
  } catch (e) {
    utimifyError = e instanceof Error ? e.message : "erro";
  }

  // 2. Supabase: leads no mesmo range agrupados por utm_campaign
  const admin = createServiceClient();
  const { data: leadsRaw } = await admin
    .from("leads")
    .select("utm_campaign, archetype, status")
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .not("utm_campaign", "is", null)
    .limit(5000);

  // utm_campaign vem como "SAK-QUIZZ1-RESINA-EE50-...|120246837027350304"
  // onde a parte depois do `|` é o campaignId real do Meta.
  // Match por ID > match por nome (Meta pode renomear sem mudar o ID).
  // Fallback pra nome quando UTM legado não tem `|`.
  const leadsByCampaignId = new Map<string, LeadAgg>();
  const leadsByName = new Map<string, LeadAgg>();
  function bumpAgg(map: Map<string, LeadAgg>, key: string, l: { archetype: string | null; status: string | null }) {
    const agg = map.get(key) ?? {
      total: 0,
      pronta: 0,
      esperancosa: 0,
      cetica: 0,
      won: 0,
      contacted: 0,
    };
    agg.total += 1;
    if (l.archetype === "PRONTA") agg.pronta += 1;
    else if (l.archetype === "ESPERANCOSA") agg.esperancosa += 1;
    else if (l.archetype === "CETICA") agg.cetica += 1;
    if (l.status === "won") agg.won += 1;
    if (
      l.status &&
      ["contacted", "qualified", "proposal", "won"].includes(l.status)
    )
      agg.contacted += 1;
    map.set(key, agg);
  }
  for (const l of leadsRaw ?? []) {
    const raw = (l.utm_campaign as string | null) ?? "";
    const [name, id] = raw.split("|").map((s) => s.trim());
    if (id) bumpAgg(leadsByCampaignId, id, l as { archetype: string | null; status: string | null });
    else if (name) bumpAgg(leadsByName, name, l as { archetype: string | null; status: string | null });
  }
  // Helper: tenta primeiro por id, depois nome (case-insensitive)
  function getLeadsFor(c: AdObject): LeadAgg {
    const empty: LeadAgg = {
      total: 0, pronta: 0, esperancosa: 0, cetica: 0, won: 0, contacted: 0,
    };
    const byId = c.campaignId ? leadsByCampaignId.get(c.campaignId) : null;
    if (byId) return byId;
    const byName = leadsByName.get(c.name);
    if (byName) return byName;
    return empty;
  }

  // 3. Cruza: pra cada campanha do Utimify, busca leads no Supabase
  type Row = AdObject & {
    leads_supabase: LeadAgg;
    cpl_real_cents: number | null; // spend / total leads
    cpl_pronta_cents: number | null; // spend / PRONTA (lead "quente puro")
    cpl_esperancosa_cents: number | null; // spend / ESPERANCOSA
    cpa_won_cents: number | null; // spend / Won (custo por venda)
    quente_pct: number;
  };
  const rows: Row[] = campaigns.map((c) => {
    const supa = getLeadsFor(c);
    const cpl_real_cents =
      supa.total > 0 ? Math.round(c.spend / supa.total) : null;
    const cpl_pronta_cents =
      supa.pronta > 0 ? Math.round(c.spend / supa.pronta) : null;
    const cpl_esperancosa_cents =
      supa.esperancosa > 0 ? Math.round(c.spend / supa.esperancosa) : null;
    const cpa_won_cents = supa.won > 0 ? Math.round(c.spend / supa.won) : null;
    const quente = supa.total > 0
      ? Math.round(((supa.pronta + supa.esperancosa) / supa.total) * 100)
      : 0;
    return {
      ...c,
      leads_supabase: supa,
      cpl_real_cents,
      cpl_pronta_cents,
      cpl_esperancosa_cents,
      cpa_won_cents,
      quente_pct: quente,
    };
  });

  // Ordena: ACTIVE primeiro, depois por spend desc
  rows.sort((a, b) => {
    if (a.effectiveStatus !== b.effectiveStatus) {
      if (a.effectiveStatus === "ACTIVE") return -1;
      if (b.effectiveStatus === "ACTIVE") return 1;
    }
    return b.spend - a.spend;
  });

  // Totais
  const totals = rows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.impressions += r.impressions;
      acc.clicks += r.inlineLinkClicks;
      acc.leads_meta += r.leads;
      acc.leads_supa += r.leads_supabase.total;
      acc.pronta += r.leads_supabase.pronta;
      acc.esperancosa += r.leads_supabase.esperancosa;
      acc.cetica += r.leads_supabase.cetica;
      acc.won += r.leads_supabase.won;
      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads_meta: 0,
      leads_supa: 0,
      pronta: 0,
      esperancosa: 0,
      cetica: 0,
      won: 0,
    },
  );

  const totalCplReal =
    totals.leads_supa > 0 ? totals.spend / totals.leads_supa : 0;
  const totalCplPronta =
    totals.pronta > 0 ? totals.spend / totals.pronta : 0;
  const totalCplEsperancosa =
    totals.esperancosa > 0 ? totals.spend / totals.esperancosa : 0;
  const totalCpa = totals.won > 0 ? totals.spend / totals.won : 0;
  const totalQuentePct =
    totals.leads_supa > 0
      ? ((totals.pronta + totals.esperancosa) / totals.leads_supa) * 100
      : 0;

  const fmtR = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <CrmShell active="funnel" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <header className="mb-5">
          <Link
            href="/crm/funnel"
            className="text-xs text-slate-500 inline-flex items-center gap-1"
          >
            ← Funil
          </Link>
          <div className="flex gap-3 items-center mt-2">
            <Link
              href={`/crm/ads?range=${days}`}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white"
            >
              📊 Campanhas
            </Link>
            <Link
              href={`/crm/ads/all?range=${days}`}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              🎯 Ads (todos)
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mt-3">
            📊 Ads · Sakura (SAK no dashboard Principal)
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Cruzamento Utimify (gasto/cliques Meta Ads) × Supabase (leads reais
            entrando). CPL real considera leads do Supabase, não apenas lead
            events do FB CAPI.
          </p>
          <div className="mt-3 flex gap-2">
            {[1, 3, 7, 14, 30].map((n) => (
              <Link
                key={n}
                href={`/crm/ads?range=${n}`}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                  days === n
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {n === 1 ? "Hoje" : `${n}d`}
              </Link>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            {range.from.slice(0, 10)} → {range.to.slice(0, 10)} · dashboard
            Principal · nameContains SAK
          </p>
        </header>

        {utimifyError && (
          <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 mb-4">
            <p className="text-xs font-semibold text-red-900">
              Utimify MCP falhou
            </p>
            <p className="text-[11px] text-red-800 mt-1 font-mono">
              {utimifyError}
            </p>
          </div>
        )}

        {/* Cards de totais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="Gasto Meta (SAK)" value={fmtR(totals.spend)} fg="text-rose-700" />
          <Stat
            label="Leads Supabase"
            value={totals.leads_supa.toString()}
            sub={`Meta CAPI: ${totals.leads_meta}`}
            fg="text-emerald-700"
          />
          <Stat
            label="CPL real"
            value={fmtR(Math.round(totalCplReal))}
            sub="gasto / leads Supabase"
            fg="text-amber-700"
          />
          <Stat
            label="% quente"
            value={`${totalQuentePct.toFixed(0)}%`}
            sub={`${totals.pronta + totals.esperancosa} de ${totals.leads_supa}`}
            fg="text-sky-700"
          />
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Campanha</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold text-right">Spend</th>
                  <th className="px-2 py-2 font-semibold text-right">Cliques</th>
                  <th className="px-2 py-2 font-semibold text-right">
                    Leads<br />
                    <span className="text-[9px] text-slate-400">(supa)</span>
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">CPL geral</th>
                  <th className="px-2 py-2 font-semibold text-right text-emerald-700">
                    CPL<br />
                    <span className="text-[9px]">🔥 quente</span>
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-amber-700">
                    CPL<br />
                    <span className="text-[9px]">🟡 esperançoso</span>
                  </th>
                  <th className="px-2 py-2 font-semibold text-right text-purple-700">
                    CPA<br />
                    <span className="text-[9px]">💰 Won</span>
                  </th>
                  <th className="px-2 py-2 font-semibold text-right">% quente</th>
                  <th className="px-2 py-2 font-semibold text-right">PRO</th>
                  <th className="px-2 py-2 font-semibold text-right">ESP</th>
                  <th className="px-2 py-2 font-semibold text-right">CET</th>
                  <th className="px-2 py-2 font-semibold text-right">Won</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // Warning: ACTIVE + gastou +R$200 + 0 wons + período >= 3 dias.
                  // Sinaliza "candidata a pausar". Período = days da URL.
                  const isWarning =
                    r.effectiveStatus === "ACTIVE" &&
                    r.spend > 20000 && // R$200 em centavos
                    r.leads_supabase.won === 0 &&
                    days >= 3;
                  const cid = r.campaignId ?? r.id;
                  return (
                  <tr
                    key={r.id}
                    className={`border-t border-slate-100 ${
                      isWarning ? "bg-red-50" : ""
                    } ${r.effectiveStatus !== "ACTIVE" ? "opacity-50" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <Link
                        href={`/crm/ads/${cid}?range=${days}&level=ad`}
                        className="hover:underline hover:text-rose-700"
                      >
                        {isWarning && (
                          <span title="Gastou +R$200 sem fechar, candidata a pausar">
                            ⚠️{" "}
                          </span>
                        )}
                        {r.name}
                      </Link>
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
                      {r.leads_supabase.total}
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
                      {r.cpl_esperancosa_cents !== null
                        ? fmtR(r.cpl_esperancosa_cents)
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
                      {r.leads_supabase.total > 0
                        ? `${r.quente_pct}%`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                      {r.leads_supabase.pronta || ""}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                      {r.leads_supabase.esperancosa || ""}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">
                      {r.leads_supabase.cetica || ""}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-800 font-bold">
                      {r.leads_supabase.won || ""}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold">
                  <tr className="border-t-2 border-slate-300">
                    <td className="px-3 py-2">Total ({rows.length})</td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtR(totals.spend)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totals.clicks}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totals.leads_supa}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {fmtR(Math.round(totalCplReal))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                      {totals.pronta > 0
                        ? fmtR(Math.round(totalCplPronta))
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                      {totals.esperancosa > 0
                        ? fmtR(Math.round(totalCplEsperancosa))
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-purple-700">
                      {totals.won > 0 ? fmtR(Math.round(totalCpa)) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totalQuentePct.toFixed(0)}%
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totals.pronta}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totals.esperancosa}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totals.cetica}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {totals.won}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {rows.length === 0 && !utimifyError && (
          <p className="text-center text-sm text-slate-400 mt-8">
            Nenhuma campanha SAK encontrada no período.
          </p>
        )}

        <div className="mt-6 text-[10px] text-slate-400 leading-relaxed">
          <p>
            <strong>Como ler:</strong> A coluna <em>Leads (supa)</em> é o número
            REAL de leads que entraram no CRM com esse utm_campaign no período.
            <em>CPL</em> é gasto Meta ÷ leads Supabase (CPL real, não o do
            Meta). <em>% quente</em> = (PRONTA + ESPERANCOSA) / total Supabase.
            Campanhas sem leads no Supabase aparecem com CPL "—" — significa que
            o ad rodou mas o tracking de utm_campaign não chegou no banco
            (provavelmente clique sem conversão pro quiz, ou wa.me sem UTM).
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
      <p className={`text-2xl font-bold mt-1 ${fg} tabular-nums`}>{value}</p>
      {sub && (
        <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
      )}
    </div>
  );
}
