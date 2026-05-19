import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ConversationThread } from "./conversation-thread";
import type { LeadFull } from "../../lead-modal";

export const dynamic = "force-dynamic";

export default async function ConversaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  const { data: messagesRaw } = await supabase
    .from("messages")
    .select("id, lead_id, direction, text, media_url, media_type, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });
  const messages = messagesRaw ?? [];

  // Signed URLs em batch pras mensagens com mídia
  const mediaPaths = messages
    .filter((m): m is typeof m & { media_url: string } => !!m.media_url)
    .map((m) => m.media_url);
  const signedByPath: Record<string, string> = {};
  if (mediaPaths.length > 0) {
    const admin2 = createServiceClient();
    const { data: signed } = await admin2.storage
      .from("wa-media")
      .createSignedUrls(mediaPaths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
    }
  }
  const messagesWithMedia = messages.map((m) => ({
    ...m,
    media_signed_url: m.media_url ? (signedByPath[m.media_url] ?? null) : null,
  }));

  let selfieSignedUrl: string | null = null;
  if (lead.selfie_url) {
    const admin = createServiceClient();
    const { data: signed } = await admin.storage
      .from("quiz-selfies")
      .createSignedUrl(lead.selfie_url, 60 * 60);
    selfieSignedUrl = signed?.signedUrl ?? null;
  }

  return (
    <ConversationThread
      lead={lead as LeadFull}
      initialMessages={messagesWithMedia}
      selfieSignedUrl={selfieSignedUrl}
    />
  );
}
