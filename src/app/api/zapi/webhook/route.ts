import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { ZapiWebhookPayload } from "@/lib/zapi";
import { logEvent } from "@/lib/event-log";
import { ownerForInstance } from "@/lib/wa-router";
import { normalizePhone } from "@/lib/phone";

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
    // caption vem "" (string vazia) do Z-API quando não tem legenda — `??`
    // não cobre isso, precisa de `||` pra cair no fallback "[imagem]".
    label = payload.image.caption || "[imagem]";
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
    label = payload.video.caption || "[vídeo]";
  } else if (payload.document?.documentUrl) {
    url = payload.document.documentUrl;
    mediaType = "document";
    mimeType = payload.document.mimeType ?? "application/octet-stream";
    const fileName = payload.document.fileName;
    ext =
      fileName?.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) ||
      "bin";
    label = fileName || "[documento]";
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
  } else if ((payload as { order?: { products?: Array<{ name?: string }> } }).order) {
    const order = (payload as { order: { products?: Array<{ name?: string }>; total?: number } }).order;
    const products = order.products ?? [];
    const names = products.map((p) => p.name).filter(Boolean).join(", ");
    const label = names ? `[catálogo: ${names}]` : "[catálogo]";
    return { text: label, media_url: null, media_type: null };
  } else {
    return { text: "[mídia sem conteúdo]", media_url: null, media_type: null };
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`download HTTP ${resp.status}`);
    const buffer = await resp.arrayBuffer();
    const path = `${leadId}/${randomUUID()}.${ext}`;
    // Normaliza mimeType: Z-API entrega "audio/ogg; codecs=opus" e o bucket
    // tem allowlist exata — strip de qualquer "; ..." pra bater no allowlist.
    const cleanMimeType = mimeType.split(";")[0].trim();
    const { error: upErr } = await admin.storage
      .from("wa-media")
      .upload(path, buffer, { contentType: cleanMimeType, upsert: false });
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
      text: label || `[${mediaType} — falha download]`,
      media_url: null,
      media_type: null,
    };
  }
}

// Tipos de callback do Z-API que NÃO são mensagens novas — não devem virar
// row em `messages`. ReceivedCallback é o único que carrega mensagem inbound.
const IGNORED_CALLBACK_TYPES = new Set([
  "MessageStatusCallback", // ack de delivery/read das nossas próprias mensagens
  "PresenceChatCallback", // lead ficou online/offline/digitando
  "ConnectedCallback",
  "DisconnectedCallback",
  "NotificationCallback",
]);

export async function POST(req: NextRequest) {
  const start = Date.now();
  const payload = (await req.json()) as ZapiWebhookPayload;

  if (payload.type && IGNORED_CALLBACK_TYPES.has(payload.type)) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "skipped",
      payload,
      error: `callback type=${payload.type}`,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ ignored: payload.type });
  }

  // Z-API às vezes manda eventos NÃO-mensagem com type=ReceivedCallback:
  // - Chamada recebida: payload tem `callId` no top level (mesmo que null)
  // - Reaction (❤️/👍): payload tem `reaction` (objeto com value, time, etc)
  // Esses não são mensagem nem mídia — não devem virar row em `messages`.
  const isCallEvent =
    "callId" in (payload as Record<string, unknown>) ||
    "expiresAt" in (payload as Record<string, unknown>);
  const isReaction = Boolean((payload as { reaction?: unknown }).reaction);
  if (isCallEvent || isReaction) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "skipped",
      payload,
      error: isCallEvent ? "call_event" : "reaction",
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({
      ignored: isCallEvent ? "call_event" : "reaction",
    });
  }

  // fromMe=true = eco de resposta enviada pela própria atendente. Grava como
  // outbound com sent_by=null (= "veio do celular"). Quando o CRM /api/zapi/send
  // já gravou a mensagem primeiro, o UNIQUE em zapi_message_id deduplica e o
  // eco é ignorado silenciosamente.
  const isOutboundEcho = payload.fromMe === true;

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

  const rawPhone = payload.phone;
  if (!rawPhone) {
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

  // Phone canônico: leads inbound vêm com phone real (normaliza pra 13 dígitos
  // BR), echo outbound da atendente vem com chatLid "@lid" (privacidade do WPP).
  const isLid = rawPhone.includes("@lid");
  const phone = isLid ? rawPhone : normalizePhone(rawPhone);

  const supabase = createServiceClient();

  // Resolve owner pelo instance_id da Z-API (qual número/atendente recebeu).
  // Se não achar (instância não cadastrada em wa_numbers), segue sem atribuir.
  const owner = payload.instanceId
    ? await ownerForInstance(payload.instanceId)
    : null;

  // Quando o echo outbound vem com phone=@lid, NÃO cria lead novo — procura
  // primeiro lead existente cujo histórico contém o mesmo chatLid (sinal de
  // que é a mesma conversa). Evita o bug em que mensagens da atendente
  // criavam um lead "sem nome" paralelo ao lead real do paciente.
  let existingLeadIdForLid: string | null = null;
  if (isLid && isOutboundEcho && payload.chatLid) {
    const { data: match } = await supabase
      .from("messages")
      .select("lead_id")
      .eq("raw->>chatLid", payload.chatLid)
      .neq("raw->>phone", rawPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (match?.lead_id) existingLeadIdForLid = match.lead_id;
  }

  // No echo outbound (fromMe=true), senderName/senderPhoto vêm da atendente,
  // não do lead — então não sobrescreve name/avatar do lead nesse caso.
  const leadUpsertPayload: Record<string, unknown> = {
    phone,
    last_message_at: new Date().toISOString(),
  };
  if (!isOutboundEcho) {
    leadUpsertPayload.name = payload.senderName ?? null;
    leadUpsertPayload.avatar_url = payload.senderPhoto ?? null;
  }

  let lead: { id: string; name: string | null; assigned_owner_id: string | null } | null = null;
  let leadErr: { message: string } | null = null;

  if (existingLeadIdForLid) {
    // Atualiza last_message_at no lead real (resolvido pelo chatLid)
    const { data, error } = await supabase
      .from("leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", existingLeadIdForLid)
      .select("id, name, assigned_owner_id")
      .single();
    lead = data;
    leadErr = error;
  } else {
    const { data, error } = await supabase
      .from("leads")
      .upsert(leadUpsertPayload, { onConflict: "phone" })
      .select("id, name, assigned_owner_id")
      .single();
    lead = data;
    leadErr = error;
  }

  // Para leads @lid (privacidade do WhatsApp esconde o phone real), o
  // senderName em payload.fromMe=true é a atendente, não o destinatário.
  // Extrai nome do texto inicial ("Oii Sandra" → Sandra) se lead sem nome.
  if (isOutboundEcho && lead && !lead.name && payload.text?.message) {
    const m = payload.text.message.match(
      /^(?:oi+|ol[áa]+|bom\s+dia|boa\s+tarde|boa\s+noite)[,\s!]+([A-Za-zÁ-Úá-ú]{2,30})\b/i,
    );
    const candidate = m?.[1];
    const DENY = new Set([
      "tudo", "bom", "boa", "amor", "linda", "querida", "querido",
      "amiga", "amigo", "bem", "sim", "nao", "não", "ola", "olá",
      "oi", "mae", "mãe", "pai", "doutora", "doutor", "dra", "dr",
      "sou", "aqui", "eu", "como", "vamos", "voce", "você", "vc",
    ]);
    if (candidate && !DENY.has(candidate.toLowerCase())) {
      const name = candidate[0].toUpperCase() + candidate.slice(1).toLowerCase();
      await supabase.from("leads").update({ name }).eq("id", lead.id);
    }
  }

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

  if (leadErr || !lead) {
    await logEvent({
      type: "zapi_webhook",
      direction: "inbound",
      target: "zapi",
      status: "failed",
      payload,
      error: `lead upsert: ${leadErr?.message ?? "no lead returned"}`,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json(
      { error: leadErr?.message ?? "no lead returned" },
      { status: 500 },
    );
  }

  const parsed = await parseAndStoreMedia(payload, lead.id, supabase);

  // INSERT simples — supabase-js não aceita onConflict em UNIQUE partial,
  // então tratamos manualmente: erro 23505 (unique violation) = eco duplicado
  // de uma msg que CRM /send já gravou primeiro, ignora silenciosamente.
  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id: lead.id,
    direction: isOutboundEcho ? "outbound" : "inbound",
    text: parsed.text,
    media_url: parsed.media_url,
    media_type: parsed.media_type,
    raw: payload as unknown as Record<string, unknown>,
    zapi_message_id: payload.messageId ?? null,
    sent_by: null,
  });

  if (msgErr && (msgErr as { code?: string }).code === "23505") {
    await logEvent({
      type: "zapi_webhook",
      direction: isOutboundEcho ? "outbound" : "inbound",
      target: "zapi",
      lead_id: lead.id,
      status: "skipped",
      payload,
      error: "duplicate zapi_message_id (já gravado via /send)",
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ ok: true, lead_id: lead.id, deduped: true });
  }

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
    direction: isOutboundEcho ? "outbound" : "inbound",
    target: "zapi",
    lead_id: lead.id,
    status: "success",
    payload,
    duration_ms: Date.now() - start,
  });

  return NextResponse.json({ ok: true, lead_id: lead.id, fromMe: isOutboundEcho });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST webhook from Z-API" });
}
