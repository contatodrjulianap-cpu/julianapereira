import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import {
  LogView,
  type LogEvent,
  type LeadLite,
  type LogDateRange,
} from "./log-view";

export const dynamic = "force-dynamic";

type SP = { preset?: string; from?: string; to?: string };

// Meia-noite (00:00) America/Sao_Paulo do dia-calendário SP de `date`,
// independente do TZ do servidor (Vercel = UTC). NÃO usar setHours: ele opera
// no TZ do processo, que em prod é UTC → "hoje" quebra após 21h BRT.
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

const DAY_MS = 24 * 60 * 60 * 1000;

// Resolve janela de tempo a partir dos searchParams. Boundary "hoje" = 00:00
// SP (BR é UTC-3). Tudo é convertido pra ISO UTC pra Supabase.
function resolveRange(sp: SP): LogDateRange {
  const now = new Date();
  const todayStart = spDayStart(now);
  const presets: Record<
    string,
    () => { start_at: string | null; end_at: string | null; label: string }
  > = {
    all: () => ({ start_at: null, end_at: null, label: "Tudo" }),
    today: () => ({
      start_at: todayStart.toISOString(),
      end_at: null,
      label: "Hoje",
    }),
    yesterday: () => {
      const s = new Date(todayStart.getTime() - DAY_MS);
      return {
        start_at: s.toISOString(),
        end_at: todayStart.toISOString(),
        label: "Ontem",
      };
    },
    "3d": () => ({
      start_at: new Date(todayStart.getTime() - 2 * DAY_MS).toISOString(),
      end_at: null,
      label: "Últimos 3 dias",
    }),
    "7d": () => ({
      start_at: new Date(todayStart.getTime() - 6 * DAY_MS).toISOString(),
      end_at: null,
      label: "Últimos 7 dias",
    }),
  };

  if (sp.from && sp.to) {
    const s = new Date(`${sp.from}T00:00:00-03:00`);
    const e = new Date(`${sp.to}T00:00:00-03:00`);
    e.setTime(e.getTime() + DAY_MS);
    return {
      preset: "custom",
      from: sp.from,
      to: sp.to,
      start_at: s.toISOString(),
      end_at: e.toISOString(),
      label: `${sp.from} → ${sp.to}`,
    };
  }

  const key = sp.preset && presets[sp.preset] ? sp.preset : "all";
  const r = presets[key]();
  return {
    preset: key as LogDateRange["preset"],
    start_at: r.start_at,
    end_at: r.end_at,
    label: r.label,
  };
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crm/login");
  }

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (crmUser?.role !== "admin") redirect("/crm");

  const params = await searchParams;
  const range = resolveRange(params);

  let query = supabase
    .from("event_log")
    .select(
      "id, type, direction, target, lead_id, status, payload, response, error, duration_ms, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (range.start_at) query = query.gte("created_at", range.start_at);
  if (range.end_at) query = query.lt("created_at", range.end_at);
  const { data: events } = await query;

  const leadIds = Array.from(
    new Set((events ?? []).map((e) => e.lead_id).filter(Boolean)),
  ) as string[];

  let leads: LeadLite[] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, name, phone")
      .in("id", leadIds);
    leads = (data ?? []) as LeadLite[];
  }

  return (
    <CrmShell active="log" userEmail={user.email ?? ""}>
      <LogView
        initialEvents={(events ?? []) as LogEvent[]}
        leads={leads}
        range={range}
      />
    </CrmShell>
  );
}
