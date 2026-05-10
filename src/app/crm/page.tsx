import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmDashboard } from "./dashboard";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crm/login");
  }

  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone, source, last_message_at, created_at, quiz_goal, quiz_budget")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return <CrmDashboard initialLeads={leads ?? []} userEmail={user.email ?? ""} />;
}
