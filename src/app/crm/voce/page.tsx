import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";

export const dynamic = "force-dynamic";

type Section = {
  href: string;
  icon: string;
  label: string;
  description: string;
  adminOnly?: boolean;
};

const SECTIONS: Section[] = [
  {
    href: "/crm/voce/guia",
    icon: "📖",
    label: "Guia de ícones",
    description: "O que cada emoji, logo de canal e gesto significa",
  },
  {
    href: "/crm/voce/respostas-rapidas",
    icon: "⚡",
    label: "Respostas rápidas",
    description: "Templates de mensagem com variável {primeiro_nome}",
  },
  {
    href: "/crm/voce/notificacoes",
    icon: "🔔",
    label: "Notificações",
    description: "Alerta no celular toda vez que cair lead quente (PRONTA/ESPERANCOSA)",
  },
  {
    href: "/crm/voce/contatos",
    icon: "📇",
    label: "Contatos",
    description: "Cadastro de contatos da clínica e parceiros pra compartilhar",
  },
  {
    href: "/crm/leads",
    icon: "📇",
    label: "Todos os leads",
    description: "Base completa, paginada e com busca/filtros (leve)",
  },
  {
    href: "/crm/pipeline",
    icon: "📊",
    label: "Pipeline",
    description: "Kanban dos leads quentes (prontos e esperançosos)",
  },
  {
    href: "/crm/funnel",
    icon: "📈",
    label: "Funil",
    description: "Métricas e taxas de conversão por etapa",
    adminOnly: true,
  },
  {
    href: "/crm/log",
    icon: "🪵",
    label: "Log",
    description: "Histórico de eventos do sistema",
    adminOnly: true,
  },
  {
    href: "/crm/builder",
    icon: "🛠️",
    label: "Construtor do quiz",
    description: "Edita perguntas, copy e arquétipos do quiz",
    adminOnly: true,
  },
  {
    href: "/crm/integrations",
    icon: "🔌",
    label: "Integrações",
    description: "WhatsApp, Facebook, mensagens de boas-vindas",
    adminOnly: true,
  },
];

export default async function VocePage() {
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
  const isAdmin = crmUser?.role === "admin";
  const visibleSections = SECTIONS.filter((s) => isAdmin || !s.adminOnly);

  return (
    <CrmShell active="voce" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Você</h1>
          <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
        </header>

        <div className="space-y-2 mb-6">
          {visibleSections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl active:bg-slate-50 transition"
            >
              <span className="text-2xl">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-900">
                  {s.label}
                </p>
                <p className="text-xs text-slate-500 leading-snug">
                  {s.description}
                </p>
              </div>
              <span className="text-slate-300">→</span>
            </Link>
          ))}
        </div>

        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl bg-white"
          >
            Sair
          </button>
        </form>
      </div>
    </CrmShell>
  );
}
