import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendText } from "@/lib/zapi";
import { sendCapiEvent } from "@/lib/facebook";
import { logEvent } from "@/lib/event-log";

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
  answers: z.record(z.string(), z.string()),
});

// Mensagem WhatsApp inicial (somente PRONTA + ESPERANCOSA recebem).
// CETICA é redirecionada pro Instagram da Ju — não manda WhatsApp inicial.
const GREETINGS_BY_ARCHETYPE: Record<"PRONTA" | "ESPERANCOSA", string> = {
  PRONTA:
    "Oi {name}! 🌸 Recebi o resultado do seu quiz aqui — *Sorriso Pronto pra Avaliação*. A Ju vai te chamar nas próximas horas pra alinhar agenda. Se quiser adiantar, me responde aqui que já te passo os horários disponíveis.",
  ESPERANCOSA:
    "Oi {name}! 🌸 Vi seu quiz aqui — você está no momento de entender o caminho certo. O plano não é tabela, depende do seu caso. A avaliação personalizada com a Ju (ou com a equipe) é onde tudo se define, inclusive o parcelamento. Posso te explicar como funciona?",
};

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
    phone,
    instagram,
    archetype,
    geo,
    case_type,
    scores,
    knockout,
    answers,
  } = parsed.data;

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
        tags: [`arch:${archetype}`, `geo:${geo}`, ...(knockout ? ["knockout"] : [])],
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

  await logEvent({
    type: "quiz_submit",
    direction: "inbound",
    target: "internal",
    lead_id: lead.id,
    status: "success",
    payload: { archetype, geo, case_type, knockout, scores },
  });

  // Manda WhatsApp inicial apenas pra PRONTA e ESPERANCOSA.
  // CETICA cai no Instagram da Ju — equipe não inicia conversa.
  if (archetype === "PRONTA" || archetype === "ESPERANCOSA") {
    const greeting = GREETINGS_BY_ARCHETYPE[archetype].replace(
      "{name}",
      name.split(" ")[0],
    );

    try {
      const zapiRes = await sendText({ phone, message: greeting }, { lead_id: lead.id });
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

  // Facebook Conversions API — evento Lead (todos os arquétipos disparam)
  const fbp = req.cookies.get("_fbp")?.value;
  const fbc = req.cookies.get("_fbc")?.value;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;

  after(async () => {
    try {
      await sendCapiEvent(
        {
          event_name: "Lead",
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
            content_name: "quiz_submission",
            archetype,
            geo,
            case_type: case_type ?? "unknown",
            knockout,
          },
        },
        { lead_id: lead.id },
      );
    } catch (err) {
      console.error("FB CAPI Lead failed", err);
    }
  });

  return NextResponse.json({ ok: true, lead_id: lead.id, archetype, geo });
}
