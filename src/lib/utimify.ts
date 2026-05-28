// Cliente do Utimify MCP (Model Context Protocol).
// Fonte: env UTMIFY_MCP_URL (URL completa com ?token=...&resources=...).
// Sempre opera no dashboard "Principal" (id em DASHBOARD_PRINCIPAL_ID), porque
// é onde estão as campanhas Meta Ads SAK da clínica Sakura.

const DASHBOARD_PRINCIPAL_ID = "68c076b86776d4a0bc28fa22";

// Schema simplificado do que usamos. O Utimify retorna muito mais campos,
// mas só desnormalizamos o que aparece no dashboard /crm/ads.
export type AdObject = {
  id: string;
  name: string;
  level: "account" | "campaign" | "adset" | "ad";
  status: string;
  effectiveStatus: string;
  campaignId: string | null;
  adsetId: string | null;
  adId: string | null;
  // Custo / performance Meta (em centavos onde indicado)
  spend: number; // centavos
  impressions: number;
  inlineLinkClicks: number;
  cpm: number; // centavos
  landingPageViews: number;
  leads: number; // lead events do Meta (FB CAPI)
  videoViews: number;
  videoViews3Seconds: number;
  retention: number;
  // Métricas vindas das vendas do dashboard (zero pra Sakura sem Kiwify)
  revenue: number;
  profit: number;
  roas: number;
  // Budget
  dailyBudget: number | null;
  lifetimeBudget: number | null;
};

type McpResponse<T> = { result?: { content: { type: string; text: string }[] }; error?: unknown };

async function callMcp<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const url = process.env.UTMIFY_MCP_URL;
  if (!url) throw new Error("UTMIFY_MCP_URL não configurado");

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json,text/event-stream",
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Utimify MCP ${res.status}: ${await res.text()}`);

  const data: McpResponse<unknown> = await res.json();
  if (data.error)
    throw new Error(`Utimify MCP error: ${JSON.stringify(data.error)}`);
  const text = data.result?.content?.[0]?.text;
  if (!text) throw new Error("Utimify MCP: resposta sem content");
  return JSON.parse(text) as T;
}

export type DateRange = { from: string; to: string };

// Helpers de range em fuso SP (-03:00)
export function dateRangeForDays(days: number): DateRange {
  const now = new Date();
  const sp = (d: Date) => new Date(d.getTime() - 3 * 3600_000); // approx
  const today = sp(now);
  const startToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const startDay = new Date(
    startToday.getTime() - (days - 1) * 86400_000,
  );
  const endToday = new Date(startToday.getTime() + 86400_000 - 1);
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return {
    from: `${fmt(startDay)}T00:00:00-03:00`,
    to: `${fmt(endToday)}T23:59:59-03:00`,
  };
}

// Lista campanhas SAK do dashboard Principal pro período
export async function getSakCampaigns(range: DateRange): Promise<AdObject[]> {
  type Result = { results?: AdObject[] };
  const res = await callMcp<Result>("get_meta_ad_objects", {
    dashboardId: DASHBOARD_PRINCIPAL_ID,
    dateRange: range,
    level: "campaign",
    nameContains: "SAK",
  });
  return res.results ?? [];
}

// Lista adsets/ads de uma campanha específica (drilldown).
// Filtra TODOS os objetos do level desejado e mantém só os que pertencem à campaignId.
// Não dá pra filtrar direto por campaignId na API do Utimify — fazemos client-side.
export async function getCampaignChildren(
  campaignId: string,
  range: DateRange,
  level: "adset" | "ad",
): Promise<AdObject[]> {
  type Result = { results?: AdObject[] };
  const res = await callMcp<Result>("get_meta_ad_objects", {
    dashboardId: DASHBOARD_PRINCIPAL_ID,
    dateRange: range,
    level,
    nameContains: "SAK", // ainda filtra por SAK pra reduzir payload
  });
  const all = res.results ?? [];
  return all.filter((a) => a.campaignId === campaignId);
}

// Detalhe de uma campanha específica
export async function getCampaignById(
  campaignId: string,
  range: DateRange,
): Promise<AdObject | null> {
  type Result = { results?: AdObject[] };
  const res = await callMcp<Result>("get_meta_ad_objects", {
    dashboardId: DASHBOARD_PRINCIPAL_ID,
    dateRange: range,
    level: "campaign",
    nameContains: "SAK",
  });
  return (res.results ?? []).find((c) => (c.campaignId ?? c.id) === campaignId) ?? null;
}

// Summary do dashboard Principal pro período
export type DashboardSummary = {
  ads?: {
    meta?: { spent: number; clicks: number; pageViews: number; leads: number };
  };
  ordersCount?: { total: number; approved: number };
  analytics?: { roas: number | null; profit: number; costPerLead: number | null };
};

export async function getPrincipalSummary(
  range: DateRange,
): Promise<DashboardSummary> {
  return await callMcp<DashboardSummary>("get_dashboard_summary", {
    dashboardId: DASHBOARD_PRINCIPAL_ID,
    dateRange: range,
    timeZoneIana: "UTC-3",
  });
}
