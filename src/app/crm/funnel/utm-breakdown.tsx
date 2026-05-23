// Bloco "Origem de tráfego (UTM)" — renderizado abaixo de AttendantPerformance.
// Server component. Recebe array agregado pré-computado na page.

export type UtmRow = {
  source: string;
  medium: string | null;
  campaign: string | null;
  total: number;
  pronta: number;
  esperancosa: number;
  cetica: number;
  won: number;
  contacted: number;
};

export function UtmBreakdown({
  rows,
  rangeLabel,
}: {
  rows: UtmRow[];
  rangeLabel: string;
}) {
  const totalLeads = rows.reduce((s, r) => s + r.total, 0);

  return (
    <section className="bg-white border border-slate-200 rounded-md overflow-hidden mt-6">
      <header className="px-4 py-3 border-b border-slate-200 flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Origem de tráfego (UTM)
          </h2>
          <p className="text-xs text-slate-500">
            {rangeLabel} · {totalLeads} {totalLeads === 1 ? "lead" : "leads"} via quiz · agrupado por source/campaign
          </p>
        </div>
      </header>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          Nenhum lead chegou pelo quiz com UTM no período.
          <br />
          <span className="text-xs text-slate-400">
            Dica: rode anúncios com destino{" "}
            <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">
              clinicasakura.org/quiz?utm_source=meta&utm_campaign=…
            </code>
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <Th>Source</Th>
                <Th>Campanha</Th>
                <Th>Medium</Th>
                <Th align="right">Leads</Th>
                <Th align="right">Pronta</Th>
                <Th align="right">Esp.</Th>
                <Th align="right">Cét.</Th>
                <Th align="right">Em neg.</Th>
                <Th align="right">Fechou</Th>
                <Th align="right">Taxa</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rate = r.total > 0 ? r.won / r.total : 0;
                const rateClass =
                  rate >= 0.3
                    ? "bg-emerald-100 text-emerald-800"
                    : rate >= 0.15
                      ? "bg-amber-100 text-amber-800"
                      : rate > 0
                        ? "bg-slate-100 text-slate-700"
                        : "bg-slate-50 text-slate-400";
                const pctPronta = r.total > 0 ? (r.pronta / r.total) * 100 : 0;
                return (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {r.source}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 text-xs">
                      {r.campaign ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">
                      {r.medium ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-900 font-semibold">
                      {r.total}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {r.pronta}
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({pctPronta.toFixed(0)}%)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {r.esperancosa}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {r.cetica}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {r.contacted}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700 font-semibold">
                      {r.won}
                    </td>
                    <td className="px-3 py-2.5 text-right">
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
      )}
    </section>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-2 font-semibold border-b border-slate-200 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}
