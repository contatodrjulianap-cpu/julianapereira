import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";
import { NotificacoesClient } from "./notificacoes-client";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  return (
    <CrmShell active="voce" userEmail={user.email ?? ""}>
      <NotificacoesClient />
    </CrmShell>
  );
}
