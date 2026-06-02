import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/event-log";
import { nextFollowUpStatus } from "@/lib/lead-status";

const PatchBody = z.object({
  status: z
    .enum([
      "new",
      "contacted",
      "qualified",
      "scheduled",
      "attended",
      "follow_up_1",
      "follow_up_2",
      "follow_up_3",
      "follow_up_4",
      "follow_up_5",
      "follow_up_6",
      "follow_up_7",
      "won",
      "lost",
      "disqualified",
      "proposal", // legado — aceito até a migração propagar
    ])
    .optional(),
  assigned_to: z.string().nullable().optional(),
  assigned_owner_id: z.string().uuid().nullable().optional(),
  next_contact_at: z.string().nullable().optional(), // ISO date 'YYYY-MM-DD'
  deal_value: z.number().nullable().optional(),
  pinned: z.boolean().optional(),
  follow_up_at: z.string().nullable().optional(),
  follow_up_note: z.string().max(2000).nullable().optional(),
  scheduled_at: z.string().nullable().optional(), // ISO datetime da call agendada
  call_recording_url: z.string().url().max(2000).nullable().optional(),
  source: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).optional(),
});

// Status anteriores ao agendamento — agendar uma call promove o lead pra "scheduled".
const PRE_APPOINTMENT = new Set(["new", "contacted", "qualified"]);

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

  // Auto-avanço de follow up: ao agendar um follow_up_at (não-nulo) sem mexer no
  // status na mão, sobe o lead pro próximo "Follow up N". Drag no kanban manda
  // status explícito → respeita. Status terminal (won/lost/disqualified) e FU7
  // não avançam. Snooze/reagendar também conta como toque (capado em FU7).
  const update: Record<string, unknown> = { ...parsed.data };
  // Auto-status sem mexer no status na mão (drag/edição explícita sempre vence):
  //  · agendar follow_up_at → próximo Follow up N
  //  · agendar scheduled_at (call) e ainda pré-agendamento → "scheduled"
  if (
    parsed.data.status === undefined &&
    (parsed.data.follow_up_at || parsed.data.scheduled_at)
  ) {
    const { data: cur } = await admin
      .from("leads")
      .select("status")
      .eq("id", id)
      .single();
    const curStatus = (cur?.status as string | null) ?? null;
    if (parsed.data.scheduled_at && PRE_APPOINTMENT.has(curStatus ?? "")) {
      update.status = "scheduled";
    } else if (parsed.data.follow_up_at) {
      const next = nextFollowUpStatus(curStatus);
      if (next) update.status = next;
    }
  }

  const { data, error } = await admin
    .from("leads")
    .update(update)
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
    payload: { changes: update, by: user.email },
  });

  return NextResponse.json({ ok: true, lead: data });
}
