import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Marca a conversa como lida (abriu o thread). Atualiza só last_read_at — o
// trigger de leads ignora esse campo, então updated_at NÃO é bumpado (preserva
// métricas de won/mês e "atualizados hoje"). Fire-and-forget no client.
export async function POST(
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
  const { error } = await admin
    .from("leads")
    .update({ last_read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
