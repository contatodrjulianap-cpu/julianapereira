import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { ReminderItem } from "./reminder-item";

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
  assigned_owner_id: string | null;
  owner_name: string | null;
};

const NON_FINAL_FILTER = "(won,lost,disqualified)";

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

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endToday = new Date(startToday.getTime() + 86400_000 - 1);
  const in3Days = new Date(startToday.getTime() + 3 * 86400_000);
  const in7Days = new Date(startToday.getTime() + 7 * 86400_000);
  const ago7 = new Date(startToday.getTime() - 7 * 86400_000);
  const ago15min = new Date(now.getTime() - 15 * 60_000);

  // Query A: tarefas com follow_up_at <= +7d (lista + contadores hoje/vencidos/3d)
  const tasksReq = (() => {
    let q = supabase
      .from("leads")
      .select(
        "id, name, phone, status, archetype, follow_up_at, follow_up_note, assigned_owner_id",
      )
      .not("follow_up_at", "is", null)
      .not("status", "in", NON_FINAL_FILTER)
      .lte("follow_up_at", in7Days.toISOString())
      .order("follow_up_at", { ascending: true })
      .limit(500);
    if (!isAdmin) q = q.eq("assigned_owner_id", user.id);
    return q;
  })();

  // Query B: frios (count) — sem msg há +7d, não final
  const friosReq = (() => {
    let q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .not("status", "in", NON_FINAL_FILTER)
      .lt("last_message_at", ago7.toISOString());
    if (!isAdmin) q = q.eq("assigned_owner_id", user.id);
    return q;
  })();

  // Query C: fechamentos hoje (count)
  const fechadosReq = (() => {
    let q = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "won")
      .gte("updated_at", startToday.toISOString());
    if (!isAdmin) q = q.eq("assigned_owner_id", user.id);
    return q;
  })();

  // Query D: crm_users pra exibir responsável
  const usersReq = supabase.from("crm_users").select("id, display_name");

  // Query E: PRONTA/ESPERANCOSA aguardando atendimento há +15min (regra v2 playbook)
  // Filtra por archetype quente (PRONTA ou ESPERANCOSA) + status=new + criado há +15min.
  // O "sem msg outbound" é refinado em código (não-trivial no PostgREST puro).
  const prontasReq = (() => {
    let q = supabase
      .from("leads")
      .select(
        "id, name, phone, archetype, quiz_variant, assigned_owner_id, created_at, last_message_at",
      )
      .in("archetype", ["PRONTA", "ESPERANCOSA"])
      .eq("status", "new")
      .lte("created_at", ago15min.toISOString())
      .order("created_at", { ascending: true })
      .limit(50);
    if (!isAdmin) q = q.eq("assigned_owner_id", user.id);
    return q;
  })();

  const [tasksRes, friosRes, fechadosRes, usersRes, prontasRes] =
    await Promise.all([tasksReq, friosReq, fechadosReq, usersReq, prontasReq]);

  const taskLeads = tasksRes.data ?? [];
  const prontaCandidates = prontasRes.data ?? [];
  const ownerNameById = new Map<string, string>();
  for (const u of usersRes.data ?? [])
    ownerNameById.set(u.id, u.display_name);

  // Refina PRONTAs: pega só as que NUNCA receberam outbound (= ninguém atendeu).
  let prontasEsperando: typeof prontaCandidates = [];
  if (prontaCandidates.length > 0) {
    const ids = prontaCandidates.map((p) => p.id);
    const { data: outMsgs } = await supabase
      .from("messages")
      .select("lead_id")
      .in("lead_id", ids)
      .eq("direction", "outbound")
      .limit(500);
    const atendidos = new Set((outMsgs ?? []).map((m) => m.lead_id));
    prontasEsperando = prontaCandidates.filter((p) => !atendidos.has(p.id));
  }

  // Lembretes de avaliação (tabela tasks, fase closer): abertos vencendo até hoje.
  // Gerados pelo cron a partir de scheduled_at; o atendente manda na mão e marca feito.
  let remindersQ = supabase
    .from("tasks")
    .select("id, title, due_at, lead_id, assigned_owner_id")
    .eq("done", false)
    .lte("due_at", endToday.toISOString())
    .order("due_at", { ascending: true })
    .limit(200);
  if (!isAdmin) remindersQ = remindersQ.eq("assigned_owner_id", user.id);
  const { data: reminderRows } = await remindersQ;
  const reminders = reminderRows ?? [];

  const tasksToday: TaskLead[] = [];
  const tasksUpcoming: TaskLead[] = [];
  let vencidos = 0;
  let proximos3dias = 0;

  for (const l of taskLeads) {
    if (!l.follow_up_at) continue;
    const fu = new Date(l.follow_up_at);

    if (fu < startToday) vencidos++;
    if (fu > endToday && fu <= in3Days) proximos3dias++;

    const task: TaskLead = {
      id: l.id,
      name: l.name,
      phone: l.phone,
      status: l.status,
      archetype: l.archetype,
      follow_up_at: l.follow_up_at,
      follow_up_note: l.follow_up_note,
      assigned_owner_id: l.assigned_owner_id,
      owner_name: l.assigned_owner_id
        ? (ownerNameById.get(l.assigned_owner_id) ?? null)
        : null,
    };
    if (fu <= endToday) tasksToday.push(task);
    else tasksUpcoming.push(task); // já filtrado <= in7Days no SQL
  }

  const chamarHoje = tasksToday.length;
  const frios = friosRes.count ?? 0;
  const fechadosHoje = fechadosRes.count ?? 0;

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
          {isAdmin && (
            <p className="text-[10px] text-slate-400 mt-1.5 font-mono">
              admin · {taskLeads.length} tarefas indexadas · hoje{" "}
              {tasksToday.length} · próx 7d {tasksUpcoming.length} · quentes
              aguardando {prontasEsperando.length}
            </p>
          )}
        </header>

        {/* Leads quentes (PRONTA/ESPERANCOSA) aguardando atendimento há +15min — regra v2 */}
        {prontasEsperando.length > 0 && (
          <section className="mb-5 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
            <h2 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-2">
              🔥 Lead quente aguardando
              <span className="text-[11px] font-normal bg-red-200 text-red-900 px-2 py-0.5 rounded-full">
                {prontasEsperando.length} · &gt;15min
              </span>
            </h2>
            <p className="text-[11px] text-red-800 mb-3">
              PRONTA ou ESPERANÇOSO do quiz que ainda não recebeu 1ª mensagem.
              Atender já — cada minuto esfria.
            </p>
            <ul className="space-y-1.5">
              {prontasEsperando.map((p) => {
                const waited = Math.floor(
                  (now.getTime() - new Date(p.created_at).getTime()) / 60_000,
                );
                const variant = p.quiz_variant
                  ? p.quiz_variant === "resina"
                    ? "🦷 resina"
                    : "💎 porcelana"
                  : "—";
                const archBadge =
                  p.archetype === "PRONTA" ? "🔥 PRONTO" : "🟡 ESPERANÇOSO";
                return (
                  <li key={p.id}>
                    <Link
                      href={`/crm/conversas/${p.id}`}
                      className="block rounded-lg bg-white border border-red-200 px-3 py-2 active:bg-red-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">
                          {p.name || p.phone}
                        </p>
                        <span className="shrink-0 text-[10px] font-bold text-red-700">
                          ⏱️ {waited}min
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {archBadge} · {variant}
                        {isAdmin &&
                          p.assigned_owner_id &&
                          ` · 👤 ${
                            ownerNameById.get(p.assigned_owner_id) ?? "?"
                          }`}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Lembretes de avaliação (fase closer) — gerados do scheduled_at, mandados na mão */}
        {reminders.length > 0 && (
          <section className="mb-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
              📞 Avaliações · lembretes &amp; no-shows
              <span className="text-[11px] font-normal bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                {reminders.length}
              </span>
            </h2>
            <p className="text-[11px] text-amber-800 mb-3">
              Avaliações chegando ou que faltaram. Abra a conversa, resolva na
              mão e marque como feito.
            </p>
            <ul className="space-y-1.5">
              {reminders.map((t) => (
                <ReminderItem
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  leadId={t.lead_id}
                  ownerName={
                    isAdmin && t.assigned_owner_id
                      ? (ownerNameById.get(t.assigned_owner_id) ?? null)
                      : null
                  }
                />
              ))}
            </ul>
          </section>
        )}

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
                <TaskRow
                  key={t.id}
                  task={t}
                  variant="today"
                  showOwner={isAdmin}
                />
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
                      <TaskRow
                        key={t.id}
                        task={t}
                        variant="upcoming"
                        showOwner={isAdmin}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </CrmShell>
  );
}

function TaskRow({
  task,
  variant,
  showOwner = false,
}: {
  task: TaskLead;
  variant: "today" | "upcoming";
  showOwner?: boolean;
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
        {showOwner && (
          <p className="text-[10px] font-semibold text-slate-500 mt-1.5">
            👤 {task.owner_name ?? "sem responsável"}
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
