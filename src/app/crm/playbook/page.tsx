import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import PlaybookView from "./playbook-view";

export const dynamic = "force-dynamic";

export default async function PlaybookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  return (
    <CrmShell active="playbook" userEmail={user.email ?? ""}>
      <PlaybookView />
    </CrmShell>
  );
}
