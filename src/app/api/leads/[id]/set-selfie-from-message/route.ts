import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const Body = z.object({
  message_id: z.string().uuid(),
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

  const { id: leadId } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createServiceClient();
  const { data: msg, error: msgErr } = await admin
    .from("messages")
    .select("media_url, media_type, lead_id")
    .eq("id", parsed.data.message_id)
    .single();
  if (msgErr || !msg) {
    return NextResponse.json({ error: "message not found" }, { status: 404 });
  }
  if (msg.lead_id !== leadId) {
    return NextResponse.json(
      { error: "message belongs to another lead" },
      { status: 400 },
    );
  }
  if (msg.media_type !== "image" || !msg.media_url) {
    return NextResponse.json(
      { error: "message is not an image" },
      { status: 400 },
    );
  }

  // Baixa da bucket wa-media e re-upload em quiz-selfies (sem cross-bucket copy nativo).
  const { data: blob, error: dlErr } = await admin.storage
    .from("wa-media")
    .download(msg.media_url);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: dlErr?.message ?? "download failed" },
      { status: 500 },
    );
  }
  const ext = (msg.media_url.split(".").pop() ?? "jpg").toLowerCase();
  const newPath = `${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from("quiz-selfies")
    .upload(newPath, blob, { upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .update({ selfie_url: newPath })
    .eq("id", leadId)
    .select()
    .single();
  if (leadErr) {
    return NextResponse.json({ error: leadErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead });
}
