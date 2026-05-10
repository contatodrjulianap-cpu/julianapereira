import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { getQuizConfig } from "@/lib/quiz-config";
import { BuilderView } from "./builder-view";

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crm/login");
  }

  const config = await getQuizConfig();

  return (
    <CrmShell active="builder" userEmail={user.email ?? ""}>
      <BuilderView initialConfig={config} />
    </CrmShell>
  );
}
