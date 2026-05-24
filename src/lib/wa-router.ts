import { createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";

// Roteamento server-side de leads pros 2 (ou N) números WhatsApp da Sakura.
// Sticky por phone: lead atribuído mantém o mesmo número/atendente nas próximas
// interações. Round-robin é avançado UMA vez por lead novo, no claim inicial.
//
// Quando wa_numbers está vazia (chips ainda não chegaram), retorna fallback
// pro número de teste atual — quiz/UX continuam funcionando.

const FALLBACK_PHONE = "5511982295873"; // número da Sakura, usado enquanto wa_numbers está vazia

export type WaRoute = {
  leadId: string | null;
  waNumberId: string;
  phone: string;
  instanceId: string;
  ownerId: string;
  fallback: false;
};

export type WaFallback = {
  phone: string;
  fallback: true;
  reason: "no_active_numbers" | "rpc_error";
};

/** Atribui (ou reusa atribuição existente) e retorna o número alvo pra wa.me. */
export async function routeLeadToWa(p_phone: string): Promise<WaRoute | WaFallback> {
  const start = Date.now();
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("claim_lead_for_wa", { p_phone });

  if (error) {
    await logEvent({
      type: "wa_router",
      direction: "internal",
      target: "supabase",
      status: "failed",
      payload: { p_phone },
      error: error.message,
      duration_ms: Date.now() - start,
    });
    return { phone: FALLBACK_PHONE, fallback: true, reason: "rpc_error" };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    await logEvent({
      type: "wa_router",
      direction: "internal",
      target: "supabase",
      status: "skipped",
      payload: { p_phone },
      error: "no active wa_numbers",
      duration_ms: Date.now() - start,
    });
    return { phone: FALLBACK_PHONE, fallback: true, reason: "no_active_numbers" };
  }

  await logEvent({
    type: "wa_router",
    direction: "internal",
    target: "supabase",
    lead_id: row.lead_id ?? undefined,
    status: "success",
    payload: { p_phone, picked: row.phone, owner_id: row.owner_id },
    duration_ms: Date.now() - start,
  });

  return {
    leadId: row.lead_id ?? null,
    waNumberId: row.wa_number_id,
    phone: row.phone,
    instanceId: row.instance_id,
    ownerId: row.owner_id,
    fallback: false,
  };
}

/** Resolve credenciais Z-API (instance_id + token) pra um lead específico.
 *  Usado pelo /api/zapi/send pra enviar pela atendente certa. */
export async function resolveZapiCredsForLead(
  leadId: string,
): Promise<{ instanceId: string; token: string } | null> {
  const supabase = createServiceClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("wa_number_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.wa_number_id) return null;

  const { data: wa } = await supabase
    .from("wa_numbers")
    .select("instance_id, token")
    .eq("id", lead.wa_number_id)
    .maybeSingle();
  if (!wa) return null;

  return { instanceId: wa.instance_id, token: wa.token };
}

/** Lookup do owner_id pelo instance_id (usado no webhook inbound). */
export async function ownerForInstance(
  instanceId: string,
): Promise<{ waNumberId: string; ownerId: string } | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("wa_numbers")
    .select("id, owner_id")
    .eq("instance_id", instanceId)
    .maybeSingle();
  if (!data) return null;
  return { waNumberId: data.id, ownerId: data.owner_id };
}

// Reexport pra back-compat — código existente que faz
// `import { normalizePhone } from "@/lib/wa-router"` continua funcionando.
// Em Client Components, importe direto de "@/lib/phone" pra evitar puxar
// a cadeia Supabase/next-headers via tree-shake de Turbopack.
export { normalizePhone } from "./phone";
