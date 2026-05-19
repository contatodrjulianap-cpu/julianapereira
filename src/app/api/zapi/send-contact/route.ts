import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendContact } from "@/lib/zapi";
import { resolveZapiCredsForLead } from "@/lib/wa-router";

const Body = z.object({
  lead_id: z.string().uuid(),
  contact_name: z.string().min(1).max(80),
  contact_phone: z.string().min(8).max(20),
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

  // Normaliza telefone do contato: só dígitos, prefixo 55 se faltar
  const digits = parsed.data.contact_phone.replace(/\D/g, "");
  const contactPhone = digits.startsWith("55") ? digits : `55${digits}`;

  const creds = await resolveZapiCredsForLead(lead.id);

  let zapiRes;
  try {
    zapiRes = await sendContact(
      {
        phone: lead.phone,
        contactName: parsed.data.contact_name.trim(),
        contactPhone,
      },
      {
        lead_id: lead.id,
        instance_id: creds?.instanceId,
        token: creds?.token,
      },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "send failed" },
      { status: 502 },
    );
  }

  await admin.from("messages").insert({
    lead_id: lead.id,
    direction: "outbound",
    text: `📇 Contato: ${parsed.data.contact_name.trim()} — ${contactPhone}`,
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
