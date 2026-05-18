import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("selfie_url")
    .eq("id", id)
    .single();

  if (error || !lead?.selfie_url) {
    return NextResponse.json({ error: "selfie not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("quiz-selfies")
    .createSignedUrl(lead.selfie_url, 60 * 60); // 1h

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
