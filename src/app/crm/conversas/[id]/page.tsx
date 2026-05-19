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

  const { data: messages } = await supabase
    .from("messages")
    .select("id, lead_id, direction, text, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

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
      initialMessages={messages ?? []}
      selfieSignedUrl={selfieSignedUrl}
    />
  );
}
