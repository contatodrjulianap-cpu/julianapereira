"use client";

import { useState } from "react";

export type Alert = {
  tipo: string;
  sev: "alta" | "media" | "baixa";
  msg: string;
};

export type DailyInsight = {
  id: string;
  dia: string;
  leads_novos: number | null;
  por_fonte: Record<string, number> | null;
  transicoes: Record<string, number> | null;
  wons: number | null;
  parados: number | null;
  por_atendente: Record<string, { parados?: number }> | null;
  investimento_brl: number | null;
  cpl_brl: number | null;
  cpa_brl: number | null;
  narrativa: string | null;
  alerts: Alert[] | null;
  fontes: string[] | null;
  updated_at: string;
};

const SEV: Record<Alert["sev"], { bg: string; dot: string; label: string }> = {
  alta: { bg: "bg-rose-50 border-rose-200", dot: "bg-rose-500", label: "Alta" },
  media: { bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500", label: "Média" },
  baixa: { bg: "bg-slate-50 border-slate-200", dot: "bg-slate-400", label: "Baixa" },
};

function fmtDia(dia: string) {
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <span className={`text-[20px] font-semibold ${alert ? "text-rose-600" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

function severitySort(a: Alert, b: Alert) {
  const w = { alta: 0, media: 1, baixa: 2 };
  return (w[a.sev] ?? 3) - (w[b.sev] ?? 3);
}

function InsightCard({ ins, hoje }: { ins: DailyInsight; hoje?: boolean }) {
  const alerts = [...(ins.alerts ?? [])].sort(severitySort);
  const fontes = ins.por_fonte ?? {};
  const ats = ins.por_atendente ?? {};
  return (
    <div
      className={`rounded-2xl border bg-white ${
        hoje ? "border-slate-300 shadow-sm" : "border-slate-200"
      } p-5`}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-slate-900">
          {hoje ? "Insight do dia" : fmtDia(ins.dia)}
          {hoje && <span className="ml-2 text-[12px] font-normal text-slate-400">{fmtDia(ins.dia)}</span>}
        </h2>
        {(ins.alerts?.some((a) => a.sev === "alta") ?? false) && (
          <span className="text-[11px] font-medium text-rose-600">● requer ação</span>
        )}
      </div>

      {/* métricas */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
        <Metric label="Leads novos" value={ins.leads_novos?.toString() ?? "—"} />
        <Metric label="Avançaram" value={(ins.transicoes?.novos_que_avancaram_de_new ?? "—").toString()} alert={ins.transicoes?.novos_que_avancaram_de_new === 0} />
        <Metric label="Wons" value={ins.wons?.toString() ?? "—"} />
        <Metric label="Parados" value={ins.parados?.toString() ?? "—"} alert={(ins.parados ?? 0) > 0} />
      </div>

      {/* fonte + atendente */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[12px] text-slate-500">
        {Object.entries(fontes).map(([k, v]) => (
          <span key={k}>
            <b className="text-slate-700">{v}</b> {k}
          </span>
        ))}
        {Object.entries(ats).map(([nome, o]) => (
          <span key={nome} className={`${(o.parados ?? 0) >= 5 ? "text-rose-600" : ""}`}>
            {nome}: <b>{o.parados ?? 0}</b> parados
          </span>
        ))}
        <span className="text-slate-400">
          invest. {ins.investimento_brl != null ? `R$${ins.investimento_brl}` : "N/D"} · CPA{" "}
          {ins.cpa_brl != null ? `R$${ins.cpa_brl}` : "N/D"}
        </span>
      </div>

      {/* narrativa */}
      {ins.narrativa && (
        <p className="text-[14px] leading-relaxed text-slate-700 mb-4">{ins.narrativa}</p>
      )}

      {/* alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const s = SEV[a.sev] ?? SEV.baixa;
            return (
              <div key={i} className={`flex gap-2.5 rounded-xl border ${s.bg} px-3 py-2`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {s.label} · {a.tipo}
                  </span>
                  <p className="text-[13px] leading-snug text-slate-700">{a.msg}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hoje && ins.fontes && ins.fontes.length > 0 && (
        <p className="mt-4 text-[10px] text-slate-300">fontes: {ins.fontes.join(" · ")}</p>
      )}
    </div>
  );
}

export function InsightsView({ initial }: { initial: DailyInsight[] }) {
  const [openHist, setOpenHist] = useState(false);

  if (initial.length === 0) {
    return (
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
          Nenhum insight ainda. O primeiro roda amanhã às 7h (ou rode{" "}
          <code className="text-slate-500">scripts/daily-insight.sh</code> agora).
        </div>
      </div>
    );
  }

  const [hoje, ...resto] = initial;

  return (
    <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-6 space-y-5">
      <InsightCard ins={hoje} hoje />

      {resto.length > 0 && (
        <div>
          <button
            onClick={() => setOpenHist((v) => !v)}
            className="text-[13px] font-medium text-slate-500 hover:text-slate-700"
          >
            {openHist ? "▾" : "▸"} Histórico ({resto.length} {resto.length === 1 ? "dia" : "dias"})
          </button>
          {openHist && (
            <div className="mt-3 space-y-4">
              {resto.map((ins) => (
                <InsightCard key={ins.id} ins={ins} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
