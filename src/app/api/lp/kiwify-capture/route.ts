import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendCapiEvent } from "@/lib/facebook";

// POST /api/lp/kiwify-capture
// LP de aplicação VLR (e demais LPs que mandam pro Kiwify). Insere lead em
// `digital.leads` no Supabase compartilhado (mesmo CRM Amanda/Glenda do app
// julianapereira-digital lê dessa tabela). Dispara FB CAPI Lead em paralelo.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email(),
  phone: z.string().min(8).max(20),
  origem: z.string().max(80).optional(),
  product_id: z.string().max(80).optional(),
  product_name: z.string().max(160).optional(),
  cta_position: z.string().max(80).optional(),
  fbp: z.string().nullable().optional(),
  fbc: z.string().nullable().optional(),
  page_url: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  utms: z.record(z.string(), z.string()).optional(),
});

function normalizePhone(raw: string): string {
  let d = raw.replace(/\D+/g, "");
  while (d.length >= 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

function digitalClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing supabase env");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "digital" },
  });
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    name,
    email,
    phone,
    origem,
    product_id,
    product_name,
    cta_position,
    fbp,
    fbc,
    page_url,
    referrer,
    utms,
  } = parsed.data;

  const phoneE164 = normalizePhone(phone);
  if (phoneE164.length < 12) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const emailLower = email.trim().toLowerCase();
  const nome = name.trim();
  const sb = digitalClient();

  // Dedup por email OU telefone — não duplica lead retornante.
  let existingId: string | null = null;
  {
    const r = await sb
      .from("leads")
      .select("id")
      .ilike("email", emailLower)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    existingId = r.data?.id ?? null;
  }
  if (!existingId) {
    const r = await sb
      .from("leads")
      .select("id")
      .eq("telefone", phoneE164)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    existingId = r.data?.id ?? null;
  }

  let leadId: string | null = existingId;
  let deduplicated = false;

  if (existingId) {
    deduplicated = true;
    await sb
      .from("leads")
      .update({
        product_id: product_id ?? null,
        product_name: product_name ?? null,
      })
      .eq("id", existingId);

    await sb.from("lead_events").insert({
      lead_id: existingId,
      event_type: "lead_returned",
      description: `Lead voltou · origem: ${cta_position ?? origem ?? "vlr"}`,
      metadata: {
        origem,
        cta_position,
        product_id,
        landing_url: page_url,
        utms,
      },
      actor: "system",
    });
  } else {
    const { data, error } = await sb
      .from("leads")
      .insert({
        nome,
        telefone: phoneE164,
        email: emailLower,
        origem: origem ?? "lp-aplicacao-vlr",
        product_id: product_id ?? null,
        product_name: product_name ?? null,
        cta_position: cta_position ?? null,
        utm_source: utms?.utm_source ?? null,
        utm_medium: utms?.utm_medium ?? null,
        utm_campaign: utms?.utm_campaign ?? null,
        utm_term: utms?.utm_term ?? null,
        utm_content: utms?.utm_content ?? null,
        utm_id: utms?.utm_id ?? null,
        fbclid: utms?.fbclid ?? null,
        gclid: utms?.gclid ?? null,
        gbraid: utms?.gbraid ?? null,
        wbraid: utms?.wbraid ?? null,
        msclkid: utms?.msclkid ?? null,
        ttclid: utms?.ttclid ?? null,
        li_fat_id: utms?.li_fat_id ?? null,
        fbp: fbp ?? null,
        fbc: fbc ?? null,
        referrer: referrer ?? null,
        landing_url: page_url ?? null,
        raw_payload: { ...parsed.data },
      })
      .select("id")
      .single();

    if (error) {
      console.error("[kiwify-capture] insert error", error);
      return NextResponse.json(
        { error: "db_error", detail: error.message },
        { status: 500 },
      );
    }
    leadId = data?.id ?? null;
  }

  // FB CAPI Lead (fire-and-forget). Cliente vai disparar InitiateCheckout
  // com event_id próprio antes do redirect — dedup via mesmo event_id.
  const eventId = randomUUID();
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  after(
    sendCapiEvent({
      event_name: "Lead",
      event_id: eventId,
      event_source_url: page_url ?? undefined,
      action_source: "website",
      user_data: {
        email: emailLower,
        phone: phoneE164,
        external_id: leadId ?? undefined,
        fbp: fbp ?? undefined,
        fbc: fbc ?? undefined,
        client_ip: clientIp,
        client_user_agent: userAgent,
      },
      custom_data: {
        content_name: product_name ?? "VLR Online",
        content_category: origem ?? "lp-aplicacao-vlr",
        lead_id: leadId,
        deduplicated,
      },
    }),
  );

  return NextResponse.json({
    ok: true,
    lead_id: leadId,
    event_id: eventId,
    deduplicated,
  });
}
