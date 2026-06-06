// Funil comercial — corte SDR × Closer, com o handoff no agendamento.
// Server component. Recebe contagens pré-computadas na page (count queries).
//
//   Pré-venda (SDR):  Leads → Agendados            (taxa de agendamento)
//   ── handoff: avaliação marcada ──
//   Avaliação (Closer): Agendados → Compareceram → Fecharam
//
// Definições (proxy honesto a partir do status atual + scheduled_at):
//   · Agendados    = scheduled_at preenchido
//   · Compareceram = status 'attended' ou 'won'
//   · Fecharam     = status 'won'

export type CommercialCounts = {
  leads: number;
  agendados: number;
  compareceram: number;
  fecharam: number;
};

function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

function badge(value: number, meta: number): string {
  if (value >= meta) return "bg-emerald-100 text-emerald-800";
  if (value >= meta * 0.6) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-700";
}

function Row({
  label,
  count,
  rate,
  meta,
}: {
  label: string;
  count: number;
  rate?: { value: number; meta: number; of: string };
  meta?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-slate-900 tabular-nums">{count}</span>
        {rate && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge(
              rate.value,
              rate.meta,
            )}`}
            title={`${rate.value}% ${rate.of} · meta ${rate.meta}%`}
          >
            {rate.value}% <span className="font-normal opacity-70">· meta {rate.meta}%</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function CommercialFunnel({
  counts,
  rangeLabel,
}: {
  counts: CommercialCounts;
  rangeLabel: string;
}) {
  const { leads, agendados, compareceram, fecharam } = counts;

  return (
    <section className="bg-white border border-slate-200 rounded-md overflow-hidden mt-6">
      <header className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          Funil comercial — SDR × Closer
        </h2>
        <p className="text-xs text-slate-500">
          {rangeLabel} · coorte de leads do período · handoff no agendamento
        </p>
      </header>

      {/* Pré-venda (SDR) */}
      <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Pré-venda (SDR)
      </div>
      <Row label="Leads" count={leads} />
      <Row
        label="Agendaram"
        count={agendados}
        rate={{ value: pct(agendados, leads), meta: 11, of: "dos leads" }}
      />

      {/* Handoff */}
      <div className="px-4 py-1.5 bg-slate-50 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        ↓ handoff · avaliação marcada ↓
      </div>

      {/* Avaliação (Closer) */}
      <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Avaliação (Closer)
      </div>
      <Row
        label="Compareceram"
        count={compareceram}
        rate={{ value: pct(compareceram, agendados), meta: 70, of: "dos agendados" }}
      />
      <Row
        label="Fecharam"
        count={fecharam}
        rate={{ value: pct(fecharam, compareceram), meta: 20, of: "dos que compareceram" }}
      />

      <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">Conversão geral (lead → fechou)</span>
        <span className="text-sm font-bold text-emerald-700 tabular-nums">
          {pct(fecharam, leads)}%
        </span>
      </div>
    </section>
  );
}
