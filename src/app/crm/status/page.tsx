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

type TaskLead = {
  id: string;
  name: string | null;
  phone: string;
  status: string | null;
  archetype: string | null;
  follow_up_at: string;
  follow_up_note: string | null;
};

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

  let q = supabase
    .from("leads")
    .select(
      "id, name, phone, status, archetype, next_contact_at, follow_up_at, follow_up_note, last_message_at, updated_at",
    )
    .limit(500);
  if (!isAdmin) q = q.eq("assigned_owner_id", user.id);
  const { data: leadsRaw } = await q;
  const leads = leadsRaw ?? [];

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86400_000 - 1);
  const in3Days = new Date(startToday.getTime() + 3 * 86400_000);
  const in7Days = new Date(startToday.getTime() + 7 * 86400_000);
  const ago7 = new Date(startToday.getTime() - 7 * 86400_000);
  const todayYmd = toYmd(startToday);

  const isFinal = (s: string | null) =>
    s === "won" || s === "lost" || s === "disqualified";

  let chamarHoje = 0;
  let vencidos = 0;
  let proximos3dias = 0;
  let frios = 0;
  let fechadosHoje = 0;

  // Listas agrupadas pra renderizar embaixo dos cards
  const tasksToday: TaskLead[] = []; // follow_up_at <= fim de hoje (inclui vencidos)
  const tasksUpcoming: TaskLead[] = []; // follow_up_at > hoje, <= +7d

  for (const l of leads) {
    const final = isFinal(l.status);

    const nextHoje = l.next_contact_at === todayYmd;
    const followHoje = l.follow_up_at && new Date(l.follow_up_at) <= endToday;
    if (!final && (nextHoje || followHoje)) chamarHoje++;

    if (!final && l.follow_up_at && new Date(l.follow_up_at) < startToday)
      vencidos++;

    const nextProximo =
      l.next_contact_at &&
      l.next_contact_at > todayYmd &&
      new Date(l.next_contact_at) <= in3Days;
    const followProximo =
      l.follow_up_at &&
      new Date(l.follow_up_at) > endToday &&
      new Date(l.follow_up_at) <= in3Days;
    if (!final && (nextProximo || followProximo)) proximos3dias++;

    if (!final && l.last_message_at && new Date(l.last_message_at) < ago7)
      frios++;

    if (
      l.status === "won" &&
      l.updated_at &&
      new Date(l.updated_at) >= startToday
    )
      fechadosHoje++;

    if (!final && l.follow_up_at) {
      const fu = new Date(l.follow_up_at);
      const task: TaskLead = {
        id: l.id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        archetype: l.archetype,
        follow_up_at: l.follow_up_at,
        follow_up_note: l.follow_up_note,
      };
      if (fu <= endToday) tasksToday.push(task);
      else if (fu <= in7Days) tasksUpcoming.push(task);
    }
  }

  tasksToday.sort((a, b) => a.follow_up_at.localeCompare(b.follow_up_at));
  tasksUpcoming.sort((a, b) => a.follow_up_at.localeCompare(b.follow_up_at));

  // Agrupa próximos por dia (YYYY-MM-DD)
  const upcomingByDay = new Map<string, TaskLead[]>();
  for (const t of tasksUpcoming) {
    const day = toYmd(new Date(t.follow_up_at));
    const arr = upcomingByDay.get(day) ?? [];
    arr.push(t);
    upcomingByDay.set(day, arr);
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

        {/* Tarefas hoje (inclui vencidos) */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900 mb-2.5 flex items-baseline gap-2">
            📋 Tarefas hoje
            <span className="text-xs font-normal text-slate-400">
              ({tasksToday.length})
            </span>
          </h2>
          {tasksToday.length === 0 ? (
            <p className="text-xs text-slate-400 px-1 py-3">
              Nenhum follow-up agendado pra hoje.
            </p>
          ) : (
            <ul className="space-y-2">
              {tasksToday.map((t) => (
                <TaskRow key={t.id} task={t} variant="today" />
              ))}
            </ul>
          )}
        </section>

        {/* Próximos 7 dias agrupado por dia */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-900 mb-2.5 flex items-baseline gap-2">
            📅 Próximos 7 dias
            <span className="text-xs font-normal text-slate-400">
              ({tasksUpcoming.length})
            </span>
          </h2>
          {tasksUpcoming.length === 0 ? (
            <p className="text-xs text-slate-400 px-1 py-3">
              Sem follow-ups agendados nos próximos dias.
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(upcomingByDay.entries()).map(([day, items]) => (
                <div key={day}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    {formatDayLabel(day)} · {items.length}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((t) => (
                      <TaskRow key={t.id} task={t} variant="upcoming" />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {leads.length === 0 && (
          <p className="text-center text-xs text-slate-400 mt-8">
            Sem leads ainda.
          </p>
        )}
      </div>
    </CrmShell>
  );
}

function TaskRow({
  task,
  variant,
}: {
  task: TaskLead;
  variant: "today" | "upcoming";
}) {
  const fu = new Date(task.follow_up_at);
  const overdue = variant === "today" && fu < new Date(Date.now() - 86400_000);
  const hh = fu.getHours().toString().padStart(2, "0");
  const mm = fu.getMinutes().toString().padStart(2, "0");
  const time = `${hh}:${mm}`;

  return (
    <li>
      <Link
        href={`/crm/conversas/${task.id}`}
        className={`block rounded-xl border px-3 py-2.5 active:bg-slate-50 ${
          overdue
            ? "border-amber-300 bg-amber-50/60"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-slate-900 truncate">
            {task.name || task.phone}
          </p>
          <span
            className={`shrink-0 text-[10px] font-semibold ${
              overdue ? "text-amber-700" : "text-slate-500"
            }`}
          >
            {variant === "today" && overdue ? "⚠️ vencido" : time}
          </span>
        </div>
        {task.follow_up_note && (
          <p className="text-[12px] text-slate-600 mt-1 leading-snug line-clamp-2">
            {task.follow_up_note}
          </p>
        )}
        {!task.follow_up_note && (
          <p className="text-[11px] text-slate-400 italic mt-1">
            sem tarefa anotada
          </p>
        )}
      </Link>
    </li>
  );
}

function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round(
    (date.getTime() - startToday.getTime()) / 86400_000,
  );
  if (diffDays === 1) return "Amanhã";
  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const wd = weekdays[date.getDay()];
  const dd = d.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  return `${wd} ${dd}/${mm}`;
}
