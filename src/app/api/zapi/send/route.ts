import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendText } from "@/lib/zapi";
import { resolveZapiCredsForLead } from "@/lib/wa-router";

const Body = z.object({
  lead_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, phone, wa_number_id, assigned_owner_id")
    .eq("id", parsed.data.lead_id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  // Resolve credenciais da instância Z-API certa (atendente dona do lead).
  // Se lead não tem wa_number_id (legado, pré-rotação), cai no env default.
  const creds = await resolveZapiCredsForLead(lead.id);

  const zapiRes = await sendText(
    { phone: lead.phone, message: parsed.data.message },
    {
      lead_id: lead.id,
      instance_id: creds?.instanceId,
      token: creds?.token,
    },
  );

  await admin.from("messages").insert({
    lead_id: lead.id,
    direction: "outbound",
    text: parsed.data.message,
    raw: zapiRes as unknown as Record<string, unknown>,
    zapi_message_id: (zapiRes as { messageId?: string })?.messageId ?? null,
    sent_by: user.id,
  });

  await admin
    .from("leads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", lead.id);

  return NextResponse.json({ ok: true });
}
