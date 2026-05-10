import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
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
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const ua = req.headers.get("user-agent") ?? null;
  const ref = req.headers.get("referer") ?? null;

  const { error } = await supabase.from("event_log").insert({
    type: parsed.data.type,
    direction: "inbound",
    target: "quiz_client",
    lead_id: parsed.data.lead_id ?? null,
    status: "success",
    payload: {
      session_id: parsed.data.session_id,
      step: parsed.data.step,
      archetype: parsed.data.archetype,
      geo: parsed.data.geo,
      ua,
      ref,
    },
  });

  if (error) {
    console.error("track event_log insert error:", error.message);
    return NextResponse.json({ error: "log failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
