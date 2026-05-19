import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  return (
    <CrmShell active="status" userEmail={user.email ?? ""}>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
        <span className="text-5xl mb-4">✨</span>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Status em breve
        </h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Aqui vão aparecer follow-ups, urgências e insights da operação.
        </p>
      </div>
    </CrmShell>
  );
}
