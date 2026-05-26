import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Detecta conversas onde o lead manifestou objeção de preço E o atendente
// validou (M1) MAS não fez a pergunta de isolamento (M2). Lacuna #1 do
// playbook v2.
//
// Heurística (texto):
// - Sinal objeção lead (inbound):     /caro|orçamento|orcamento|condições|condicoes|fora.*alcance|fora.*realidade|fora.*orçamento|fora.*minha|barato|mais.*em.*conta|n[aã]o.*cabe/i
// - Sinal M1 atendente (outbound):    /entendo|essa.*decisão|planejamento.*emocional|planejamento.*financeiro/i
// - Sinal M2 atendente (outbound):    /posso te perguntar.*coisa|valor.*agora.*ou|tratamento em si|medo.*ou.*d[uú]vida|o que.*impede.*hoje/i
//
// Conta como falha:
// - Lead mandou inbound com sinal objeção
// - Atendente respondeu (em até 6h) com sinal M1
// - Nas próximas 3 mensagens outbound após M1 OU em 24h, NÃO houve sinal M2
//
// Admin-only.

const RE_OBJECAO =
  /\b(caro|or[çc]amento|condi[çc][oõ]es|fora\s+(do|da|de|d[ao]\s+minha|d[ao])\s+\w+|fora.*alcance|fora.*realidade|barato|mais\s+em\s+conta|n[aã]o\s+cabe)\b/i;
const RE_M1 =
  /\b(entendo|planejamento\s+(emocional|financeiro)|essa\s+decis[ãa]o|essa\s+mudan[çc]a)\b/i;
const RE_M2 =
  /(posso\s+te\s+perguntar.*coisa|valor.*agora.*ou|tratamento\s+em\s+si|medo.*ou.*d[úu]vida|o\s+que.*impede.*hoje)/i;

type Msg = {
  id: string;
  lead_id: string;
  direction: string;
  text: string | null;
  created_at: string;
};

type Lead = {
  id: string;
  name: string | null;
  phone: string;
  status: string | null;
  archetype: string | null;
  assigned_owner_id: string | null;
};

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (crmUser?.role !== "admin")
    return NextResponse.json({ error: "admin only" }, { status: 403 });

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get("days") ?? 7)));

  const admin = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  // Puxa msgs recentes
  const { data: msgs } = await admin
    .from("messages")
    .select("id, lead_id, direction, text, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20_000);

  const messages = (msgs ?? []) as Msg[];

  // Agrupa por lead
  const byLead = new Map<string, Msg[]>();
  for (const m of messages) {
    const arr = byLead.get(m.lead_id) ?? [];
    arr.push(m);
    byLead.set(m.lead_id, arr);
  }

  // Pra cada lead, detecta padrão
  const offenders: {
    lead_id: string;
    objection_text: string;
    objection_at: string;
    m1_text: string;
    m1_at: string;
    has_m2: boolean;
    msgs_after_m1: number;
  }[] = [];

  for (const [lead_id, leadMsgs] of byLead.entries()) {
    // Encontra primeira objeção inbound
    const objIdx = leadMsgs.findIndex(
      (m) =>
        m.direction === "inbound" &&
        m.text &&
        RE_OBJECAO.test(m.text),
    );
    if (objIdx === -1) continue;

    const obj = leadMsgs[objIdx];

    // Encontra primeiro M1 outbound depois da objeção (em até 6h)
    const objTime = new Date(obj.created_at).getTime();
    const m1 = leadMsgs.find(
      (m, i) =>
        i > objIdx &&
        m.direction === "outbound" &&
        m.text &&
        RE_M1.test(m.text) &&
        new Date(m.created_at).getTime() - objTime <= 6 * 3600_000,
    );
    if (!m1) continue;

    // Checa se há M2 nas próximas msgs outbound (em até 24h após M1)
    const m1Time = new Date(m1.created_at).getTime();
    const afterM1 = leadMsgs.filter(
      (m) =>
        new Date(m.created_at).getTime() > m1Time &&
        new Date(m.created_at).getTime() - m1Time <= 24 * 3600_000,
    );
    const outAfter = afterM1.filter((m) => m.direction === "outbound");
    const has_m2 = outAfter.some((m) => m.text && RE_M2.test(m.text));

    if (!has_m2) {
      offenders.push({
        lead_id,
        objection_text: obj.text!.slice(0, 200),
        objection_at: obj.created_at,
        m1_text: m1.text!.slice(0, 200),
        m1_at: m1.created_at,
        has_m2: false,
        msgs_after_m1: outAfter.length,
      });
    }
  }

  // Enriquece com dados do lead
  const ids = offenders.map((o) => o.lead_id);
  let leads: Record<string, Lead> = {};
  if (ids.length > 0) {
    const { data: leadRows } = await admin
      .from("leads")
      .select("id, name, phone, status, archetype, assigned_owner_id")
      .in("id", ids);
    leads = Object.fromEntries((leadRows ?? []).map((l) => [l.id, l as Lead]));
  }

  const { data: users } = await admin
    .from("crm_users")
    .select("id, display_name");
  const ownerName = Object.fromEntries(
    (users ?? []).map((u) => [u.id, u.display_name]),
  );

  const enriched = offenders.map((o) => ({
    ...o,
    lead: leads[o.lead_id]
      ? {
          ...leads[o.lead_id],
          owner_name: leads[o.lead_id].assigned_owner_id
            ? (ownerName[leads[o.lead_id].assigned_owner_id!] ?? null)
            : null,
        }
      : null,
  }));

  return NextResponse.json({
    days,
    since,
    total: enriched.length,
    leads_scanned: byLead.size,
    offenders: enriched.sort(
      (a, b) =>
        new Date(b.objection_at).getTime() - new Date(a.objection_at).getTime(),
    ),
  });
}
