import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ENGAGED_STATUSES } from "@/lib/lead-status";
import { CrmShell } from "../crm-shell";
import { FunnelView, type FunnelMetrics, type FunnelRange } from "./funnel-view";
import {
  AttendantPerformance,
  type AttendantStats,
} from "./attendant-performance";
import { UtmBreakdown, type UtmRow } from "./utm-breakdown";

export const dynamic = "force-dynamic";

type SP = { preset?: string; from?: string; to?: string; variant?: string };

// Meia-noite (00:00) America/Sao_Paulo do dia-calendário SP de `date`,
// independente do timezone do servidor (Vercel = UTC). Brasil não tem DST
// desde 2019, então BRT = UTC-3 constante. NÃO usar setHours: ele opera no TZ
// local do processo, que em prod é UTC → janela "hoje" quebra após 21h BRT.
function spDayStart(date: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return new Date(`${y}-${m}-${d}T00:00:00-03:00`);
}

function resolveRange(sp: SP): FunnelRange {
  // BR timezone (-03:00). Tudo aqui é UTC, mas presets são pensados em horário local.
  // Pra Sakura (Brasil), boundary "hoje" = 00:00 horário SP = 03:00 UTC.
  const now = new Date();
  const presetMap: Record<string, () => { start: Date; end: Date; label: string }> = {
    today: () => {
      const start = spDayStart(now);
      return { start, end: now, label: "Hoje" };
    },
    yesterday: () => {
      const end = spDayStart(now);
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { start, end, label: "Ontem" };
    },
    "7d": () => {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end: now, label: "Últimos 7 dias" };
    },
    "30d": () => {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end: now, label: "Últimos 30 dias" };
    },
    "90d": () => {
      const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { start, end: now, label: "Últimos 90 dias" };
    },
  };

  // Custom range: ?from=YYYY-MM-DD&to=YYYY-MM-DD (interpretado como meia-noite local → meia-noite local +1)
  if (sp.from && sp.to) {
    // Offset -03:00 explícito: sem ele o parse usa o TZ do servidor (UTC em prod).
    const start = new Date(`${sp.from}T00:00:00-03:00`);
    const end = new Date(`${sp.to}T00:00:00-03:00`);
    end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
    return {
      preset: "custom",
      from: sp.from,
      to: sp.to,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      label: `${formatBR(sp.from)} → ${formatBR(sp.to)}`,
    };
  }

  const presetKey = (sp.preset && presetMap[sp.preset] ? sp.preset : "30d") as
    | "today"
    | "yesterday"
    | "7d"
    | "30d"
    | "90d";
  const { start, end, label } = presetMap[presetKey]();
  return {
    preset: presetKey,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    label,
  };
}

function formatBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (crmUser?.role !== "admin") redirect("/crm");

  const params = await searchParams;
  const range = resolveRange(params);
  const variant: "resina" | "porcelana" | null =
    params.variant === "resina" || params.variant === "porcelana"
      ? params.variant
      : null;
  range.variant = variant;

  const admin = createServiceClient();

  // 3 chamadas em paralelo: combinado (null) + quiz isolado + bot/typebot isolado.
  // RPC nova aceita param surface; ver migration 20260524020000.
  const [all, quizOnly, botOnly] = await Promise.all([
    admin.rpc("quiz_funnel_metrics", {
      start_at: range.start_at,
      end_at: range.end_at,
      variant,
      surface: null,
    }),
    admin.rpc("quiz_funnel_metrics", {
      start_at: range.start_at,
      end_at: range.end_at,
      variant,
      surface: "quiz",
    }),
    admin.rpc("quiz_funnel_metrics", {
      start_at: range.start_at,
      end_at: range.end_at,
      variant,
      surface: "bot",
    }),
  ]);
  const error = all.error ?? quizOnly.error ?? botOnly.error;

  const emptyMetrics: FunnelMetrics = {
    start_at: range.start_at,
    end_at: range.end_at,
    pageviews: 0,
    leads_total: 0,
    wa_clicks: 0,
    phone_matched: 0,
    by_step: [],
  };
  const metrics: FunnelMetrics = (all.data as FunnelMetrics) ?? emptyMetrics;
  const metricsQuiz: FunnelMetrics =
    (quizOnly.data as FunnelMetrics) ?? emptyMetrics;
  const metricsBot: FunnelMetrics =
    (botOnly.data as FunnelMetrics) ?? emptyMetrics;

  // Breakdown por atendente (admin only) — query simples, sem RPC novo.
  // Agrega leads atribuídos no período por owner_id.
  const { data: ownerLeads } = await admin
    .from("leads")
    .select("assigned_owner_id, status, created_at")
    .not("assigned_owner_id", "is", null)
    .gte("created_at", range.start_at)
    .lt("created_at", range.end_at);

  const { data: salesUsers } = await admin
    .from("crm_users")
    .select("id, display_name, role")
    .eq("role", "sales");

  const statsMap = new Map<
    string,
    { total: number; contacted: number; won: number; lost: number }
  >();
  for (const l of ownerLeads ?? []) {
    if (!l.assigned_owner_id) continue;
    const cur =
      statsMap.get(l.assigned_owner_id) ?? { total: 0, contacted: 0, won: 0, lost: 0 };
    cur.total += 1;
    if (l.status === "won") cur.won += 1;
    else if (l.status === "lost") cur.lost += 1;
    else if (ENGAGED_STATUSES.includes(l.status ?? ""))
      cur.contacted += 1;
    statsMap.set(l.assigned_owner_id, cur);
  }

  const attendantStats: AttendantStats[] = (salesUsers ?? []).map((u) => {
    const s = statsMap.get(u.id) ?? { total: 0, contacted: 0, won: 0, lost: 0 };
    return {
      ownerId: u.id,
      displayName: u.display_name,
      total: s.total,
      contacted: s.contacted,
      won: s.won,
      lost: s.lost,
      responseTimeAvgMs: null, // futuro: derivar de event_log/messages
    };
  });

  // Breakdown UTM: agrega leads do quiz com utm_source preenchido no período,
  // agrupado por (source, campaign, medium). Métricas: total, distribuição por
  // arquétipo e funil status (em negociação, fechou).
  const { data: utmLeads } = await admin
    .from("leads")
    .select("utm_source, utm_medium, utm_campaign, archetype, status")
    .not("utm_source", "is", null)
    .gte("created_at", range.start_at)
    .lt("created_at", range.end_at);

  const utmMap = new Map<string, UtmRow>();
  for (const l of utmLeads ?? []) {
    const source = l.utm_source ?? "(none)";
    const campaign = l.utm_campaign ?? null;
    const medium = l.utm_medium ?? null;
    const key = `${source}|${campaign ?? ""}|${medium ?? ""}`;
    const cur =
      utmMap.get(key) ??
      ({
        source,
        medium,
        campaign,
        total: 0,
        pronta: 0,
        esperancosa: 0,
        cetica: 0,
        won: 0,
        contacted: 0,
      } as UtmRow);
    cur.total += 1;
    if (l.archetype === "PRONTA") cur.pronta += 1;
    else if (l.archetype === "ESPERANCOSA") cur.esperancosa += 1;
    else if (l.archetype === "CETICA") cur.cetica += 1;
    if (l.status === "won") cur.won += 1;
    if (ENGAGED_STATUSES.includes(l.status ?? "")) cur.contacted += 1;
    utmMap.set(key, cur);
  }
  const utmRows = Array.from(utmMap.values()).sort((a, b) => b.total - a.total);

  return (
    <CrmShell active="funnel" userEmail={user.email ?? ""}>
      <FunnelView
        metrics={metrics}
        metricsQuiz={metricsQuiz}
        metricsBot={metricsBot}
        error={error?.message ?? null}
        range={range}
      />
      <AttendantPerformance stats={attendantStats} rangeLabel={range.label} />
      <UtmBreakdown rows={utmRows} rangeLabel={range.label} />
    </CrmShell>
  );
}
