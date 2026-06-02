import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { AgendamentosView } from "./agendamentos-view";

export const dynamic = "force-dynamic";

export default async function AgendamentosPage() {
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

  // Só leads com call agendada (scheduled_at preenchido). RLS no-admin: só os seus.
  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true })
    .limit(3000);

  if (!isAdmin) {
    leadsQuery = leadsQuery.eq("assigned_owner_id", user.id);
  }

  const [{ data: leads }, { data: users }] = await Promise.all([
    leadsQuery,
    supabase.from("crm_users").select("id, display_name, role"),
  ]);

  // Signed URLs (1h) pra thumbs de selfie, igual ao pipeline.
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
    <CrmShell active="agendamentos" userEmail={user.email ?? ""}>
      <AgendamentosView
        initialLeads={leadsWithSelfies}
        users={users ?? []}
        isAdmin={isAdmin}
      />
    </CrmShell>
  );
}
