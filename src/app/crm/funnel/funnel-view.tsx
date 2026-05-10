"use client";

import Link from "next/link";

export type FunnelMetrics = {
  days_back: number;
  pageviews: number;
  leads_total: number;
  wa_clicks: number;
  phone_matched: number;
  by_step: { step: string; count: number }[];
};

// Ordem canônica dos steps no funil
const STEP_ORDER = [
  "cover",
  "commitment",
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "lead",
  "result_PRONTA",
  "result_ESPERANCOSA",
  "result_CETICA",
] as const;

const STEP_LABEL: Record<string, string> = {
  cover: "Capa",
  commitment: "Compromisso",
  q1: "Q1 · Caso clínico",
  q2: "Q2 · Última foto sem travar",
  q3: "Q3 · Maior trava",
  q4: "Q4 · Lente amarela?",
  q5: "Q5 · Resultado ideal",
  q6: "Q6 · Localização",
  q7: "Q7 · Urgência",
  q8: "Q8 · Capacidade financeira",
  lead: "Captura (nome + WhatsApp)",
  result_PRONTA: "Resultado · Pronta",
  result_ESPERANCOSA: "Resultado · Esperançosa",
  result_CETICA: "Resultado · Cética",
  loading: "Loading",
};

export function FunnelView({
  metrics,
  error,
  days,
}: {
  metrics: FunnelMetrics;
  error: string | null;
  days: number;
}) {
  const stepMap = Object.fromEntries(
    metrics.by_step.map((s) => [s.step, s.count]),
  );
  const pageviews = metrics.pageviews;
  const top = Math.max(pageviews, stepMap["cover"] ?? 0, 1);

  const steps = STEP_ORDER.filter(
    (s) => !s.startsWith("result_"),
  ).map((s, idx, arr) => {
    const count = stepMap[s] ?? 0;
    const prev = idx === 0 ? top : stepMap[arr[idx - 1]] ?? top;
    const pctOfTop = (count / top) * 100;
    const dropoff = prev > 0 ? ((prev - count) / prev) * 100 : 0;
    return { step: s, label: STEP_LABEL[s], count, pctOfTop, dropoff };
  });

  // Resultado: 3 buckets
  const resultBuckets = (["result_PRONTA", "result_ESPERANCOSA", "result_CETICA"] as const).map(
    (s) => ({
      step: s,
      label: STEP_LABEL[s],
      count: stepMap[s] ?? 0,
    }),
  );

  // Conversões macro
  const completion =
    pageviews > 0 ? (metrics.leads_total / pageviews) * 100 : 0;
  const waClickRate =
    metrics.leads_total > 0
      ? (metrics.wa_clicks / metrics.leads_total) * 100
      : 0;
  const phoneMatchRate =
    metrics.wa_clicks > 0
      ? (metrics.phone_matched / metrics.wa_clicks) * 100
      : 0;

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Funil</h2>
          <p className="text-sm text-slate-500">
            Conversão por etapa · últimos {days} dias
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/crm/funnel?days=${d}`}
              className={`px-3 py-1.5 text-xs rounded-md border transition ${
                days === d
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {d}d
            </Link>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ⚠️ Erro ao carregar funil: {error}. Confirma que a função RPC{" "}
          <code>quiz_funnel_metrics</code> existe no Supabase.
        </div>
      )}

      {/* Cards macro */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Pageviews" value={pageviews} sub="visitantes únicos da capa" />
        <Stat
          label="Conclusão"
          value={`${completion.toFixed(1)}%`}
          sub={`${metrics.leads_total} de ${pageviews} preencheram o quiz`}
          accent="green"
        />
        <Stat
          label="Click WhatsApp"
          value={`${waClickRate.toFixed(1)}%`}
          sub={`${metrics.wa_clicks} de ${metrics.leads_total} clicaram (Pronta + Esperançosa)`}
          accent="amber"
        />
        <Stat
          label="Phone match"
          value={`${phoneMatchRate.toFixed(1)}%`}
          sub={`${metrics.phone_matched} de ${metrics.wa_clicks} mandaram msg do mesmo número`}
          accent="emerald"
        />
      </section>

      {/* Funil por step */}
      <section className="bg-white border border-slate-200 rounded-md p-5 mb-6">
        <h3 className="text-sm font-semibold mb-1">Funil por etapa</h3>
        <p className="text-xs text-slate-500 mb-5">
          % calculado sobre o topo do funil (capa). Drop-off é a queda entre etapas.
        </p>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <FunnelBar
              key={s.step}
              label={s.label}
              count={s.count}
              pct={s.pctOfTop}
              dropoff={i === 0 ? null : s.dropoff}
            />
          ))}
        </div>
      </section>

      {/* Distribuição por arquétipo (resultado) */}
      <section className="bg-white border border-slate-200 rounded-md p-5">
        <h3 className="text-sm font-semibold mb-1">Distribuição por arquétipo</h3>
        <p className="text-xs text-slate-500 mb-5">
          Quem completou o quiz, em qual bucket caiu. Total leads:{" "}
          {metrics.leads_total}.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {resultBuckets.map((b) => {
            const pct =
              metrics.leads_total > 0 ? (b.count / metrics.leads_total) * 100 : 0;
            const accent =
              b.step === "result_PRONTA"
                ? "bg-green-100 text-green-800 border-green-200"
                : b.step === "result_ESPERANCOSA"
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-slate-200 text-slate-700 border-slate-300";
            return (
              <div
                key={b.step}
                className={`px-4 py-4 rounded-md border ${accent}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wide mb-1">
                  {b.label.replace("Resultado · ", "")}
                </p>
                <p className="text-3xl font-bold">{b.count}</p>
                <p className="text-xs mt-1">{pct.toFixed(1)}% dos leads</p>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-slate-400 mt-6 text-center">
        Tracking via <code>session_id</code> em sessionStorage · agregado por
        sessão única (não eventos brutos).
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "green" | "amber" | "emerald";
}) {
  const color =
    accent === "green"
      ? "text-green-600"
      : accent === "amber"
        ? "text-amber-600"
        : accent === "emerald"
          ? "text-emerald-700"
          : "text-slate-900";
  return (
    <div className="bg-white border border-slate-200 rounded-md px-4 py-4">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelBar({
  label,
  count,
  pct,
  dropoff,
}: {
  label: string;
  count: number;
  pct: number;
  dropoff: number | null;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr_auto] items-center gap-3">
      <span className="text-xs text-slate-700 font-medium">{label}</span>
      <div className="relative h-7 bg-slate-100 rounded">
        <div
          className="absolute inset-y-0 left-0 rounded transition-[width] duration-500"
          style={{
            width: `${Math.max(pct, 0.5)}%`,
            background:
              "linear-gradient(90deg, var(--sakura-rose-2), var(--sakura-cocoa))",
          }}
        />
        <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white mix-blend-difference">
          {count} ({pct.toFixed(0)}%)
        </span>
      </div>
      <span
        className={`text-xs font-semibold w-16 text-right ${
          dropoff === null
            ? "text-slate-300"
            : dropoff > 30
              ? "text-red-600"
              : dropoff > 10
                ? "text-amber-600"
                : "text-slate-400"
        }`}
      >
        {dropoff === null ? "—" : dropoff > 0 ? `↓${dropoff.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}
