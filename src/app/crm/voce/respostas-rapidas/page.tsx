import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";
import { QuickRepliesManager, type QuickReply } from "./manager";

export const dynamic = "force-dynamic";

export default async function RespostasRapidasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const admin = createServiceClient();
  const { data } = await admin
    .from("quick_replies")
    .select("*")
    .order("favorite", { ascending: false })
    .order("uses_count", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <CrmShell active="voce" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-6">
        <div className="mb-5">
          <Link
            href="/crm/voce"
            className="text-sm text-slate-500 inline-flex items-center gap-1"
          >
            ← Você
          </Link>
        </div>
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            ⚡ Respostas rápidas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Templates compartilhados pela clínica. Use a variável{" "}
            <code className="bg-slate-100 px-1 rounded text-[10px]">
              {"{primeiro_nome}"}
            </code>{" "}
            pra personalizar.
          </p>
        </header>
        <QuickRepliesManager initial={(data as QuickReply[]) ?? []} />
      </div>
    </CrmShell>
  );
}
