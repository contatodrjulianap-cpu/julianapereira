import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { ConversationList } from "./conversation-list";
import type { LeadFull } from "../lead-modal";
import type { LastMessage } from "./page";

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

  let leadsQuery = supabase
    .from("leads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (!isAdmin) leadsQuery = leadsQuery.eq("assigned_owner_id", user.id);
  const { data: leadsRaw } = await leadsQuery;
  const leads = (leadsRaw ?? []) as LeadFull[];

  const lastMessageByLead: Record<string, LastMessage> = {};
  if (leads.length > 0) {
    const ids = leads.map((l) => l.id);
    const { data: msgs } = await supabase
      .from("messages")
      .select("lead_id, direction, text, created_at")
      .in("lead_id", ids)
      .order("created_at", { ascending: false });
    for (const m of msgs ?? []) {
      if (!lastMessageByLead[m.lead_id]) {
        lastMessageByLead[m.lead_id] = {
          direction: m.direction,
          text: m.text,
          created_at: m.created_at,
        };
      }
    }
  }

  const paths = leads
    .filter((l): l is LeadFull & { selfie_url: string } => !!l.selfie_url)
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
  const leadsWithExtras = leads.map((l) => ({
    ...l,
    selfie_signed_url: l.selfie_url ? (signedByPath[l.selfie_url] ?? null) : null,
    last_message: lastMessageByLead[l.id] ?? null,
  }));

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
          <ConversationList initialLeads={leadsWithExtras} />
        </aside>
        <main className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden">
          {children}
        </main>
      </div>
    </CrmShell>
  );
}
