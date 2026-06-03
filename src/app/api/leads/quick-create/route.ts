import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";
import { logEvent } from "@/lib/event-log";

// Cria (ou reaproveita) um lead a partir de um telefone digitado na mão, pra
// abrir conversa com alguém que ainda não está na base. Idempotente por phone.
const Body = z.object({
  phone: z.string().min(8).max(30),
  name: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const phone = normalizePhone(parsed.data.phone);
  if (phone.replace(/\D/g, "").length < 12) {
    return NextResponse.json({ error: "telefone inválido" }, { status: 400 });
  }

  const admin = createServiceClient();

  // Já existe? Reaproveita (não duplica — phone é unique).
  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ id: existing.id, existing: true });
  }

  const { data, error } = await admin
    .from("leads")
    .insert({
      phone,
      name: parsed.data.name?.trim() || null,
      source: "manual",
      status: "new",
      assigned_owner_id: user.id,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logEvent({
    type: "lead_update",
    direction: "internal",
    target: "supabase",
    lead_id: data.id,
    status: "success",
    payload: { created_manual: true, phone, by: user.email },
  });

  return NextResponse.json({ id: data.id, existing: false });
}
