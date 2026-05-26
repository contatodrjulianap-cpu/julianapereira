import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";

export const dynamic = "force-dynamic";

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function StatusPage() {
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

  let q = supabase.from("leads").select("id, status, next_contact_at, follow_up_at, last_message_at, updated_at").limit(500);
  if (!isAdmin) q = q.eq("assigned_owner_id", user.id);
  const { data: leadsRaw } = await q;
  const leads = leadsRaw ?? [];

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86400_000 - 1);
  const in3Days = new Date(startToday.getTime() + 3 * 86400_000);
  const ago7 = new Date(startToday.getTime() - 7 * 86400_000);
  const todayYmd = toYmd(startToday);

  const isFinal = (s: string | null) =>
    s === "won" || s === "lost" || s === "disqualified";

  let chamarHoje = 0;
  let vencidos = 0;
  let proximos3dias = 0;
  let frios = 0;
  let fechadosHoje = 0;

  for (const l of leads) {
    const final = isFinal(l.status);

    // Chamar hoje: next_contact_at = hoje OU follow_up_at <= fim de hoje (status não final)
    const nextHoje = l.next_contact_at === todayYmd;
    const followHoje = l.follow_up_at && new Date(l.follow_up_at) <= endToday;
    if (!final && (nextHoje || followHoje)) chamarHoje++;

    // Vencidos: follow_up_at < hoje (status não final)
    if (!final && l.follow_up_at && new Date(l.follow_up_at) < startToday) vencidos++;

    // Próximos 3 dias: next_contact_at OR follow_up_at entre amanhã e +3
    const nextProximo =
      l.next_contact_at && l.next_contact_at > todayYmd && new Date(l.next_contact_at) <= in3Days;
    const followProximo =
      l.follow_up_at && new Date(l.follow_up_at) > endToday && new Date(l.follow_up_at) <= in3Days;
    if (!final && (nextProximo || followProximo)) proximos3dias++;

    // Frios: sem msg há +7 dias (não final)
    if (!final && l.last_message_at && new Date(l.last_message_at) < ago7) frios++;

    // Fechados hoje: status=won e updated_at hoje
    if (l.status === "won" && l.updated_at && new Date(l.updated_at) >= startToday) fechadosHoje++;
  }

  const CARDS = [
    {
      key: "hoje",
      emoji: "🔥",
      title: "Chamar hoje",
      count: chamarHoje,
      bg: "bg-rose-50",
      fg: "text-rose-700",
      href: "/crm/conversas?filter=hoje",
    },
    {
      key: "vencidos",
      emoji: "⚠️",
      title: "Follow-ups vencidos",
      count: vencidos,
      bg: "bg-amber-50",
      fg: "text-amber-700",
      href: "/crm/conversas?filter=vencidos",
    },
    {
      key: "agendados",
      emoji: "📅",
      title: "Próximos 3 dias",
      count: proximos3dias,
      bg: "bg-sky-50",
      fg: "text-sky-700",
      href: "/crm/conversas?filter=proximos",
    },
    {
      key: "frios",
      emoji: "❄️",
      title: "Frios há +7 dias",
      count: frios,
      bg: "bg-slate-100",
      fg: "text-slate-700",
      href: "/crm/conversas?filter=frios",
    },
    {
      key: "fechados",
      emoji: "✅",
      title: "Fechamentos hoje",
      count: fechadosHoje,
      bg: "bg-emerald-50",
      fg: "text-emerald-700",
      href: "/crm/conversas?bucket=fechados",
    },
  ];

  return (
    <CrmShell active="status" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-md w-full mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">✨ Status</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            O que tá pendente, vencendo ou esfriando.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-2.5">
          {CARDS.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className={`${c.bg} rounded-2xl p-4 flex flex-col active:opacity-70 transition`}
            >
              <span className="text-2xl">{c.emoji}</span>
              <p
                className={`text-3xl font-bold mt-2 ${c.fg}`}
                style={{ lineHeight: 1 }}
              >
                {c.count}
              </p>
              <p className={`text-[11px] font-semibold mt-1 ${c.fg} leading-tight`}>
                {c.title}
              </p>
            </Link>
          ))}
        </div>

        {leads.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-8">
            Sem leads ainda.
          </p>
        )}
      </div>
    </CrmShell>
  );
}
