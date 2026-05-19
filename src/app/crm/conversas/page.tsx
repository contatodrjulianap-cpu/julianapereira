import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ConversationList } from "./conversation-list";
import type { LeadFull } from "../lead-modal";

export const dynamic = "force-dynamic";

export type LastMessage = {
  direction: "inbound" | "outbound";
  text: string;
  created_at: string;
};

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
    <>
      {/* Mobile: lista cheia. Layout do desktop já mostra a lista na sidebar. */}
      <div className="flex-1 md:hidden flex flex-col min-h-0 min-w-0">
        <ConversationList initialLeads={leadsWithExtras} />
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
