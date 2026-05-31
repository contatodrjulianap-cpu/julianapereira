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
  // lead_id opcional: no fluxo novo a selfie é enviada DEPOIS do lead já estar
  // salvo (lead → vídeo → selfie). Quando presente, associamos a foto ao lead.
  const leadIdRaw = form.get("lead_id");
  const leadId =
    typeof leadIdRaw === "string" && leadIdRaw.length > 0 ? leadIdRaw : null;
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

  // Associa ao lead já criado (fluxo lead→vídeo→selfie). Falha aqui não quebra
  // o upload — a foto já está no storage; o vínculo é best-effort.
  if (leadId) {
    const { error: updErr } = await supabase
      .from("leads")
      .update({ selfie_url: path })
      .eq("id", leadId);
    if (updErr) console.error("selfie lead-link error", updErr.message);
  }

  return NextResponse.json({ path });
}
