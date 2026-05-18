import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "multipart/form-data esperado" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "campo 'file' obrigatório" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "arquivo > 8MB" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `tipo ${file.type} não suportado` }, { status: 415 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${randomUUID()}.${ext}`;

  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from("quiz-selfies")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("selfie upload error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path });
}
