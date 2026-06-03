import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { SYSTEM_STATUS_KEYS } from "@/lib/lead-status";

// Slug "c_<normalizado>" — prefixo garante que nunca colide com chave de sistema.
function slugify(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `c_${base || "status"}`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("custom_lead_statuses")
    .select("key, label, badge, sort_order, active")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ statuses: data ?? [] });
}

const PostBody = z.object({
  label: z.string().trim().min(1).max(40),
  badge: z.string().min(1).max(80),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createServiceClient();
  // Garante key única (e fora do espaço de sistema).
  let key = slugify(parsed.data.label);
  if (SYSTEM_STATUS_KEYS.has(key)) key = `${key}_x`;
  const { data: existing } = await admin
    .from("custom_lead_statuses")
    .select("key, sort_order");
  const taken = new Set((existing ?? []).map((r) => r.key));
  if (taken.has(key)) {
    let n = 2;
    while (taken.has(`${key}_${n}`)) n++;
    key = `${key}_${n}`;
  }
  const maxOrder = (existing ?? []).reduce(
    (m, r) => Math.max(m, r.sort_order ?? 0),
    0,
  );

  const { data, error } = await admin
    .from("custom_lead_statuses")
    .insert({
      key,
      label: parsed.data.label,
      badge: parsed.data.badge,
      sort_order: maxOrder + 1,
      created_by: user.id,
    })
    .select("key, label, badge, sort_order, active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}
