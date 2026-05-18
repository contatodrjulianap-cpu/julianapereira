import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { PipelineView } from "./pipeline-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
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
  const isAdmin = crmUser?.role === "admin";

  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!isAdmin) {
    leadsQuery = leadsQuery.eq("assigned_owner_id", user.id);
  }

  // Lookup atendentes pra mostrar coluna "Responsável" (id → display_name)
  const [{ data: leads }, { data: users }] = await Promise.all([
    leadsQuery,
    supabase.from("crm_users").select("id, display_name, role"),
  ]);

  return (
    <CrmShell active="pipeline" userEmail={user.email ?? ""}>
      <PipelineView
        initialLeads={leads ?? []}
        users={users ?? []}
        isAdmin={isAdmin}
      />
    </CrmShell>
  );
}
