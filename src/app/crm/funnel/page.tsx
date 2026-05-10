import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { FunnelView, type FunnelMetrics } from "./funnel-view";

export const dynamic = "force-dynamic";

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const params = await searchParams;
  const days = Math.min(Math.max(Number(params.days) || 30, 1), 365);

  // Roda RPC pra agregar
  const admin = createServiceClient();
  const { data, error } = await admin.rpc("quiz_funnel_metrics", {
    days_back: days,
  });

  const metrics: FunnelMetrics = (data as FunnelMetrics) ?? {
    days_back: days,
    pageviews: 0,
    leads_total: 0,
    wa_clicks: 0,
    phone_matched: 0,
    by_step: [],
  };

  return (
    <CrmShell active="funnel" userEmail={user.email ?? ""}>
      <FunnelView metrics={metrics} error={error?.message ?? null} days={days} />
    </CrmShell>
  );
}
