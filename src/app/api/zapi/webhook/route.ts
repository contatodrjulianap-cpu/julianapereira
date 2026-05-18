import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ZapiWebhookPayload } from "@/lib/zapi";
import { logEvent } from "@/lib/event-log";
import { ownerForInstance } from "@/lib/wa-router";

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

  const text =
    payload.text?.message ?? payload.image?.caption ?? "[mídia sem texto]";

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

  const { error: msgErr } = await supabase.from("messages").insert({
    lead_id: lead.id,
    direction: "inbound",
    text,
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
