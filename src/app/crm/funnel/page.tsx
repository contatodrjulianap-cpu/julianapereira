import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { FunnelView, type FunnelMetrics, type FunnelRange } from "./funnel-view";
import {
  AttendantPerformance,
  type AttendantStats,
} from "./attendant-performance";

export const dynamic = "force-dynamic";

type SP = { preset?: string; from?: string; to?: string };

function resolveRange(sp: SP): FunnelRange {
  // BR timezone (-03:00). Tudo aqui é UTC, mas presets são pensados em horário local.
  // Pra Sakura (Brasil), boundary "hoje" = 00:00 horário SP = 03:00 UTC.
  const now = new Date();
  const presetMap: Record<string, () => { start: Date; end: Date; label: string }> = {
    today: () => {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end: now, label: "Hoje" };
    },
    yesterday: () => {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
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
    const start = new Date(`${sp.from}T00:00:00`);
    const end = new Date(`${sp.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
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

  const params = await searchParams;
  const range = resolveRange(params);

  const admin = createServiceClient();
  const { data, error } = await admin.rpc("quiz_funnel_metrics", {
    start_at: range.start_at,
    end_at: range.end_at,
  });

  const metrics: FunnelMetrics = (data as FunnelMetrics) ?? {
    start_at: range.start_at,
    end_at: range.end_at,
    pageviews: 0,
    leads_total: 0,
    wa_clicks: 0,
    phone_matched: 0,
    by_step: [],
  };

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
    else if (["contacted", "qualified", "proposal"].includes(l.status ?? ""))
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

  return (
    <CrmShell active="funnel" userEmail={user.email ?? ""}>
      <FunnelView metrics={metrics} error={error?.message ?? null} range={range} />
      <AttendantPerformance stats={attendantStats} rangeLabel={range.label} />
    </CrmShell>
  );
}
