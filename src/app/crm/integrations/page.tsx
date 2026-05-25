import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { getIntegrationConfig } from "@/lib/integration-config-server";
import { IntegrationsView } from "./integrations-view";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
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

  const config = await getIntegrationConfig();

  return (
    <CrmShell active="integrations" userEmail={user.email ?? ""}>
      <IntegrationsView initialConfig={config} />
    </CrmShell>
  );
}
