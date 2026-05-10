import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(
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
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createServiceClient();

  const { data: existing, error: fetchErr } = await admin
    .from("leads")
    .select("notes_log")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  const newNote = {
    at: new Date().toISOString(),
    by: user.email ?? "unknown",
    text: parsed.data.text,
  };
  const log = Array.isArray(existing.notes_log) ? existing.notes_log : [];
  log.push(newNote);

  const { data, error } = await admin
    .from("leads")
    .update({ notes_log: log })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead: data });
}
