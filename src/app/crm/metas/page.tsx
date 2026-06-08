import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { PeriodFilter } from "./period-filter";

export const dynamic = "force-dynamic";

// Painel ÚNICO de metas comerciais (admin-only). Coorte por DATA DE CRIAÇÃO do
// lead. Filtro de período no topo (hoje/ontem/7d/este mês/mês passado/custom)
// dirige toda a tela: barras de progresso (lead → agendamento → comparecimento
// → conversão) + placar por atendente com SLA e backlog. A meta escala pelo nº
// de dias do período; períodos em curso mostram a linha de ritmo.
//
// Metas oficiais (AJUSTES-E-DECISOES, decisões Wanderson · iguais ao /crm/funnel):
// lead→agendado 11% · agendado→comparecido 70% · comparecido→fechado 20%.
// Volume-base: ~90 leads/dia · 30 dias/mês. Amarelo = 60% da meta/ritmo.

const META_AGEND = 11;
const META_COMPAREC = 70;
const META_CONV = 20;

const LEADS_DIA = 90;
const R_AGEND = 0.11;
const R_COMP = 0.7;
const R_CONV = 0.2;

const META_DIA = {
  lead: LEADS_DIA,
  agend: LEADS_DIA * R_AGEND, // 9,9
  comp: LEADS_DIA * R_AGEND * R_COMP, // 6,93
  conv: LEADS_DIA * R_AGEND * R_COMP * R_CONV, // 1,386
};
// Meia-noite SP do dia-calendário de `date` (Vercel roda UTC; BRT = UTC-3 fixo).
function spDayStart(date: Date): Date {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = p.find((x) => x.type === "year")!.value;
  const m = p.find((x) => x.type === "month")!.value;
  const d = p.find((x) => x.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
}

// Primeiro dia do mês SP + nº de dias do mês.
function spMonth(date: Date): { start: Date; days: number } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const y = Number(p.find((x) => x.type === "year")!.value);
  const m = Number(p.find((x) => x.type === "month")!.value);
  const start = new Date(`${y}-${String(m).padStart(2, "0")}-01T00:00:00-03:00`);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, days };
}

const DAY_MS = 86400000;
const isYmd = (s?: string): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

type ResolvedPeriod = {
  period: string;
  label: string;
  startISO: string;
  endISO: string; // exclusivo, capado em now
  totalDays: number; // dias-calendário do período (escala a meta)
  ongoing: boolean; // período ainda em curso → mostra linha de ritmo
  paceFrac: number; // fração decorrida do período (1 se fechado)
  from?: string;
  to?: string;
};

// Traduz o filtro do topo num intervalo [start, end) em horário de SP.
// BRT é UTC-3 fixo (sem DST desde 2019), então somar/subtrair DAY_MS de uma
// meia-noite SP continua caindo em meia-noite SP.
function resolvePeriod(
  sp: { period?: string; from?: string; to?: string },
  now: Date,
): ResolvedPeriod {
  const todayStart = spDayStart(now);
  const { start: monthStart, days: daysInMonth } = spMonth(now);
  const period = sp.period ?? "hoje";

  let start: Date;
  let endExcl: Date;
  let label: string;

  if (period === "custom" && isYmd(sp.from)) {
    start = new Date(`${sp.from}T00:00:00-03:00`);
    const toY = isYmd(sp.to) ? sp.to : sp.from;
    endExcl = new Date(new Date(`${toY}T00:00:00-03:00`).getTime() + DAY_MS);
    label = `${sp.from} → ${toY}`;
  } else if (period === "ontem") {
    start = new Date(todayStart.getTime() - DAY_MS);
    endExcl = todayStart;
    label = "ontem";
  } else if (period === "7d") {
    start = new Date(todayStart.getTime() - 6 * DAY_MS);
    endExcl = new Date(todayStart.getTime() + DAY_MS);
    label = "últimos 7 dias";
  } else if (period === "mes") {
    start = monthStart;
    endExcl = new Date(monthStart.getTime() + daysInMonth * DAY_MS);
    label = "este mês";
  } else if (period === "mes_passado") {
    const pm = spMonth(new Date(monthStart.getTime() - DAY_MS));
    start = pm.start;
    endExcl = monthStart;
    label = "mês passado";
  } else {
    start = todayStart;
    endExcl = new Date(todayStart.getTime() + DAY_MS);
    label = "hoje";
  }

  const span = endExcl.getTime() - start.getTime();
  const totalDays = Math.max(1, Math.round(span / DAY_MS));
  const queryEnd = Math.min(now.getTime(), endExcl.getTime());
  const ongoing = now.getTime() < endExcl.getTime();
  const paceFrac = ongoing
    ? Math.min(1, Math.max(0, (queryEnd - start.getTime()) / span))
    : 1;

  return {
    period: period === "custom" && !isYmd(sp.from) ? "hoje" : period,
    label,
    startISO: start.toISOString(),
    endISO: new Date(queryEnd).toISOString(),
    totalDays,
    ongoing,
    paceFrac,
    from: sp.from,
    to: sp.to,
  };
}

type Lead = {
  id: string;
  assigned_owner_id: string | null;
  wa_number_id: string | null;
  status: string | null;
  scheduled_at: string | null;
  created_at: string;
};

type Kpi = {
  leads: number;
  agendou: number;
  compareceu: number;
  fechou: number;
  slaMs: number[];
};

const emptyKpi = (): Kpi => ({
  leads: 0,
  agendou: 0,
  compareceu: 0,
  fechou: 0,
  slaMs: [],
});

const REACHED_SCHEDULED = new Set(["scheduled", "attended", "won"]);
const ATTENDED = new Set(["attended", "won"]);

function roleHint(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gabi")) return "SDR";
  if (n.includes("milena") || n.includes("alan") || n.includes("juliana"))
    return "Closer";
  return "—";
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtDur(ms: number | null): string {
  if (ms == null) return "—";
  const min = ms / 60000;
  if (min < 60) return `${min.toFixed(min < 10 ? 1 : 0)} min`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

// 0=ruim(red) 1=médio(amber) 2=bom(green)
function tierClass(t: number): string {
  return t === 2
    ? "text-emerald-700"
    : t === 1
      ? "text-amber-600"
      : "text-rose-700";
}

function fmtNum(n: number): string {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(n % 1 === 0 ? 0 : 1);
}

async function buildKpis(
  admin: ReturnType<typeof createServiceClient>,
  startISO: string,
  endISO: string,
  withSla: boolean,
  waOwner: Map<string, string>,
) {
  // Lead sem dono atribuído herda o dono do número em que entrou (wa_number_id):
  // inbound no número da Gabi conta como Gabi, no da Milena como Milena.
  const effOwner = (l: Lead): string =>
    l.assigned_owner_id ??
    (l.wa_number_id ? (waOwner.get(l.wa_number_id) ?? null) : null) ??
    "__none__";

  const { data: leadsRaw } = await admin
    .from("leads")
    .select("id, assigned_owner_id, wa_number_id, status, scheduled_at, created_at")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .limit(5000);
  const leads = (leadsRaw ?? []) as Lead[];
  const cohort = new Set(leads.map((l) => l.id));
  const ownerOf = new Map<string, string | null>();
  for (const l of leads) ownerOf.set(l.id, effOwner(l));

  const byOwner = new Map<string, Kpi>();
  const bump = (k: string) => {
    let v = byOwner.get(k);
    if (!v) {
      v = emptyKpi();
      byOwner.set(k, v);
    }
    return v;
  };
  for (const l of leads) {
    const owner = effOwner(l);
    const k = bump(owner);
    k.leads += 1;
    const st = l.status ?? "";
    if (REACHED_SCHEDULED.has(st) || l.scheduled_at) k.agendou += 1;
    if (ATTENDED.has(st)) k.compareceu += 1;
    if (st === "won") k.fechou += 1;
  }

  if (withSla) {
    type Msg = { lead_id: string; direction: string; created_at: string };
    const firstIn = new Map<string, number>();
    const firstOutAfter = new Map<string, number>();
    const PAGE = 1000;
    for (let from = 0; from < 20000; from += PAGE) {
      const { data: msgs } = await admin
        .from("messages")
        .select("lead_id, direction, created_at")
        .gte("created_at", startISO)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      const rows = (msgs ?? []) as Msg[];
      for (const m of rows) {
        if (!cohort.has(m.lead_id)) continue;
        const t = new Date(m.created_at).getTime();
        if (m.direction === "inbound") {
          if (!firstIn.has(m.lead_id)) firstIn.set(m.lead_id, t);
        } else if (m.direction === "outbound") {
          const inT = firstIn.get(m.lead_id);
          if (inT != null && t >= inT && !firstOutAfter.has(m.lead_id))
            firstOutAfter.set(m.lead_id, t);
        }
      }
      if (rows.length < PAGE) break;
    }
    for (const [leadId, outT] of firstOutAfter) {
      const inT = firstIn.get(leadId);
      if (inT == null) continue;
      const owner = ownerOf.get(leadId) ?? "__none__";
      bump(owner).slaMs.push(outT - inT);
    }
  }

  return byOwner;
}

function sumTeam(kpis: Map<string, Kpi>) {
  let leads = 0,
    agendou = 0,
    compareceu = 0,
    fechou = 0;
  for (const k of kpis.values()) {
    leads += k.leads;
    agendou += k.agendou;
    compareceu += k.compareceu;
    fechou += k.fechou;
  }
  return { leads, agendou, compareceu, fechou };
}

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
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

  const admin = createServiceClient();
  const now = new Date();
  const sp = await searchParams;
  const pr = resolvePeriod(sp, now);

  // Meta escala pelo nº de dias-calendário do período selecionado.
  const META = {
    lead: META_DIA.lead * pr.totalDays,
    agend: META_DIA.agend * pr.totalDays,
    comp: META_DIA.comp * pr.totalDays,
    conv: META_DIA.conv * pr.totalDays,
  };
  // Linha de ritmo só faz sentido em período em curso.
  const paceFrac = pr.ongoing ? pr.paceFrac : undefined;

  // Mapa número → dono, pra atribuir leads sem dono ao responsável do número.
  const { data: waRows } = await admin
    .from("wa_numbers")
    .select("id, owner_id");
  const waOwner = new Map<string, string>();
  for (const w of waRows ?? []) if (w.owner_id) waOwner.set(w.id, w.owner_id);

  const [usersRes, kpis, backlogRes] = await Promise.all([
    admin.from("crm_users").select("id, display_name, role"),
    buildKpis(admin, pr.startISO, pr.endISO, true, waOwner),
    admin
      .from("leads")
      .select("assigned_owner_id, wa_number_id")
      .eq("status", "new")
      .is("follow_up_at", null)
      .limit(5000),
  ]);

  const nameOf = new Map<string, string>();
  for (const u of usersRes.data ?? [])
    nameOf.set(u.id, u.display_name ?? "(sem nome)");

  const backlogByOwner = new Map<string, number>();
  for (const r of backlogRes.data ?? []) {
    const k =
      r.assigned_owner_id ??
      (r.wa_number_id ? (waOwner.get(r.wa_number_id) ?? null) : null) ??
      "__none__";
    backlogByOwner.set(k, (backlogByOwner.get(k) ?? 0) + 1);
  }
  const backlogTotal = (backlogRes.data ?? []).length;

  const tot = sumTeam(kpis);

  function ownerName(id: string) {
    if (id === "__none__") return "Sem dono";
    return nameOf.get(id) ?? id.slice(0, 8);
  }

  const pacePct = Math.round(pr.paceFrac * 100);

  return (
    <CrmShell active="metas" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <h1 className="text-lg font-semibold text-slate-900">
          🎯 Metas comerciais
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Funil FSS · metas 11% / 70% / 20% (lead→agend→comparec→conv). Base ~90
          leads/dia. Coorte por data de criação · SLA = mediana da 1ª resposta.
        </p>

        <PeriodFilter period={pr.period} from={pr.from} to={pr.to} />

        {/* Metas do período */}
        <section className="mt-5 mb-7">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            Metas · {pr.label}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {pr.totalDays} {pr.totalDays === 1 ? "dia" : "dias"}
              {pr.ongoing
                ? ` · ritmo esperado: ${pacePct}% decorrido (traço)`
                : " · período fechado"}
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetaBar
              label="Leads"
              real={tot.leads}
              meta={META.lead}
              paceFrac={paceFrac}
            />
            <MetaBar
              label="Agendamentos"
              real={tot.agendou}
              meta={META.agend}
              paceFrac={paceFrac}
            />
            <MetaBar
              label="Comparecimentos"
              real={tot.compareceu}
              meta={META.comp}
              paceFrac={paceFrac}
            />
            <MetaBar
              label="Conversões (fechamentos)"
              real={tot.fechou}
              meta={META.conv}
              paceFrac={paceFrac}
            />
          </div>
        </section>

        {/* Placar por atendente */}
        <WindowBlock
          title={`Por atendente · ${pr.label}`}
          kpis={kpis}
          ownerName={ownerName}
          roleHint={(id) => roleHint(ownerName(id))}
          backlogByOwner={backlogByOwner}
          backlogTotal={backlogTotal}
          showBacklog
          metaAgend={Math.round(META.agend)}
          metaComparec={Math.round(META.comp)}
          metaFechou={Math.round(META.conv)}
        />

        <div className="mt-6 text-[11px] text-slate-400 leading-relaxed">
          <strong>Como ler:</strong> Agendou = leads da coorte em{" "}
          <em>scheduled/attended/won</em> ou com data marcada. Compareceu ={" "}
          <em>attended/won</em>. Fechou = <em>won</em>. Meta escala pelos{" "}
          {pr.totalDays} {pr.totalDays === 1 ? "dia" : "dias"} do período. Em
          período em curso, verde = no ritmo (≥ % decorrido), amarelo ≥ 60% do
          ritmo; período fechado compara contra a meta cheia. Backlog = snapshot
          atual (independe do filtro).
        </div>
      </div>
    </CrmShell>
  );
}

function MetaBar({
  label,
  real,
  meta,
  paceFrac,
}: {
  label: string;
  real: number;
  meta: number;
  paceFrac?: number;
}) {
  const ratio = meta > 0 ? real / meta : 0;
  const fillPct = Math.min(100, Math.round(ratio * 100));
  let tier: number;
  if (paceFrac != null) {
    const exp = meta * paceFrac;
    tier = real >= exp ? 2 : real >= 0.6 * exp ? 1 : 0;
  } else {
    tier = real >= meta ? 2 : real >= 0.6 * meta ? 1 : 0;
  }
  const barColor =
    tier === 2 ? "bg-emerald-500" : tier === 1 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {fmtNum(real)} / {fmtNum(meta)} ·{" "}
          <span className={`font-semibold ${tierClass(tier)}`}>
            {Math.round(ratio * 100)}%
          </span>
        </span>
      </div>
      <div className="relative mt-1.5 h-3 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${fillPct}%` }} />
        {paceFrac != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-600"
            style={{ left: `${Math.min(100, paceFrac * 100)}%` }}
            title="ritmo esperado"
          />
        )}
      </div>
    </div>
  );
}

function WindowBlock({
  title,
  kpis,
  ownerName,
  roleHint,
  backlogByOwner,
  backlogTotal,
  showBacklog,
  metaAgend,
  metaComparec,
  metaFechou,
}: {
  title: string;
  kpis: Map<string, Kpi>;
  ownerName: (id: string) => string;
  roleHint: (id: string) => string;
  backlogByOwner: Map<string, number>;
  backlogTotal: number;
  showBacklog: boolean;
  metaAgend: number;
  metaComparec: number;
  metaFechou: number;
}) {
  const rows = [...kpis.entries()]
    .filter(([id]) => id !== "__none__" || (kpis.get(id)?.leads ?? 0) > 0)
    .sort((a, b) => b[1].leads - a[1].leads);

  const tot = rows.reduce(
    (acc, [, k]) => {
      acc.leads += k.leads;
      acc.agendou += k.agendou;
      acc.compareceu += k.compareceu;
      acc.fechou += k.fechou;
      acc.sla.push(...k.slaMs);
      return acc;
    },
    { leads: 0, agendou: 0, compareceu: 0, fechou: 0, sla: [] as number[] },
  );

  const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : null);
  const slaTier = (ms: number | null) =>
    ms == null ? 1 : ms <= 5 * 60000 ? 2 : ms <= 30 * 60000 ? 1 : 0;
  const metaTier = (p: number | null, meta: number) =>
    p == null ? 0 : p >= meta ? 2 : p >= meta * 0.6 ? 1 : 0;
  const agTier = (p: number | null) => metaTier(p, META_AGEND);
  const cpTier = (p: number | null) => metaTier(p, META_COMPAREC);
  const cvTier = (p: number | null) => metaTier(p, META_CONV);
  const goalTier = (v: number, goal: number) =>
    v >= goal ? 2 : v >= goal * 0.5 ? 1 : 0;
  const fmtPct = (p: number | null) => (p == null ? "—" : `${p.toFixed(0)}%`);

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-800 mb-2">
        {title}
        <span className="ml-2 text-xs font-normal text-slate-500">
          {tot.leads} leads · {tot.agendou} agend (meta {metaAgend}) ·{" "}
          {tot.compareceu} comparec (meta {metaComparec}) · {tot.fechou} fechou
          (meta {metaFechou})
        </span>
      </h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Pessoa</th>
              <th className="px-2 py-2 text-left font-semibold">Papel</th>
              <th className="px-2 py-2 text-right font-semibold">Leads</th>
              <th className="px-2 py-2 text-right font-semibold">Agend</th>
              <th className="px-2 py-2 text-right font-semibold">→%</th>
              <th className="px-2 py-2 text-right font-semibold">SLA</th>
              <th className="px-2 py-2 text-right font-semibold">Comparec</th>
              <th className="px-2 py-2 text-right font-semibold">→%</th>
              <th className="px-2 py-2 text-right font-semibold">Fechou</th>
              <th className="px-2 py-2 text-right font-semibold">→%</th>
              {showBacklog && (
                <th className="px-2 py-2 text-right font-semibold">
                  Backlog s/ FU
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={showBacklog ? 11 : 10}
                  className="px-3 py-4 text-center text-slate-400"
                >
                  Sem leads na janela.
                </td>
              </tr>
            )}
            {rows.map(([id, k]) => {
              const agP = pct(k.agendou, k.leads);
              const cpP = pct(k.compareceu, k.agendou);
              const cvP = pct(k.fechou, k.compareceu);
              const sla = median(k.slaMs);
              const bl = backlogByOwner.get(id) ?? 0;
              return (
                <tr key={id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {ownerName(id)}
                  </td>
                  <td className="px-2 py-2 text-slate-500">{roleHint(id)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{k.leads}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {k.agendou}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${tierClass(agTier(agP))}`}
                  >
                    {fmtPct(agP)}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${tierClass(slaTier(sla))}`}
                  >
                    {fmtDur(sla)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {k.compareceu}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${tierClass(cpTier(cpP))}`}
                  >
                    {fmtPct(cpP)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {k.fechou}
                  </td>
                  <td
                    className={`px-2 py-2 text-right tabular-nums font-semibold ${tierClass(cvTier(cvP))}`}
                  >
                    {fmtPct(cvP)}
                  </td>
                  {showBacklog && (
                    <td
                      className={`px-2 py-2 text-right tabular-nums font-semibold ${tierClass(bl === 0 ? 2 : bl <= 50 ? 1 : 0)}`}
                    >
                      {bl}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-800">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-right tabular-nums">{tot.leads}</td>
              <td
                className={`px-2 py-2 text-right tabular-nums ${tierClass(goalTier(tot.agendou, metaAgend))}`}
              >
                {tot.agendou}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtPct(pct(tot.agendou, tot.leads))}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtDur(median(tot.sla))}
              </td>
              <td
                className={`px-2 py-2 text-right tabular-nums ${tierClass(goalTier(tot.compareceu, metaComparec))}`}
              >
                {tot.compareceu}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtPct(pct(tot.compareceu, tot.agendou))}
              </td>
              <td
                className={`px-2 py-2 text-right tabular-nums ${tierClass(goalTier(tot.fechou, metaFechou))}`}
              >
                {tot.fechou}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {fmtPct(pct(tot.fechou, tot.compareceu))}
              </td>
              {showBacklog && (
                <td className="px-2 py-2 text-right tabular-nums">
                  {backlogTotal}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
