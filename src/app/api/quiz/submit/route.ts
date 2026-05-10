import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendText } from "@/lib/zapi";
import { sendCapiEvent } from "@/lib/facebook";
import { logEvent } from "@/lib/event-log";

const Body = z.object({
  name: z.string().min(2),
  phone: z.string().min(10).regex(/^\d+$/),
  goal: z.enum(["clarear", "lentes", "corrigir", "outro"]),
  budget: z.enum(["ate_5k", "5k_15k", "15k_30k", "30k_mais"]),
});

const GREETINGS: Record<string, string> = {
  clarear:
    "Oi {name}! Recebi sua resposta sobre clareamento. A Dra. Juliana vai te chamar com a melhor opção pro seu caso 💚",
  lentes:
    "Oi {name}! Recebi seu interesse em lentes. A equipe vai te chamar com as opções (resina e porcelana) e valores 💚",
  corrigir:
    "Oi {name}! Anotamos aqui. A equipe vai te chamar pra entender melhor o que você quer corrigir e indicar o tratamento certo 💚",
  outro:
    "Oi {name}! Recebido. A equipe vai te chamar pra entender melhor seu caso e indicar o caminho 💚",
};

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, phone, goal, budget } = parsed.data;
  const supabase = createServiceClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .upsert(
      {
        phone,
        name,
        source: "quiz",
        quiz_goal: goal,
        quiz_budget: budget,
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
    payload: { name, phone, goal, budget },
  });

  const greeting = GREETINGS[goal].replace("{name}", name.split(" ")[0]);

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

  // Facebook Conversions API — evento Lead
  const fbp = req.cookies.get("_fbp")?.value;
  const fbc = req.cookies.get("_fbc")?.value;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;

  sendCapiEvent(
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
        goal,
        budget,
      },
    },
    { lead_id: lead.id },
  ).catch((err) => console.error("FB CAPI Lead failed", err));

  return NextResponse.json({ ok: true, lead_id: lead.id });
}
