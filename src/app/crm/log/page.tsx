import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { LogView, type LogEvent, type LeadLite } from "./log-view";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crm/login");
  }

  const { data: events } = await supabase
    .from("event_log")
    .select(
      "id, type, direction, target, lead_id, status, payload, response, error, duration_ms, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

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
      <LogView initialEvents={(events ?? []) as LogEvent[]} leads={leads} />
    </CrmShell>
  );
}
