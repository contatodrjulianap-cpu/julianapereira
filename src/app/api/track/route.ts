import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCapiEvent } from "@/lib/facebook";
import { getIntegrationConfig } from "@/lib/integration-config-server";

// Body permissivo — aceita campos extras (utm_*, etc) e propaga pro payload.
const Body = z
  .object({
    type: z.enum([
      "quiz_pageview",
      "quiz_step_view",
      "quiz_wa_click",
      "quiz_instagram_click",
    ]),
    session_id: z.string().min(8),
    step: z.string().optional(),
    archetype: z.string().optional(),
    lead_id: z.string().uuid().optional(),
    geo: z.string().optional(),
  })
  .passthrough();

export async function POST(req: NextRequest) {
  const raw = await req.json();
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ua = req.headers.get("user-agent") ?? null;
  const ref = req.headers.get("referer") ?? null;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // Salva tudo (incluindo utms via passthrough) no payload do event_log
  const { type, lead_id, session_id, ...rest } = parsed.data;
  const payload = {
    session_id,
    ...rest,
    ua,
    ref,
  };

  const { error } = await supabase.from("event_log").insert({
    type,
    direction: "inbound",
    target: "quiz_client",
    lead_id: lead_id ?? null,
    status: "success",
    payload,
  });

  if (error) {
    console.error("track event_log insert error:", error.message);
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }

  // Dispara FB CAPI conforme config
  const fbp = req.cookies.get("_fbp")?.value;
  const fbc = req.cookies.get("_fbc")?.value;

  after(async () => {
    try {
      const integration = await getIntegrationConfig();
      const fb = integration.facebook;

      if (type === "quiz_pageview" && fb.pageview.enabled) {
        await sendCapiEvent(
          {
            event_name: fb.pageview.event_name,
            event_id: `pv-${session_id}-${Math.floor(Date.now() / 1000)}`,
            event_source_url: ref ?? undefined,
            user_data: {
              external_id: session_id,
              fbp,
              fbc,
              client_ip: ip ?? undefined,
              client_user_agent: ua ?? undefined,
            },
            custom_data: {
              content_name: fb.pageview.content_name ?? "quiz_pageview",
              ...rest,
            },
          },
          { lead_id: lead_id ?? undefined },
        );
      }

      // wa_click: filtra por arquétipo se config definir lista.
      // Default em prod: ["PRONTA","ESPERANCOSA"]. CETICA já cai no botão Instagram,
      // mas o filtro fica defensivo caso alguém ative WhatsApp pra CETICA no builder.
      const waArchetype = parsed.data.archetype as
        | "PRONTA"
        | "ESPERANCOSA"
        | "CETICA"
        | undefined;
      const waArchetypeAllowed =
        !fb.wa_click.archetypes ||
        !waArchetype ||
        fb.wa_click.archetypes.includes(waArchetype);
      if (type === "quiz_wa_click" && fb.wa_click.enabled && waArchetypeAllowed) {
        await sendCapiEvent(
          {
            event_name: fb.wa_click.event_name,
            event_id: `wa-${session_id}-${Math.floor(Date.now() / 1000)}`,
            event_source_url: ref ?? undefined,
            user_data: {
              external_id: lead_id ?? session_id,
              fbp,
              fbc,
              client_ip: ip ?? undefined,
              client_user_agent: ua ?? undefined,
            },
            custom_data: {
              content_name: fb.wa_click.content_name ?? "wa_click",
              ...rest,
            },
          },
          { lead_id: lead_id ?? undefined },
        );
      }
    } catch (err) {
      console.error("track fb capi failed", err);
    }
  });

  return NextResponse.json({ ok: true });
}
