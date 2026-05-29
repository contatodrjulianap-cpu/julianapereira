import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendText } from "@/lib/zapi";
import { sendCapiEvent } from "@/lib/facebook";
import { logEvent } from "@/lib/event-log";
import { renderGreeting } from "@/lib/integration-config";
import { getIntegrationConfig } from "@/lib/integration-config-server";
import { routeLeadToWa, normalizePhone } from "@/lib/wa-router";
import { sendPushToUser } from "@/lib/push";

const UtmSchema = z
  .object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
  })
  .optional();

// Body usa keys livres em answers/scores — config do quiz pode mudar via builder.
const Body = z.object({
  name: z.string().min(2),
  phone: z.string().min(10).regex(/^\d+$/),
  instagram: z.string().nullable().optional(),
  archetype: z.enum(["PRONTA", "ESPERANCOSA", "CETICA"]),
  geo: z.enum(["SP", "BR", "INTL"]),
  case_type: z.string().nullable().optional(),
  scores: z.record(z.string(), z.number()),
  knockout: z.boolean().default(false),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  selfie_path: z.string().nullable().optional(),
  variant: z.enum(["resina", "porcelana"]),
  // surface: origem do lead. "bot" pula o greeting Z-API automático
  // porque no chat-bot o lead é quem inicia a conversa (clicando no
  // wa.me). Default "quiz" mantém o comportamento histórico.
  surface: z.enum(["quiz", "bot"]).default("quiz"),
  utm: UtmSchema,
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    name,
    phone: rawPhone,
    instagram,
    archetype,
    geo,
    case_type,
    scores,
    knockout,
    answers,
    selfie_path,
    variant,
    surface,
    utm,
  } = parsed.data;
  // Defesa server-side: mesmo que o front já normalize, garante phone canônico
  // (impede duplicação de lead se cliente bypassa o normalize ou usa formato exótico).
  const phone = normalizePhone(rawPhone);

  const integration = await getIntegrationConfig();

  const supabase = createServiceClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .upsert(
      {
        phone,
        name,
        instagram: instagram ?? null,
        source: "quiz",
        archetype,
        geo,
        case_type: case_type ?? null,
        archetype_scores: scores,
        quiz_answers: answers,
        quiz_variant: variant,
        ...(selfie_path ? { selfie_url: selfie_path } : {}),
        tags: [
          `arch:${archetype}`,
          `geo:${geo}`,
          `quiz:${variant}`,
          ...(knockout ? ["knockout"] : []),
          ...(utm?.utm_source ? [`utm:${utm.utm_source}`] : []),
        ],
        utm_source: utm?.utm_source ?? null,
        utm_medium: utm?.utm_medium ?? null,
        utm_campaign: utm?.utm_campaign ?? null,
        utm_term: utm?.utm_term ?? null,
        utm_content: utm?.utm_content ?? null,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    )
    .select()
    .single();

  if (leadErr) {
    console.error("lead upsert", leadErr);
    return NextResponse.json({ error: leadErr.message }, { status: 500 });
  }

  // Atribui o lead a um atendente JÁ no submit do quiz (round-robin sticky).
  // CETICA NÃO é atribuída — esse arquétipo vai pro Instagram, não tem
  // potencial de venda imediata. Atender CETICA queima tempo das meninas
  // sem ROI. Se um dia mandar msg via WhatsApp mesmo assim, o webhook
  // atribui automaticamente (sticky attribution).
  if (archetype !== "CETICA") {
    try {
      await routeLeadToWa(phone);
    } catch (e) {
      console.error("routeLeadToWa failed (lead salvo, atribuição via webhook)", e);
    }
  }

  // FIXME(2026-05-26): override temporário pedido pelo Lucas — PRONTA e
  // ESPERANCOSA (estendido 2026-05-27) vão sempre pra Barbara, não
  // round-robin. CETICA continua sem atribuição. Tirar este bloco quando
  // ele pedir.
  if (archetype === "PRONTA" || archetype === "ESPERANCOSA") {
    const BARBARA_OWNER_ID = "6c0b2208-1806-4e89-bd08-2046895ab4f5";
    const BARBARA_WA_NUMBER_ID = "53cd6090-9160-485a-9fda-c46276a4ad6a";
    try {
      await supabase
        .from("leads")
        .update({
          assigned_owner_id: BARBARA_OWNER_ID,
          wa_number_id: BARBARA_WA_NUMBER_ID,
          assigned_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      await logEvent({
        type: "wa_router_override",
        direction: "internal",
        target: "supabase",
        lead_id: lead.id,
        status: "success",
        payload: {
          reason: "quente_to_barbara_fixed",
          archetype,
          owner_id: BARBARA_OWNER_ID,
        },
      });

      // Movimento A — alerta push pra Barbara cair em ≤15min.
      // fire-and-forget via after() — não bloqueia response do quiz.
      after(async () => {
        try {
          const emoji = archetype === "PRONTA" ? "🔥" : "🟡";
          await sendPushToUser(
            BARBARA_OWNER_ID,
            {
              title: `${emoji} LEAD QUENTE — ${archetype}`,
              body: `${name} ${variant === "porcelana" ? "· porcelana" : "· resina"}\nTocar em ≤15min`,
              url: `/crm/c/${lead.id}`,
              tag: `lead-${lead.id}`,
              requireInteraction: true,
            },
            { lead_id: lead.id },
          );
        } catch (err) {
          console.error("push to Barbara failed", err);
        }
      });
    } catch (e) {
      console.error("Quente → Barbara override failed", e);
    }
  }

  await logEvent({
    type: "quiz_submit",
    direction: "inbound",
    target: "internal",
    lead_id: lead.id,
    status: "success",
    payload: { archetype, geo, case_type, knockout, scores, variant, surface },
  });

  // Greeting WhatsApp — config-driven via /crm/integrations.
  // Por padrão CETICA é desligada (vai pro Instagram), mas pode ligar via UI.
  // surface=="bot": chat-bot já mostra CTA pro lead mandar a primeira msg
  // via wa.me — então pulamos o greeting automático pra evitar mensagem
  // duplicada (clínica falando antes do lead clicar).
  const greetingCfg = integration.whatsapp.greetings[archetype];

  // Anti dupla-greeting: se já houve qualquer outbound nesse lead nas
  // últimas 24h (re-quiz, lead antigo, atendente já tocou), pula o auto.
  // Evita "Olá Nome, bom dia" da Barbara seguido de greeting genérico.
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count: recentOutCount } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id)
    .eq("direction", "outbound")
    .gte("created_at", since24h);
  const alreadyEngaged = (recentOutCount ?? 0) > 0;

  if (greetingCfg.enabled && surface !== "bot" && !alreadyEngaged) {
    const greeting = renderGreeting(greetingCfg.message, name);
    try {
      const zapiRes = await sendText(
        { phone, message: greeting },
        { lead_id: lead.id },
      );
      await supabase.from("messages").insert({
        lead_id: lead.id,
        direction: "outbound",
        text: greeting,
        raw: zapiRes as unknown as Record<string, unknown>,
        zapi_message_id: (zapiRes as { messageId?: string })?.messageId ?? null,
      });
    } catch (e) {
      console.error("zapi send failed", e);
      // não falha o quiz por isso — lead já foi salvo
    }
  } else if (alreadyEngaged) {
    await logEvent({
      type: "greeting_skip",
      direction: "internal",
      target: "internal",
      lead_id: lead.id,
      status: "skipped",
      payload: { reason: "already_engaged_24h", recent_out: recentOutCount },
    });
  }

  // Facebook Conversions API — evento Lead.
  // Filtro por arquétipo: se fbCfg.archetypes definido, só dispara pros listados.
  // undefined = todos disparam (back-compat). Default em prod: ["PRONTA","ESPERANCOSA"].
  const fbp = req.cookies.get("_fbp")?.value;
  const fbc = req.cookies.get("_fbc")?.value;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;

  const fbCfg = integration.facebook.quiz_submit;
  const fbArchetypeAllowed =
    !fbCfg.archetypes || fbCfg.archetypes.includes(archetype);
  if (fbCfg.enabled && fbArchetypeAllowed) {
    after(async () => {
      try {
        await sendCapiEvent(
          {
            event_name: fbCfg.event_name,
            event_id: `lead-${lead.id}`,
            event_source_url: req.headers.get("referer") ?? undefined,
            user_data: {
              phone,
              external_id: lead.id,
              fbp,
              fbc,
              client_ip: ip,
              client_user_agent: ua,
            },
            custom_data: {
              content_name: fbCfg.content_name ?? "quiz_submission",
              archetype,
              geo,
              case_type: case_type ?? "unknown",
              knockout,
              variant,
              ...(utm ?? {}),
            },
          },
          { lead_id: lead.id },
        );
      } catch (err) {
        console.error("FB CAPI submit failed", err);
      }
    });
  }

  return NextResponse.json({ ok: true, lead_id: lead.id, archetype, geo });
}
