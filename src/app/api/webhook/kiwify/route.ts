import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook Kiwify (compra/pagamento)
// URL: /api/webhook/kiwify?signature=<KIWIFY_WEBHOOK_SECRET>
// Cadastra/atualiza lead em public.leads por phone (UNIQUE).
// Marca source='kiwify', status='won' quando paid, deal_value em reais.

type KiwifyStatus =
  | "pending"
  | "paid"
  | "refunded"
  | "chargeback"
  | "canceled";

const STATUS_MAP: Record<string, KiwifyStatus> = {
  paid: "paid",
  approved: "paid",
  order_approved: "paid",
  refunded: "refunded",
  order_refunded: "refunded",
  chargedback: "chargeback",
  chargeback: "chargeback",
  order_chargeback: "chargeback",
  canceled: "canceled",
  cancelled: "canceled",
  order_canceled: "canceled",
  order_rejected: "canceled",
  pending: "pending",
  waiting_payment: "pending",
};

function authOk(req: NextRequest): boolean {
  const secret =
    process.env.KIWIFY_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const sig = req.nextUrl.searchParams.get("signature");
  const tok = req.nextUrl.searchParams.get("token");
  const header = req.headers.get("x-webhook-secret");
  return sig === secret || tok === secret || header === secret;
}

function pick(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return null;
}

function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeStatus(raw: string | null): KiwifyStatus {
  if (!raw) return "pending";
  return STATUS_MAP[raw.toLowerCase().trim()] ?? "pending";
}

// Sanitiza telefone Kiwify pra formato E.164 sem +. Ex: '+55 (11) 99...' -> '5511999...'
function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // Kiwify Brasil costuma mandar com DDI 55. Se vier sem, prefixa.
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const customer =
    (payload.Customer as Record<string, unknown>) ||
    (payload.customer as Record<string, unknown>);
  const product =
    (payload.Product as Record<string, unknown>) ||
    (payload.product as Record<string, unknown>);
  const commissions =
    (payload.Commissions as Record<string, unknown>) ||
    (payload.commissions as Record<string, unknown>);
  const tracking =
    (payload.TrackingParameters as Record<string, unknown>) ||
    (payload.tracking_parameters as Record<string, unknown>) ||
    (payload.utm as Record<string, unknown>);

  const phoneRaw =
    pick(customer, "mobile", "phone", "phone_number") ??
    pick(payload, "phone", "customer_phone");
  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return NextResponse.json(
      { error: "missing_phone", detail: "Kiwify payload sem telefone" },
      { status: 422 },
    );
  }

  const statusRaw = pick(
    payload,
    "order_status",
    "status",
    "webhook_event_type",
    "event",
  );
  const kiwifyStatus = normalizeStatus(statusRaw);

  let value =
    asNumber(commissions?.charge_amount) ??
    asNumber(commissions?.product_base_price) ??
    asNumber(payload.amount) ??
    asNumber(payload.value) ??
    asNumber(payload.total);
  // Kiwify manda em centavos (charge_amount = 150000 = R$1500,00)
  if (value !== null) value = Math.round(value) / 100;

  const name =
    pick(customer, "full_name", "name", "first_name") ??
    pick(payload, "name", "customer_name");
  const email =
    pick(customer, "email") ?? pick(payload, "email", "customer_email");
  const productName =
    pick(product, "product_name", "name") ?? pick(payload, "product_name");
  const utmSource =
    pick(tracking, "utm_source") ?? pick(payload, "utm_source");
  const utmMedium =
    pick(tracking, "utm_medium") ?? pick(payload, "utm_medium");
  const utmCampaign =
    pick(tracking, "utm_campaign") ?? pick(payload, "utm_campaign");
  const utmTerm = pick(tracking, "utm_term") ?? pick(payload, "utm_term");
  const utmContent =
    pick(tracking, "utm_content") ?? pick(payload, "utm_content");

  // Mapear status Kiwify pra status interno da Ju
  // (new, contacted, qualified, proposal, won, lost)
  const leadStatus =
    kiwifyStatus === "paid"
      ? "won"
      : kiwifyStatus === "refunded" ||
          kiwifyStatus === "chargeback" ||
          kiwifyStatus === "canceled"
        ? "lost"
        : null;

  const admin = createServiceClient();

  // Tenta upsert: se já existe lead por phone, atualiza; senão cria
  const { data: existing } = await admin
    .from("leads")
    .select("id, status, deal_value")
    .eq("phone", phone)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    source: "kiwify",
    updated_at: new Date().toISOString(),
  };
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (productName) updates.case_type = productName;
  if (value !== null && kiwifyStatus === "paid") updates.deal_value = value;
  if (leadStatus) updates.status = leadStatus;
  if (utmSource) updates.utm_source = utmSource;
  if (utmMedium) updates.utm_medium = utmMedium;
  if (utmCampaign) updates.utm_campaign = utmCampaign;
  if (utmTerm) updates.utm_term = utmTerm;
  if (utmContent) updates.utm_content = utmContent;

  let leadId: string;
  if (existing) {
    const { error } = await admin
      .from("leads")
      .update(updates)
      .eq("id", existing.id);
    if (error) {
      console.error("[webhook/kiwify] update error", error);
      return NextResponse.json(
        { error: "db_update_error", detail: error.message },
        { status: 500 },
      );
    }
    leadId = existing.id;
  } else {
    const { data, error } = await admin
      .from("leads")
      .insert({ phone, ...updates })
      .select("id")
      .single();
    if (error) {
      console.error("[webhook/kiwify] insert error", error);
      return NextResponse.json(
        { error: "db_insert_error", detail: error.message },
        { status: 500 },
      );
    }
    leadId = data.id;
  }

  await logEvent({
    type: "kiwify_webhook",
    direction: "inbound",
    target: "kiwify",
    lead_id: leadId,
    status: "success",
    payload: {
      kiwify_status: kiwifyStatus,
      value,
      product_name: productName,
      email,
      created: !existing,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      lead_id: leadId,
      kiwify_status: kiwifyStatus,
      lead_status: leadStatus,
    },
    { status: 200 },
  );
}

// GET pra Kiwify validar URL no painel
export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, service: "kiwify-webhook" });
}
