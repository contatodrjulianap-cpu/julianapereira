import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "./conversation-list";
import { loadConversasLeads } from "./load-leads";

export const dynamic = "force-dynamic";

export default async function ConversasPage() {
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
    <>
      {/* Mobile: lista cheia. Layout do desktop já mostra a lista na sidebar. */}
      <div className="flex-1 md:hidden flex flex-col min-h-0 min-w-0">
        <ConversationList
          initialLeads={leadsWithExtras}
          isAdmin={isAdmin}
          attendants={attendants}
        />
      </div>
      {/* Desktop: empty state (sidebar à esquerda já tem a lista) */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 text-center px-8">
        <span className="text-6xl mb-4">💬</span>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          Selecione uma conversa
        </h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Escolha um lead à esquerda pra abrir o histórico de mensagens.
        </p>
      </div>
    </>
  );
}
