import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const PatchBody = z.object({
  label: z.string().trim().min(1).max(40).optional(),
  badge: z.string().min(1).max(80).optional(),
  sort_order: z.number().int().optional(),
  active: z.boolean().optional(),
});

// Só chaves custom (prefixo c_) podem ser editadas/removidas — sistema é imutável.
function guardCustom(key: string): boolean {
  return key.startsWith("c_");
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { key } = await params;
  if (!guardCustom(key)) {
    return NextResponse.json({ error: "status de sistema é protegido" }, { status: 403 });
  }
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("custom_lead_statuses")
    .update(parsed.data)
    .eq("key", key)
    .select("key, label, badge, sort_order, active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { key } = await params;
  if (!guardCustom(key)) {
    return NextResponse.json({ error: "status de sistema é protegido" }, { status: 403 });
  }

  const admin = createServiceClient();
  // Se algum lead ainda usa esse status, só desativa (preserva o label na UI).
  // Senão, remove de vez.
  const { count } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("status", key);

  if ((count ?? 0) > 0) {
    const { error } = await admin
      .from("custom_lead_statuses")
      .update({ active: false })
      .eq("key", key);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, deactivated: true, leads: count });
  }

  const { error } = await admin
    .from("custom_lead_statuses")
    .delete()
    .eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: true });
}
