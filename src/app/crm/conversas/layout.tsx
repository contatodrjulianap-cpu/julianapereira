import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { ConversationList } from "./conversation-list";
import { loadConversasLeads } from "./load-leads";

export const dynamic = "force-dynamic";

export default async function ConversasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = crmUser?.role === "admin";

  let attendants: Array<{ id: string; display_name: string | null }> = [];
  if (isAdmin) {
    const { data: users } = await supabase
      .from("crm_users")
      .select("id, display_name")
      .order("display_name");
    attendants = users ?? [];
  }

  const leadsWithExtras = await loadConversasLeads(supabase, user.id, isAdmin);

  return (
    <CrmShell
      active="conversas"
      userEmail={user.email ?? ""}
      fullViewport
    >
      {/* fullViewport no shell força h-dvh — children flex-1 ocupa exatamente o
          espaço restante e o scroll fica preso na área de msgs do thread. */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <aside className="hidden md:flex md:flex-col md:w-[380px] md:shrink-0 md:min-w-0 border-r border-slate-200 bg-white overflow-hidden">
          <ConversationList
            initialLeads={leadsWithExtras}
            isAdmin={isAdmin}
            attendants={attendants}
          />
        </aside>
        <main className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden">
          {children}
        </main>
      </div>
    </CrmShell>
  );
}
