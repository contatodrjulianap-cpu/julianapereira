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

// Resolve janela de tempo a partir dos searchParams. Boundary "hoje" = 00:00
// SP (BR é UTC-3). Tudo é convertido pra ISO UTC pra Supabase.
function resolveRange(sp: SP): LogDateRange {
  const presets: Record<
    string,
    () => { start_at: string | null; end_at: string | null; label: string }
  > = {
    all: () => ({ start_at: null, end_at: null, label: "Tudo" }),
    today: () => {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      return { start_at: s.toISOString(), end_at: null, label: "Hoje" };
    },
    yesterday: () => {
      const s = new Date();
      s.setDate(s.getDate() - 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(s);
      e.setDate(e.getDate() + 1);
      return {
        start_at: s.toISOString(),
        end_at: e.toISOString(),
        label: "Ontem",
      };
    },
    "3d": () => {
      const s = new Date();
      s.setDate(s.getDate() - 2);
      s.setHours(0, 0, 0, 0);
      return {
        start_at: s.toISOString(),
        end_at: null,
        label: "Últimos 3 dias",
      };
    },
    "7d": () => {
      const s = new Date();
      s.setDate(s.getDate() - 6);
      s.setHours(0, 0, 0, 0);
      return {
        start_at: s.toISOString(),
        end_at: null,
        label: "Últimos 7 dias",
      };
    },
  };

  if (sp.from && sp.to) {
    const s = new Date(`${sp.from}T00:00:00`);
    const e = new Date(`${sp.to}T00:00:00`);
    e.setDate(e.getDate() + 1);
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
