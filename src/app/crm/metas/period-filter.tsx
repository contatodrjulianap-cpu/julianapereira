"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Filtro de período do painel de Metas.
// Presets nomeados (hoje/ontem/7d/este mês/mês passado) + range custom.
// Server lê via resolvePeriod() na page.tsx.

const PRESETS: { key: string; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7d" },
  { key: "mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
];

export function PeriodFilter({
  period,
  from,
  to,
}: {
  period: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const isCustom = period === "custom";
  const [showCustom, setShowCustom] = useState(isCustom);
  const [fromInput, setFromInput] = useState(from ?? today);
  const [toInput, setToInput] = useState(to ?? today);

  function buildUrl(params: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("period");
    next.delete("from");
    next.delete("to");
    for (const [k, v] of Object.entries(params)) {
      if (v !== null) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function applyPreset(key: string) {
    setShowCustom(false);
    router.push(buildUrl({ period: key }));
  }

  function applyCustom() {
    if (!fromInput) return;
    router.push(
      buildUrl({ period: "custom", from: fromInput, to: toInput || fromInput }),
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[11px] text-slate-500">Período:</span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
              !isCustom && period === p.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
            isCustom
              ? "bg-rose-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          📆 {isCustom ? `${from} → ${to}` : "Personalizado"}
        </button>
      </div>

      {showCustom && (
        <div className="flex gap-2 flex-wrap items-center bg-slate-50 border border-slate-200 rounded-lg p-2.5">
          <label className="text-[11px] text-slate-600 font-semibold">De:</label>
          <input
            type="date"
            value={fromInput}
            max={today}
            onChange={(e) => setFromInput(e.target.value)}
            className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded outline-none focus:border-rose-300"
          />
          <label className="text-[11px] text-slate-600 font-semibold">
            Até:
          </label>
          <input
            type="date"
            value={toInput}
            min={fromInput}
            max={today}
            onChange={(e) => setToInput(e.target.value)}
            className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded outline-none focus:border-rose-300"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!fromInput}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCustom(false);
              applyPreset("hoje");
            }}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
