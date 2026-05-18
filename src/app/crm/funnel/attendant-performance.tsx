// Bloco "Performance por atendente" — renderizado abaixo do FunnelView na page.
// Server component. Recebe array agregado pré-computado na page (sem RPC novo).

export type AttendantStats = {
  ownerId: string;
  displayName: string;
  total: number;
  contacted: number;
  won: number;
  lost: number;
  responseTimeAvgMs: number | null;
};

export function AttendantPerformance({
  stats,
  rangeLabel,
}: {
  stats: AttendantStats[];
  rangeLabel: string;
}) {
  if (stats.length === 0) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-md overflow-hidden mt-6">
      <header className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-base font-bold tracking-tight text-slate-900">
          Performance por atendente
        </h2>
        <p className="text-xs text-slate-500">
          {rangeLabel} · taxa = ganhos / leads atribuídos no período
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <Th>Atendente</Th>
              <Th>Recebeu</Th>
              <Th>Em negociação</Th>
              <Th>Fechou</Th>
              <Th>Perdeu</Th>
              <Th>Taxa</Th>
            </tr>
          </thead>
          <tbody>
            {stats.map((p) => {
              const rate = p.total > 0 ? p.won / p.total : 0;
              const rateClass =
                rate >= 0.3
                  ? "bg-emerald-100 text-emerald-800"
                  : rate >= 0.15
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700";
              return (
                <tr key={p.ownerId} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium text-slate-900">{p.displayName}</td>
                  <td className="px-3 py-3 text-slate-700">{p.total}</td>
                  <td className="px-3 py-3 text-slate-700">{p.contacted}</td>
                  <td className="px-3 py-3 text-emerald-700 font-semibold">{p.won}</td>
                  <td className="px-3 py-3 text-red-600">{p.lost}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${rateClass}`}
                    >
                      {(rate * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-semibold border-b border-slate-200">
      {children}
    </th>
  );
}
