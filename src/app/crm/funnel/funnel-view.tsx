"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FunnelRange = {
  preset: "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";
  start_at: string;
  end_at: string;
  label: string;
  from?: string;
  to?: string;
};

export type FunnelMetrics = {
  start_at: string;
  end_at: string;
  pageviews: number;
  leads_total: number;
  wa_clicks: number;
  phone_matched: number;
  by_step: { step: string; count: number }[];
};

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
  wa_click: "💬 Clicou no WhatsApp",
  result_PRONTA: "Resultado · Pronta",
  result_ESPERANCOSA: "Resultado · Esperançosa",
  result_CETICA: "Resultado · Cética",
  loading: "Loading",
};

const PRESETS: { key: FunnelRange["preset"]; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
];

export function FunnelView({
  metrics,
  error,
  range,
}: {
  metrics: FunnelMetrics;
  error: string | null;
  range: FunnelRange;
}) {
  const stepMap = Object.fromEntries(
    metrics.by_step.map((s) => [s.step, s.count]),
  );
  const pageviews = metrics.pageviews;
  const top = Math.max(pageviews, stepMap["cover"] ?? 0, 1);

  type StepRow = {
    step: string;
    label: string;
    count: number;
    pctOfTop: number;
    dropoff: number;
  };

  const steps: StepRow[] = STEP_ORDER.filter(
    (s) => !s.startsWith("result_"),
  ).map((s, idx, arr) => {
    const count = stepMap[s] ?? 0;
    const prev = idx === 0 ? top : (stepMap[arr[idx - 1]] ?? top);
    const pctOfTop = (count / top) * 100;
    const dropoff = prev > 0 ? ((prev - count) / prev) * 100 : 0;
    return { step: s, label: STEP_LABEL[s], count, pctOfTop, dropoff };
  });

  // wa_click vem de metrics.wa_clicks (evento separado do quiz_step_view).
  // Adiciona como última etapa do funil, com dropoff calculado vs `lead`.
  const leadCount = stepMap["lead"] ?? 0;
  const waCount = metrics.wa_clicks;
  steps.push({
    step: "wa_click",
    label: STEP_LABEL["wa_click"],
    count: waCount,
    pctOfTop: (waCount / top) * 100,
    dropoff: leadCount > 0 ? ((leadCount - waCount) / leadCount) * 100 : 0,
  });

  const resultBuckets = (
    ["result_PRONTA", "result_ESPERANCOSA", "result_CETICA"] as const
  ).map((s) => ({
    step: s,
    label: STEP_LABEL[s],
    count: stepMap[s] ?? 0,
  }));

  const completion = pageviews > 0 ? (metrics.leads_total / pageviews) * 100 : 0;
  const waClickRate =
    metrics.leads_total > 0 ? (metrics.wa_clicks / metrics.leads_total) * 100 : 0;
  const phoneMatchRate =
    metrics.wa_clicks > 0
      ? (metrics.phone_matched / metrics.wa_clicks) * 100
      : 0;

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-6 w-full">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Funil</h2>
          <p className="text-sm text-slate-500">
            Conversão por etapa · {range.label}
          </p>
        </div>
        <RangeFilter range={range} />
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          ⚠️ Erro ao carregar funil: {error}
        </div>
      )}

      {/* Cards macro */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Pageviews" value={pageviews} sub="visitantes únicos da capa" />
        <Stat
          label="Conclusão"
          value={`${completion.toFixed(1)}%`}
          sub={`${metrics.leads_total} de ${pageviews} preencheram`}
          accent="green"
        />
        <Stat
          label="Click WhatsApp"
          value={`${waClickRate.toFixed(1)}%`}
          sub={`${metrics.wa_clicks} de ${metrics.leads_total} clicaram`}
          accent="amber"
        />
        <Stat
          label="Phone match"
          value={`${phoneMatchRate.toFixed(1)}%`}
          sub={`${metrics.phone_matched} de ${metrics.wa_clicks} mandaram msg`}
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

      {/* Distribuição por arquétipo */}
      <section className="bg-white border border-slate-200 rounded-md p-5">
        <h3 className="text-sm font-semibold mb-1">Distribuição por arquétipo</h3>
        <p className="text-xs text-slate-500 mb-5">
          Quem completou o quiz, em qual bucket caiu. Total leads:{" "}
          {metrics.leads_total}.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {resultBuckets.map((b) => {
            const pct =
              metrics.leads_total > 0
                ? (b.count / metrics.leads_total) * 100
                : 0;
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
        Tracking via <code>session_id</code> em sessionStorage · agregação por sessão única.
      </p>
    </div>
  );
}

function RangeFilter({ range }: { range: FunnelRange }) {
  const router = useRouter();
  const [showCustom, setShowCustom] = useState(range.preset === "custom");
  const [from, setFrom] = useState(range.from ?? toIsoDate(new Date()));
  const [to, setTo] = useState(range.to ?? toIsoDate(new Date()));

  function applyCustom() {
    if (!from || !to) return;
    if (from > to) {
      alert("Data 'de' não pode ser depois de 'até'");
      return;
    }
    router.push(`/crm/funnel?from=${from}&to=${to}`);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/crm/funnel?preset=${p.key}`}
            onClick={() => setShowCustom(false)}
            className={`px-3 py-1.5 text-xs rounded-md border transition ${
              range.preset === p.key
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1.5 text-xs rounded-md border transition ${
            range.preset === "custom"
              ? "bg-slate-900 text-white border-slate-900"
              : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
          }`}
        >
          📅 Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2 text-xs">
          <span className="text-slate-500">de</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded outline-none"
          />
          <span className="text-slate-500">até</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toIsoDate(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded outline-none"
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1 text-xs rounded bg-slate-900 text-white hover:bg-slate-700"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
