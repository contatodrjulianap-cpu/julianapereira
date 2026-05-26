import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CrmBottomNav } from "./crm-bottom-nav";

export type CrmTab =
  | "inbox"
  | "pipeline"
  | "funnel"
  | "log"
  | "builder"
  | "integrations"
  | "status"
  | "ligacoes"
  | "conversas"
  | "voce";

export async function CrmShell({
  active,
  userEmail,
  children,
  fullViewport = false,
}: {
  active: CrmTab;
  userEmail: string;
  children: React.ReactNode;
  fullViewport?: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isAdmin = false;
  if (user) {
    const { data: crmUser } = await supabase
      .from("crm_users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = crmUser?.role === "admin";
  }

  return (
    <div
      className={`flex flex-col bg-slate-50/60 pb-14 md:pb-0 ${
        fullViewport
          ? "h-dvh md:h-dvh overflow-hidden"
          : "min-h-screen overflow-x-hidden"
      }`}
    >
      <header className="hidden md:block bg-white border-b border-slate-200/70 sticky top-0 z-10">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">
                CRM Sakura
              </h1>
              <p className="text-[11px] text-slate-500 leading-none mt-0.5">
                Dra. Juliana Pereira
              </p>
            </div>
            <nav className="flex gap-0.5">
              <TabLink href="/crm" active={active === "inbox"}>
                💬 Conversas
              </TabLink>
              <TabLink href="/crm/pipeline" active={active === "pipeline"}>
                📊 Pipeline
              </TabLink>
              <TabLink href="/crm/status" active={active === "status"}>
                ✨ Status
              </TabLink>
              {isAdmin && (
                <>
                  <TabLink href="/crm/funnel" active={active === "funnel"}>
                    📈 Funil
                  </TabLink>
                  <TabLink href="/crm/log" active={active === "log"}>
                    🪵 Log
                  </TabLink>
                  <TabLink href="/crm/builder" active={active === "builder"}>
                    🛠️ Construtor
                  </TabLink>
                  <TabLink
                    href="/crm/integrations"
                    active={active === "integrations"}
                  >
                    🔌 Integrações
                  </TabLink>
                </>
              )}
            </nav>
          </div>
          <form action="/api/auth/signout" method="POST" className="contents">
            <button
              type="submit"
              className="text-xs text-slate-500 hover:underline"
              title={userEmail}
            >
              sair
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
      <CrmBottomNav />
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}
