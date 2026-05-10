import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ZapiWebhookPayload } from "@/lib/zapi";
import { logEvent } from "@/lib/event-log";

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
