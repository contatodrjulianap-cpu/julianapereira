import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";

const Body = z.object({
  name: z.string().min(2),
  phone: z.string().min(10).regex(/^\d+$/),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { name, phone } = parsed.data;
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("leads")
    .select("id, tags")
    .eq("phone", phone)
    .maybeSingle();

  const mergedTags = Array.from(
    new Set([...(existing?.tags ?? []), "aula-terca"]),
  );

  const { data: lead, error } = await supabase
    .from("leads")
    .upsert(
      {
        phone,
        name,
        source: "aula-terca",
        tags: mergedTags,
        last_message_at: new Date().toISOString(),
      },
      { onConflict: "phone" },
    )
    .select()
    .single();

  if (error) {
    console.error("aula-terca lead upsert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    type: "aula_terca_signup",
    direction: "inbound",
    target: "internal",
    lead_id: lead.id,
    status: "success",
    payload: { name, phone },
  });

  return NextResponse.json({ ok: true, lead_id: lead.id });
}
