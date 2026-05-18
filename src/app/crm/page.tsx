import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "./crm-shell";
import { CrmInbox } from "./crm-inbox";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crm/login");
  }

  // Lookup role: admin vê tudo, sales vê só os leads atribuídos a si.
  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = crmUser?.role === "admin";

  let query = supabase
    .from("leads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (!isAdmin) {
    query = query.eq("assigned_owner_id", user.id);
  }
  const { data: leads } = await query;

  return (
    <CrmShell active="inbox" userEmail={user.email ?? ""}>
      <CrmInbox initialLeads={leads ?? []} />
    </CrmShell>
  );
}
