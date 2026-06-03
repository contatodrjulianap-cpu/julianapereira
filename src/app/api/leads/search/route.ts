import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Busca leads por nome/telefone pra "iniciar conversa" — inclui leads sem
// mensagem (que não aparecem na lista de Conversas). RLS: não-admin só os seus.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = crmUser?.role === "admin";

  const raw = (req.nextUrl.searchParams.get("q") ?? "").trim();
  // Sanitiza pra não quebrar o filtro .or() do PostgREST.
  const q = raw.replace(/[%,()*]/g, " ").trim();
  if (q.length < 2) return NextResponse.json({ leads: [] });
  const digits = q.replace(/\D/g, "");

  const ors = [`name.ilike.%${q}%`];
  if (digits.length >= 3) ors.push(`phone.ilike.%${digits}%`);

  let query = supabase
    .from("leads")
    .select("id, name, phone, selfie_url, status")
    .or(ors.join(","))
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (!isAdmin) query = query.eq("assigned_owner_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}
