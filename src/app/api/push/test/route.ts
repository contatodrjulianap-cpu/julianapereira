import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

// POST /api/push/test
// Dispara push de teste pro user logado. Útil pra Milena/Ju conferirem
// que o setup tá funcionando antes do 1º lead PRONTA real chegar.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await sendPushToUser(user.id, {
    title: "🔥 Teste de alerta Sakura",
    body: "Se você está vendo isso, push tá ativo. Lead quente vai chegar assim.",
    url: "/crm",
    tag: "sakura-test",
    requireInteraction: false,
  });

  return NextResponse.json(result);
}
