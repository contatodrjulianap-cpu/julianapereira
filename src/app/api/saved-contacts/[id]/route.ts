import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const PutBody = z.object({
  name: z.string().min(1).max(80).optional(),
  phone: z.string().min(8).max(20).optional(),
  description: z.string().max(200).nullable().optional(),
  emoji: z.string().max(8).optional(),
  pinned: z.boolean().optional(),
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
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.phone) {
    const d = parsed.data.phone.replace(/\D/g, "");
    patch.phone = d.startsWith("55") ? d : `55${d}`;
  }
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("saved_contacts")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contact: data });
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
  const { error } = await admin.from("saved_contacts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
