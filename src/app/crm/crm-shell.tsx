import Link from "next/link";

export type CrmTab = "inbox" | "pipeline" | "funnel" | "log" | "builder";

export function CrmShell({
  active,
  userEmail,
  children,
}: {
  active: CrmTab;
  userEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-base font-bold tracking-tight">CRM Sakura</h1>
              <p className="text-xs text-slate-500 leading-none">
                Dra. Juliana Pereira
              </p>
            </div>
            <nav className="flex gap-1">
              <TabLink href="/crm" active={active === "inbox"}>
                💬 Conversas
              </TabLink>
              <TabLink href="/crm/pipeline" active={active === "pipeline"}>
                📊 Pipeline
              </TabLink>
              <TabLink href="/crm/funnel" active={active === "funnel"}>
                📈 Funil
              </TabLink>
              <TabLink href="/crm/log" active={active === "log"}>
                🪵 Log
              </TabLink>
              <TabLink href="/crm/builder" active={active === "builder"}>
                🛠️ Construtor
              </TabLink>
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
      <div className="flex-1 flex flex-col">{children}</div>
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
      className={`px-3 py-1.5 text-sm rounded-md transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}
