import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();
  const { data: msg, error } = await admin
    .from("messages")
    .select("media_url")
    .eq("id", id)
    .maybeSingle();
  if (error || !msg?.media_url) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Mídia outbound vai pra wa-media; inbound vai pro mesmo bucket via webhook
  // (quando implementarmos). Por ora, tenta wa-media.
  const { data: signed, error: signErr } = await admin.storage
    .from("wa-media")
    .createSignedUrl(msg.media_url, 60 * 60);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "sign failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: signed.signedUrl });
}
