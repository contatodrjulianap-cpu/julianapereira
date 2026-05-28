"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Filtro de data compartilhado pelas 3 telas de Ads.
// Suporta presets (1/3/7/14/30 dias) E range custom (from/to).
// Server lê via resolveDateRange() em lib/utimify.ts.

export function DateFilter({
  mode,
  days,
  from,
  to,
}: {
  mode: "preset" | "custom";
  days: number;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const [showCustom, setShowCustom] = useState(mode === "custom");
  const [fromInput, setFromInput] = useState(from ?? today);
  const [toInput, setToInput] = useState(to ?? today);

  function buildUrl(params: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    // Limpa params de data (mutuamente exclusivos)
    next.delete("range");
    next.delete("from");
    next.delete("to");
    for (const [k, v] of Object.entries(params)) {
      if (v !== null) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function applyPreset(n: number) {
    setShowCustom(false);
    router.push(buildUrl({ range: String(n) }));
  }

  function applyCustom() {
    if (!fromInput) return;
    router.push(buildUrl({ from: fromInput, to: toInput || fromInput }));
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-[11px] text-slate-500">Período:</span>
        {[1, 3, 7, 14, 30].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => applyPreset(n)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
              mode === "preset" && days === n
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {n === 1 ? "Hoje" : `${n}d`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
            mode === "custom"
              ? "bg-rose-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          📆 {mode === "custom" ? `${from} → ${to}` : "Custom"}
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
          <label className="text-[11px] text-slate-600 font-semibold">Até:</label>
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
              applyPreset(1);
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
