"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  match: (pathname: string) => boolean;
  icon: string;
  label: string;
};

const TABS: Tab[] = [
  {
    href: "/crm/status",
    match: (p) => p.startsWith("/crm/status"),
    icon: "✨",
    label: "Status",
  },
  {
    href: "/crm/ligacoes",
    match: (p) => p.startsWith("/crm/ligacoes"),
    icon: "📞",
    label: "Ligações",
  },
  {
    href: "/crm/conversas",
    match: (p) => p === "/crm" || p.startsWith("/crm/conversas"),
    icon: "💬",
    label: "Conversas",
  },
  {
    href: "/crm/voce",
    match: (p) =>
      p.startsWith("/crm/voce") ||
      p.startsWith("/crm/builder") ||
      p.startsWith("/crm/integrations") ||
      p.startsWith("/crm/log") ||
      p.startsWith("/crm/pipeline") ||
      p.startsWith("/crm/funnel"),
    icon: "👤",
    label: "Você",
  },
];

// Esconde bottom nav dentro da thread de uma conversa — senão sobrepõe o input.
const HIDE_PATTERNS: RegExp[] = [/^\/crm\/conversas\/[^/]+$/];

export function CrmBottomNav() {
  const pathname = usePathname() ?? "";
  if (HIDE_PATTERNS.some((re) => re.test(pathname))) return null;
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch h-14">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{
                color: active ? "var(--sakura-cocoa)" : "rgb(100 116 139)",
              }}
            >
              <span className="text-[18px] leading-none">{t.icon}</span>
              <span
                className="text-[10px] tracking-tight"
                style={{ fontWeight: active ? 600 : 500 }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
