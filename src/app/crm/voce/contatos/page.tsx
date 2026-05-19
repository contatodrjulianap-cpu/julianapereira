import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";
import { ContactsManager, type SavedContact } from "./manager";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/crm/login");

  const admin = createServiceClient();
  const { data } = await admin
    .from("saved_contacts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("name", { ascending: true });

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
            📇 Contatos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Contatos da clínica, parceiros e referências — pra compartilhar
            rápido no WhatsApp dos pacientes.
          </p>
        </header>
        <ContactsManager initial={(data as SavedContact[]) ?? []} />
      </div>
    </CrmShell>
  );
}
