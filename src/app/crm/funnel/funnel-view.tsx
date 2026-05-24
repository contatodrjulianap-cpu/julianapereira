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
  variant?: "resina" | "porcelana" | null;
};

export type FunnelMetrics = {
  start_at: string;
  end_at: string;
  pageviews: number;
  leads_total: number;
  wa_clicks: number;
  phone_matched: number;
  by_step: { step: string; count: number }[];
  by_archetype?: { archetype: "PRONTA" | "ESPERANCOSA" | "CETICA"; count: number }[];
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
  phone_match: "✅ Número bateu no WhatsApp",
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

type SurfaceTone = "slate" | "indigo" | "violet";

type SurfaceCard = {
  key: "all" | "quiz" | "bot";
  icon: string;
  title: string;
  subtitle: string;
  tone: SurfaceTone;
  metrics: FunnelMetrics;
};

// Computa rows do funil pra um FunnelMetrics (extraído pra reuso nos 3 cards).
function computeSteps(metrics: FunnelMetrics) {
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

  const leadCount = stepMap["lead"] ?? 0;
  const waCount = metrics.wa_clicks;
  const matchCount = metrics.phone_matched;
  steps.push({
    step: "wa_click",
    label: STEP_LABEL["wa_click"],
    count: waCount,
    pctOfTop: (waCount / top) * 100,
    dropoff: leadCount > 0 ? ((leadCount - waCount) / leadCount) * 100 : 0,
  });
  steps.push({
    step: "phone_match",
    label: STEP_LABEL["phone_match"],
    count: matchCount,
    pctOfTop: (matchCount / top) * 100,
    dropoff: waCount > 0 ? ((waCount - matchCount) / waCount) * 100 : 0,
  });

  return { steps, pageviews, top };
}

export function FunnelView({
  metrics,
  metricsQuiz,
  metricsBot,
  error,
  range,
}: {
  metrics: FunnelMetrics;
  metricsQuiz: FunnelMetrics;
  metricsBot: FunnelMetrics;
  error: string | null;
  range: FunnelRange;
}) {
  // Arquétipo: só faz sentido contar uma vez (combinado), porque é distribuição
  // dos leads que completaram, independente do surface de entrada.
  const archetypeMap = Object.fromEntries(
    (metrics.by_archetype ?? []).map((a) => [a.archetype, a.count]),
  );
  const resultBuckets = (
    ["result_PRONTA", "result_ESPERANCOSA", "result_CETICA"] as const
  ).map((s) => {
    const arch = s.replace("result_", "") as "PRONTA" | "ESPERANCOSA" | "CETICA";
    return {
      step: s,
      label: STEP_LABEL[s],
      count: archetypeMap[arch] ?? 0,
    };
  });

  const surfaceCards: SurfaceCard[] = [
    {
      key: "all",
      icon: "📊",
      title: "Todos os funis",
      subtitle: "Quiz tradicional + Typebot somados",
      tone: "slate",
      metrics,
    },
    {
      key: "quiz",
      icon: "🧪",
      title: "Quiz tradicional",
      subtitle: "/quiz/[variant] · fluxo de tela cheia",
      tone: "indigo",
      metrics: metricsQuiz,
    },
    {
      key: "bot",
      icon: "🤖",
      title: "Typebot (chat)",
      subtitle: "/chat/[variant] · fluxo WhatsApp-style",
      tone: "violet",
      metrics: metricsBot,
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-8 w-full">
      {/* Header + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Funil
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Conversão por etapa · {range.label}
            {range.variant && (
              <span className="text-slate-700 font-medium">
                {" · "}
                {range.variant === "resina" ? "Resina" : "Porcelana"}
              </span>
            )}
          </p>
        </div>
        <RangeFilter range={range} />
      </div>
      <VariantFilter range={range} />
      <div className="mb-6" />

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ⚠️ Erro ao carregar funil: {error}
        </div>
      )}

      {/* 3 cards stacked: todos → quiz → typebot */}
      <div className="space-y-6 mb-6">
        {surfaceCards.map((card) => (
          <SurfaceFunnelCard key={card.key} card={card} />
        ))}
      </div>

      {/* Distribuição por arquétipo — única, agregada (não muda por surface) */}
      <section className="bg-white rounded-xl ring-1 ring-slate-200/70 shadow-sm p-6">
        <div className="mb-6">
          <h3 className="text-base font-semibold text-slate-900">
            Distribuição por arquétipo
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Em qual bucket os leads que completaram caíram. Total:{" "}
            {metrics.leads_total}.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {resultBuckets.map((b) => {
            const pct =
              metrics.leads_total > 0
                ? (b.count / metrics.leads_total) * 100
                : 0;
            const styles =
              b.step === "result_PRONTA"
                ? {
                    bar: "bg-emerald-500",
                    dot: "bg-emerald-500",
                    label: "text-emerald-700",
                  }
                : b.step === "result_ESPERANCOSA"
                  ? {
                      bar: "bg-amber-400",
                      dot: "bg-amber-400",
                      label: "text-amber-700",
                    }
                  : {
                      bar: "bg-slate-400",
                      dot: "bg-slate-400",
                      label: "text-slate-600",
                    };
            return (
              <div
                key={b.step}
                className="rounded-lg ring-1 ring-slate-200 bg-white p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`w-2 h-2 rounded-full ${styles.dot}`}
                    aria-hidden
                  />
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-wider ${styles.label}`}
                  >
                    {b.label.replace("Resultado · ", "")}
                  </p>
                </div>
                <p className="text-3xl font-semibold text-slate-900 tabular-nums">
                  {b.count}
                </p>
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${styles.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 tabular-nums">
                  {pct.toFixed(1)}% dos leads
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <p className="text-xs text-slate-400 mt-6 text-center">
        Tracking via <code className="font-mono">session_id</code> em
        sessionStorage · agregação por sessão única.
      </p>
    </div>
  );
}

function SurfaceFunnelCard({ card }: { card: SurfaceCard }) {
  const { metrics } = card;
  const { steps, pageviews } = computeSteps(metrics);

  const completion = pageviews > 0 ? (metrics.leads_total / pageviews) * 100 : 0;
  const waClickRate =
    metrics.leads_total > 0
      ? (metrics.wa_clicks / metrics.leads_total) * 100
      : 0;
  const phoneMatchRate =
    metrics.wa_clicks > 0
      ? (metrics.phone_matched / metrics.wa_clicks) * 100
      : 0;

  const toneRing =
    card.tone === "indigo"
      ? "ring-indigo-200/70"
      : card.tone === "violet"
        ? "ring-violet-200/70"
        : "ring-slate-200/70";
  const toneBar =
    card.tone === "indigo"
      ? "bg-indigo-500"
      : card.tone === "violet"
        ? "bg-violet-500"
        : "bg-slate-700";

  const empty =
    metrics.pageviews === 0 &&
    metrics.leads_total === 0 &&
    metrics.wa_clicks === 0;

  return (
    <section
      className={`bg-white rounded-xl ring-1 ${toneRing} shadow-sm overflow-hidden`}
    >
      {/* Header do card */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`flex items-center justify-center w-9 h-9 rounded-lg ${toneBar} text-white text-base shrink-0`}
            aria-hidden
          >
            {card.icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900 truncate">
              {card.title}
            </h3>
            <p className="text-xs text-slate-500 truncate">{card.subtitle}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wider font-medium text-slate-400">
            Pageviews
          </p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums tracking-tight">
            {pageviews}
          </p>
        </div>
      </div>

      {empty ? (
        <div className="px-6 py-10 text-center text-sm text-slate-400">
          Sem eventos nesse recorte.
        </div>
      ) : (
        <>
          {/* Macro stats compactos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-4 bg-slate-50/40">
            <MiniStat
              label="Conclusão"
              value={`${completion.toFixed(1)}%`}
              sub={`${metrics.leads_total}/${pageviews} preencheram`}
            />
            <MiniStat
              label="Click WhatsApp"
              value={`${waClickRate.toFixed(1)}%`}
              sub={`${metrics.wa_clicks}/${metrics.leads_total} clicaram`}
            />
            <MiniStat
              label="Número bateu"
              value={`${phoneMatchRate.toFixed(1)}%`}
              sub={`${metrics.phone_matched}/${metrics.wa_clicks} mandaram msg`}
            />
            <MiniStat
              label="Leads"
              value={metrics.leads_total}
              sub="completaram o funil"
            />
          </div>

          {/* Funil por etapa */}
          <div className="px-6 py-5">
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
          </div>
        </>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg ring-1 ring-slate-200/70 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider font-medium text-slate-500">
        {label}
      </p>
      <p className="text-lg font-semibold text-slate-900 tabular-nums tracking-tight mt-0.5">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</p>
      )}
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
    const qs = new URLSearchParams({ from, to });
    if (range.variant) qs.set("variant", range.variant);
    router.push(`/crm/funnel?${qs.toString()}`);
  }

  function hrefPreset(key: FunnelRange["preset"]): string {
    const qs = new URLSearchParams({ preset: key });
    if (range.variant) qs.set("variant", range.variant);
    return `/crm/funnel?${qs.toString()}`;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="inline-flex items-center bg-white rounded-lg ring-1 ring-slate-200 p-0.5 shadow-sm">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={hrefPreset(p.key)}
            onClick={() => setShowCustom(false)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              range.preset === p.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </Link>
        ))}
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            range.preset === "custom"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 bg-white ring-1 ring-slate-200 shadow-sm rounded-lg px-3 py-2 text-xs">
          <span className="text-slate-500">de</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1 text-xs ring-1 ring-slate-200 rounded outline-none focus:ring-slate-400"
          />
          <span className="text-slate-500">até</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toIsoDate(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1 text-xs ring-1 ring-slate-200 rounded outline-none focus:ring-slate-400"
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1 text-xs rounded-md bg-slate-900 text-white hover:bg-slate-700 font-medium"
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

const VARIANT_PILLS: {
  key: "all" | "resina" | "porcelana";
  label: string;
  active: string;
}[] = [
  { key: "all", label: "📊 Ambos", active: "bg-slate-900 text-white" },
  { key: "resina", label: "🟨 Resina", active: "bg-amber-600 text-white" },
  { key: "porcelana", label: "🟦 Porcelana", active: "bg-sky-600 text-white" },
];

function VariantFilter({ range }: { range: FunnelRange }) {
  // Preserva preset/from/to atual ao trocar variant
  function hrefFor(v: "all" | "resina" | "porcelana"): string {
    const qs = new URLSearchParams();
    if (range.preset === "custom" && range.from && range.to) {
      qs.set("from", range.from);
      qs.set("to", range.to);
    } else {
      qs.set("preset", range.preset);
    }
    if (v !== "all") qs.set("variant", v);
    return `/crm/funnel?${qs.toString()}`;
  }
  const current: "all" | "resina" | "porcelana" = range.variant ?? "all";
  return (
    <div className="inline-flex items-center bg-white rounded-lg ring-1 ring-slate-200 p-0.5 shadow-sm">
      {VARIANT_PILLS.map((p) => (
        <Link
          key={p.key}
          href={hrefFor(p.key)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
            current === p.key
              ? p.active
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          {p.label}
        </Link>
      ))}
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
  // Cor da barra escala com pct: > 50% indigo cheio, 20-50% indigo médio, < 20% slate
  const barColor =
    pct >= 50
      ? "bg-indigo-600"
      : pct >= 20
        ? "bg-indigo-400"
        : "bg-slate-300";

  return (
    <div className="grid grid-cols-[220px_1fr_72px] items-center gap-4">
      <span className="text-sm text-slate-700 font-medium truncate">
        {label}
      </span>
      <div className="relative h-9 bg-slate-50 rounded-md overflow-hidden ring-1 ring-slate-100">
        <div
          className={`absolute inset-y-0 left-0 ${barColor} transition-[width] duration-500`}
          style={{ width: `${Math.max(pct, 0.5)}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <span
            className={`text-sm font-semibold tabular-nums ${
              pct >= 30 ? "text-white" : "text-slate-700"
            }`}
          >
            {count}
          </span>
          <span
            className={`text-xs tabular-nums ${
              pct >= 30 ? "text-white/80" : "text-slate-500"
            }`}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <span
        className={`text-xs font-medium text-right tabular-nums ${
          dropoff === null
            ? "text-slate-300"
            : dropoff > 30
              ? "text-rose-600"
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
