import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { InsightsView, type DailyInsight } from "./insights-view";

// Sempre fresco no load. A tabela atualiza 1x/dia (cron 7h), então não há
// ganho real em websocket — force-dynamic já entrega o último insight.
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (crmUser?.role !== "admin") redirect("/crm");

  const { data: insights } = await supabase
    .from("daily_insights")
    .select(
      "id, dia, leads_novos, por_fonte, transicoes, wons, parados, por_atendente, investimento_brl, cpl_brl, cpa_brl, narrativa, alerts, fontes, updated_at",
    )
    .eq("cliente", "sakura")
    .order("dia", { ascending: false })
    .limit(30);

  return (
    <CrmShell active="insights" userEmail={user.email ?? ""}>
      <InsightsView initial={(insights ?? []) as DailyInsight[]} />
    </CrmShell>
  );
}
