import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendText } from "@/lib/zapi";
import { sendCapiEvent } from "@/lib/facebook";
import { logEvent } from "@/lib/event-log";
import { renderGreeting } from "@/lib/integration-config";
import { getIntegrationConfig } from "@/lib/integration-config-server";
import { routeLeadToWa, normalizePhone } from "@/lib/wa-router";

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

  await logEvent({
    type: "quiz_submit",
    direction: "inbound",
    target: "internal",
    lead_id: lead.id,
    status: "success",
    payload: { archetype, geo, case_type, knockout, scores, variant },
  });

  // Greeting WhatsApp — config-driven via /crm/integrations.
  // Por padrão CETICA é desligada (vai pro Instagram), mas pode ligar via UI.
  const greetingCfg = integration.whatsapp.greetings[archetype];
  if (greetingCfg.enabled) {
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
