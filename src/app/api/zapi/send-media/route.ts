import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendImage, sendAudio, sendDocument } from "@/lib/zapi";
import { resolveZapiCredsForLead } from "@/lib/wa-router";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { error: "multipart/form-data esperado" },
      { status: 400 },
    );
  }

  const leadId = String(form.get("lead_id") ?? "");
  const file = form.get("file");
  const caption = String(form.get("caption") ?? "").trim();
  if (!leadId) {
    return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "campo file obrigatório" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "arquivo > 20MB" }, { status: 413 });
  }

  const admin = createServiceClient();
  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .select("id, phone, wa_number_id, assigned_owner_id")
    .eq("id", leadId)
    .single();
  if (leadErr || !lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  // Upload pro bucket privado.
  // Navegadores gravam com codec no mime (audio/webm;codecs=opus); o bucket
  // valida mime exato, então usamos só o tipo base no contentType.
  const baseMime = file.type.split(";")[0].trim();
  const isImage = baseMime.startsWith("image/");
  const isAudio = baseMime.startsWith("audio/");
  const ext = (file.name.split(".").pop() || baseMime.split("/")[1] || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  const safeExt = ext === "jpeg" ? "jpg" : ext;
  const path = `${lead.id}/${randomUUID()}.${safeExt}`;
  const { error: upErr } = await admin.storage
    .from("wa-media")
    .upload(path, file, { contentType: baseMime, upsert: false });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  const { data: signed, error: signErr } = await admin.storage
    .from("wa-media")
    .createSignedUrl(path, 60 * 60); // 1h — tempo suficiente pra Z-API baixar
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "sign failed" },
      { status: 500 },
    );
  }
  const url = signed.signedUrl;

  const creds = await resolveZapiCredsForLead(lead.id);
  const meta = {
    lead_id: lead.id,
    instance_id: creds?.instanceId,
    token: creds?.token,
  };

  let zapiRes;
  try {
    if (isImage) {
      zapiRes = await sendImage(
        { phone: lead.phone, image: url, caption: caption || undefined },
        meta,
      );
    } else if (isAudio) {
      zapiRes = await sendAudio({ phone: lead.phone, audio: url }, meta);
    } else {
      zapiRes = await sendDocument(
        {
          phone: lead.phone,
          document: url,
          fileName: file.name,
          caption: caption || undefined,
        },
        safeExt,
        meta,
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "send failed" },
      { status: 502 },
    );
  }

  await admin.from("messages").insert({
    lead_id: lead.id,
    direction: "outbound",
    text: caption || null,
    media_url: path, // armazena PATH (signed URL é gerado on-demand pra render)
    media_type: isImage ? "image" : isAudio ? "audio" : "document",
    raw: zapiRes as unknown as Record<string, unknown>,
    zapi_message_id:
      (zapiRes as { messageId?: string })?.messageId ?? null,
    sent_by: user.id,
  });

  await admin
    .from("leads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", lead.id);

  return NextResponse.json({ ok: true });
}
