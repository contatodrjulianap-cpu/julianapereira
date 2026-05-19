import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const PutBody = z.object({
  name: z.string().min(1).max(80).optional(),
  emoji: z.string().max(8).optional(),
  body: z.string().min(1).max(2000).optional(),
  category: z.string().max(40).nullable().optional(),
  favorite: z.boolean().optional(),
  uses_count_increment: z.boolean().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const parsed = PutBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { uses_count_increment, ...patch } = parsed.data;
  const admin = createServiceClient();

  if (uses_count_increment) {
    // Read current uses_count, increment, save em uma só round-trip (best-effort)
    const { data: cur } = await admin
      .from("quick_replies")
      .select("uses_count")
      .eq("id", id)
      .single();
    if (cur) {
      const { data, error } = await admin
        .from("quick_replies")
        .update({ ...patch, uses_count: (cur.uses_count ?? 0) + 1 })
        .eq("id", id)
        .select()
        .single();
      if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ reply: data });
    }
  }

  const { data, error } = await admin
    .from("quick_replies")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reply: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const admin = createServiceClient();
  const { error } = await admin.from("quick_replies").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
