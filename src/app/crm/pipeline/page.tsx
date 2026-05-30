import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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
    .limit(3000);

  if (!isAdmin) {
    leadsQuery = leadsQuery.eq("assigned_owner_id", user.id);
  }

  // Lookup atendentes pra mostrar coluna "Responsável" (id → display_name)
  const [{ data: leads }, { data: users }] = await Promise.all([
    leadsQuery,
    supabase.from("crm_users").select("id, display_name, role"),
  ]);

  // Signed URLs (1h) pra thumbs de selfie aparecerem direto na lista.
  // Gera em batch — uma única chamada pro Storage.
  const paths = (leads ?? [])
    .filter((l): l is typeof l & { selfie_url: string } => !!l.selfie_url)
    .map((l) => l.selfie_url);
  const signedByPath: Record<string, string> = {};
  if (paths.length > 0) {
    const admin = createServiceClient();
    const { data: signed } = await admin.storage
      .from("quiz-selfies")
      .createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
    }
  }
  const leadsWithSelfies = (leads ?? []).map((l) => ({
    ...l,
    selfie_signed_url: l.selfie_url ? (signedByPath[l.selfie_url] ?? null) : null,
  }));

  return (
    <CrmShell active="pipeline" userEmail={user.email ?? ""}>
      <PipelineView
        initialLeads={leadsWithSelfies}
        users={users ?? []}
        isAdmin={isAdmin}
      />
    </CrmShell>
  );
}
