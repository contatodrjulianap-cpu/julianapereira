import Link from "next/link";

// Sub-nav fixo no topo das 3 telas de Ads (Campanhas / Ads todos / Drilldown).

export function AdsTabs({
  active,
  campaignName,
  campaignId,
  qs,
}: {
  active: "campaigns" | "ads" | "drilldown";
  campaignName?: string;
  campaignId?: string;
  qs?: string; // querystring atual pra preservar period/sort entre abas
}) {
  const suffix = qs && qs.length > 0 ? `?${qs}` : "";
  return (
    <nav className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-white border-b border-slate-200 mb-3">
      <div className="flex gap-2 items-center overflow-x-auto">
        <Link
          href={`/crm/ads${suffix}`}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${
            active === "campaigns"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          📊 Campanhas
        </Link>
        <Link
          href={`/crm/ads/all${suffix}`}
          className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${
            active === "ads"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          🎯 Ads (todos)
        </Link>
        {active === "drilldown" && campaignName && (
          <>
            <span className="text-slate-400 text-xs">/</span>
            <span
              className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-rose-100 text-rose-800 truncate max-w-[300px]"
              title={campaignName}
            >
              📋 {campaignName}
            </span>
            {campaignId && (
              <Link
                href={`/crm/ads${suffix}`}
                className="shrink-0 ml-auto text-[11px] text-slate-500 hover:text-slate-700"
              >
                ← Voltar
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
