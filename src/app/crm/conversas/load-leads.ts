import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { LeadFull } from "../lead-modal";

export type LastMessage = {
  direction: "inbound" | "outbound";
  text: string;
  created_at: string;
};

export type LeadWithExtras = LeadFull & {
  selfie_signed_url: string | null;
  last_message: LastMessage | null;
  unread: boolean;
};

// Preview pra mensagens sem texto (mídia), estilo WhatsApp.
function mediaLabel(mediaType: string | null): string {
  if (!mediaType) return "";
  if (mediaType.startsWith("image")) return "📷 Foto";
  if (mediaType.startsWith("audio")) return "🎤 Áudio";
  if (mediaType.startsWith("video")) return "🎥 Vídeo";
  if (mediaType.startsWith("application") || mediaType.includes("pdf"))
    return "📄 Documento";
  return "📎 Mídia";
}

// Não-lido estilo WhatsApp: a última mensagem é do lead (inbound) e chegou
// depois da última vez que a conversa foi aberta (ou nunca foi aberta).
function isUnread(lead: LeadFull, last: LastMessage | null): boolean {
  if (!last || last.direction !== "inbound") return false;
  if (!lead.last_read_at) return true;
  return new Date(lead.last_read_at).getTime() < new Date(last.created_at).getTime();
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

// Arquétipos prioritários que NUNCA podem cair fora da janela de recência.
const PRIORITY_ARCHETYPES = ["PRONTA", "ESPERANCOSA"] as const;

/**
 * Carrega os leads da tela de Conversas (lista da sidebar + mobile).
 *
 * A lista principal vem ordenada por recência (last_message_at desc) e é capada
 * pelo max-rows do PostgREST (~1000). Com mais de 1000 leads no total, os
 * PRONTA/ESPERANCOSA antigos — sem mensagem recente — caíam fora dessa janela e
 * sumiam da visualização. Por isso uma 2ª query traz o subset prioritário
 * COMPLETO e mescla por id. O subset é pequeno, então não pesa a tela.
 *
 * O client (ConversationList) reordena por last_message_at, então a ordem do
 * merge é irrelevante aqui.
 */
export async function loadConversasLeads(
  supabase: SupabaseServer,
  userId: string,
  isAdmin: boolean,
): Promise<LeadWithExtras[]> {
  // 1) Janela por recência (capada pelo max-rows do PostgREST).
  let recentQuery = supabase
    .from("leads")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(isAdmin ? 2000 : 200);
  if (!isAdmin) recentQuery = recentQuery.eq("assigned_owner_id", userId);
  const { data: recentRaw } = await recentQuery;
  const leads = (recentRaw ?? []) as LeadFull[];

  // 2) Subset prioritário completo (PRONTA/ESPERANCOSA), mesclado por id.
  let hotQuery = supabase
    .from("leads")
    .select("*")
    .in("archetype", PRIORITY_ARCHETYPES as unknown as string[])
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (!isAdmin) hotQuery = hotQuery.eq("assigned_owner_id", userId);
  const { data: hotRaw } = await hotQuery;
  const seen = new Set(leads.map((l) => l.id));
  for (const l of (hotRaw ?? []) as LeadFull[]) {
    if (!seen.has(l.id)) {
      leads.push(l);
      seen.add(l.id);
    }
  }

  // 3) Última mensagem por lead — via RPC DISTINCT ON, em lotes.
  // Evita o max-rows (1000) do PostgREST: um .in() sem limite sobre 16k+
  // mensagens só trazia preview pros leads mais recentes. A RPC retorna 1 linha
  // por lead; lotes de 800 ids mantêm cada resposta abaixo do cap.
  const lastMessageByLead: Record<string, LastMessage> = {};
  if (leads.length > 0) {
    const ids = leads.map((l) => l.id);
    const CHUNK = 800;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data: msgs } = await supabase.rpc("last_messages_for_leads", {
        p_lead_ids: slice,
      });
      for (const m of (msgs ?? []) as Array<{
        lead_id: string;
        direction: "inbound" | "outbound";
        text: string | null;
        media_type: string | null;
        created_at: string;
      }>) {
        lastMessageByLead[m.lead_id] = {
          direction: m.direction,
          text: m.text?.trim() ? m.text : mediaLabel(m.media_type),
          created_at: m.created_at,
        };
      }
    }
  }

  // 4) Signed URLs das selfies.
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

  return leads.map((l) => {
    const last = lastMessageByLead[l.id] ?? null;
    return {
      ...l,
      selfie_signed_url: l.selfie_url ? (signedByPath[l.selfie_url] ?? null) : null,
      last_message: last,
      unread: isUnread(l, last),
    };
  });
}
