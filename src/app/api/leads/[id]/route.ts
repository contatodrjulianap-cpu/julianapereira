import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";

const PatchBody = z.object({
  status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).optional(),
  assigned_to: z.string().nullable().optional(),
  next_contact_at: z.string().nullable().optional(), // ISO date 'YYYY-MM-DD'
  deal_value: z.number().nullable().optional(),
  pinned: z.boolean().optional(),
  follow_up_at: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("leads")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logEvent({
    type: "lead_update",
    direction: "internal",
    target: "supabase",
    lead_id: id,
    status: "success",
    payload: { changes: parsed.data, by: user.email },
  });

  return NextResponse.json({ ok: true, lead: data });
}
