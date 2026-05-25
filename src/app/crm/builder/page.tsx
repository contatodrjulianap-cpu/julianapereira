import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { getQuizConfig } from "@/lib/quiz-config";
import { isVariant, type Variant } from "@/lib/quiz-archetypes";
import { BuilderView } from "./builder-view";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crm/login");
  }

  const { data: crmUser } = await supabase
    .from("crm_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (crmUser?.role !== "admin") redirect("/crm");

  const { variant: rawVariant } = await searchParams;
  const variant: Variant = isVariant(rawVariant ?? "") ? (rawVariant as Variant) : "resina";

  const config = await getQuizConfig(variant);

  return (
    <CrmShell active="builder" userEmail={user.email ?? ""}>
      <BuilderView initialConfig={config} variant={variant} />
    </CrmShell>
  );
}
