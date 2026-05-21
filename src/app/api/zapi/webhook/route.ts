import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { ZapiWebhookPayload } from "@/lib/zapi";
import { logEvent } from "@/lib/event-log";
import { ownerForInstance } from "@/lib/wa-router";

type ParsedContent = {
  text: string | null;
  media_url: string | null;
  media_type: string | null;
};

async function parseAndStoreMedia(
  payload: ZapiWebhookPayload,
  leadId: string,
  admin: ReturnType<typeof createServiceClient>,
): Promise<ParsedContent> {
  if (payload.text?.message) {
    return { text: payload.text.message, media_url: null, media_type: null };
  }

  let url: string | undefined;
  let mediaType: string | undefined;
  let mimeType: string | undefined;
  let ext: string | undefined;
  let label: string | null = null;

  if (payload.image?.imageUrl) {
    url = payload.image.imageUrl;
    mediaType = "image";
    mimeType = payload.image.mimeType ?? "image/jpeg";
    ext = "jpg";
    label = payload.image.caption ?? null;
  } else if (payload.audio?.audioUrl) {
    url = payload.audio.audioUrl;
    mediaType = "audio";
    mimeType = payload.audio.mimeType ?? "audio/ogg";
    ext = mimeType.includes("mpeg") ? "mp3" : "ogg";
    label = "[áudio]";
  } else if (payload.video?.videoUrl) {
    url = payload.video.videoUrl;
    mediaType = "video";
    mimeType = payload.video.mimeType ?? "video/mp4";
    ext = "mp4";
    label = payload.video.caption ?? "[vídeo]";
  } else if (payload.document?.documentUrl) {
    url = payload.document.documentUrl;
    mediaType = "document";
    mimeType = payload.document.mimeType ?? "application/octet-stream";
    const fileName = payload.document.fileName;
    ext =
      fileName?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) ||
      "bin";
    label = fileName ?? "[documento]";
  } else if (payload.sticker?.stickerUrl) {
    url = payload.sticker.stickerUrl;
    mediaType = "image";
    mimeType = "image/webp";
    ext = "webp";
    label = "[sticker]";
  } else if (payload.contact) {
    const name = payload.contact.displayName ?? "";
    return {
      text: name ? `[contato: ${name}]` : "[contato]",
      media_url: null,
      media_type: null,
    };
  } else if (payload.location) {
    return { text: "[localização]", media_url: null, media_type: null };
  } else {
    return { text: "[mídia sem conteúdo]", media_url: null, media_type: null };
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`download HTTP ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    const path = `${leadId}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("wa-media")
      .upload(path, buffer, { contentType: mimeType, upsert: false });
    if (upErr) throw upErr;
    return { text: label, media_url: path, media_type: mediaType };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await logEvent({
      type: "zapi_webhook_media_upload",
      direction: "internal",
      target: "supabase",
      lead_id: leadId,
      status: "failed",
      payload: { media_type: mediaType, url: url.slice(0, 80) },
      error: msg,
    });
    return {
      text: label ?? `[${mediaType} — falha download]`,
      media_url: null,
      media_type: null,
    };
  }
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const payload = (await req.json()) as ZapiWebhookPayload;

  // Ignora mensagens enviadas pela própria conta (echo)
  if (payload.fromMe) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "skipped",
      payload,
      error: "fromMe=true",
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ ignored: "fromMe" });
  }

  // Ignora grupos por enquanto
  if (payload.isGroup) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "skipped",
      payload,
      error: "isGroup=true",
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ ignored: "group" });
  }

  const phone = payload.phone;
  if (!phone) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "failed",
      payload,
      error: "missing phone",
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ error: "missing phone" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Resolve owner pelo instance_id da Z-API (qual número/atendente recebeu).
  // Se não achar (instância não cadastrada em wa_numbers), segue sem atribuir.
  const owner = payload.instanceId
    ? await ownerForInstance(payload.instanceId)
    : null;

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .upsert(
      {
        phone,
        name: payload.senderName ?? null,
        avatar_url: payload.senderPhoto ?? null,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    )
    .select()
    .single();

  // Sticky attribution: só seta assigned_owner_id/wa_number_id se lead ainda
  // não tem owner. Preserva atribuição vinda do quiz (claim_lead_for_wa) e
  // de leads que já trocaram mensagem antes.
  if (lead && owner && !lead.assigned_owner_id) {
    await supabase
      .from("leads")
      .update({
        assigned_owner_id: owner.ownerId,
        assigned_at: new Date().toISOString(),
        wa_number_id: owner.waNumberId,
      })
      .eq("id", lead.id);
  }

  if (leadErr) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "failed",
      payload,
      error: `lead upsert: ${leadErr.message}`,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ error: leadErr.message }, { status: 500 });
  }

  const parsed = await parseAndStoreMedia(payload, lead.id, supabase);

  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id: lead.id,
    direction: "inbound",
    text: parsed.text,
    media_url: parsed.media_url,
    media_type: parsed.media_type,
    raw: payload as unknown as Record<string, unknown>,
    zapi_message_id: payload.messageId ?? null,
  });

  if (msgErr) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      lead_id: lead.id,
      status: "failed",
      payload,
      error: `message insert: ${msgErr.message}`,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  await logEvent({
    type: "zapi_webhook",
    direction: "inbound",
    target: "zapi",
    lead_id: lead.id,
    status: "success",
    payload,
    duration_ms: Date.now() - start,
  });

  return NextResponse.json({ ok: true, lead_id: lead.id });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST webhook from Z-API" });
}
