import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CrmShell } from "../../crm-shell";

export const dynamic = "force-dynamic";

// Auditoria admin: conversas onde lead manifestou objeção de preço e
// atendente validou (M1) mas não fez a pergunta de isolamento (M2).
// Foco em ajudar Lucas a treinar Barbara/Gabi no playbook v2.

const RE_OBJECAO =
  /\b(caro|or[çc]amento|condi[çc][oõ]es|fora\s+(do|da|de|d[ao]\s+minha|d[ao])\s+\w+|fora.*alcance|fora.*realidade|barato|mais\s+em\s+conta|n[aã]o\s+cabe)\b/i;
const RE_M1 =
  /\b(entendo|planejamento\s+(emocional|financeiro)|essa\s+decis[ãa]o|essa\s+mudan[çc]a)\b/i;
const RE_M2 =
  /(posso\s+te\s+perguntar.*coisa|valor.*agora.*ou|tratamento\s+em\s+si|medo.*ou.*d[úu]vida|o\s+que.*impede.*hoje)/i;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
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
  if (!isAdmin) redirect("/crm");

  const sp = await searchParams;
  const days = Math.max(1, Math.min(30, Number(sp.days ?? 7)));

  const admin = createServiceClient();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const { data: msgs } = await admin
    .from("messages")
    .select("id, lead_id, direction, text, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20_000);

  const byLead = new Map<
    string,
    { id: string; direction: string; text: string | null; created_at: string }[]
  >();
  for (const m of msgs ?? []) {
    const arr = byLead.get(m.lead_id) ?? [];
    arr.push(m);
    byLead.set(m.lead_id, arr);
  }

  const offenders: {
    lead_id: string;
    objection_text: string;
    objection_at: string;
    m1_text: string;
    m1_at: string;
    msgs_after_m1: number;
  }[] = [];

  for (const [lead_id, leadMsgs] of byLead.entries()) {
    const objIdx = leadMsgs.findIndex(
      (m) => m.direction === "inbound" && m.text && RE_OBJECAO.test(m.text),
    );
    if (objIdx === -1) continue;
    const obj = leadMsgs[objIdx];
    const objTime = new Date(obj.created_at).getTime();

    const m1 = leadMsgs.find(
      (m, i) =>
        i > objIdx &&
        m.direction === "outbound" &&
        m.text &&
        RE_M1.test(m.text) &&
        new Date(m.created_at).getTime() - objTime <= 6 * 3600_000,
    );
    if (!m1) continue;

    const m1Time = new Date(m1.created_at).getTime();
    const afterM1 = leadMsgs.filter(
      (m) =>
        new Date(m.created_at).getTime() > m1Time &&
        new Date(m.created_at).getTime() - m1Time <= 24 * 3600_000,
    );
    const outAfter = afterM1.filter((m) => m.direction === "outbound");
    const has_m2 = outAfter.some((m) => m.text && RE_M2.test(m.text));

    if (!has_m2) {
      offenders.push({
        lead_id,
        objection_text: obj.text!.slice(0, 280),
        objection_at: obj.created_at,
        m1_text: m1.text!.slice(0, 280),
        m1_at: m1.created_at,
        msgs_after_m1: outAfter.length,
      });
    }
  }

  const ids = offenders.map((o) => o.lead_id);
  const { data: leadRows } = ids.length
    ? await admin
        .from("leads")
        .select("id, name, phone, status, archetype, assigned_owner_id")
        .in("id", ids)
    : { data: [] };
  const leadsById = new Map((leadRows ?? []).map((l) => [l.id, l]));

  const { data: users } = await admin
    .from("crm_users")
    .select("id, display_name");
  const ownerName = new Map(
    (users ?? []).map((u) => [u.id, u.display_name as string]),
  );

  const sorted = offenders.sort(
    (a, b) =>
      new Date(b.objection_at).getTime() -
      new Date(a.objection_at).getTime(),
  );

  return (
    <CrmShell active="status" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <header className="mb-5">
          <Link
            href="/crm/status"
            className="text-xs text-slate-500 inline-flex items-center gap-1"
          >
            ← Status
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 mt-2">
            🔑 Auditoria · Objeção sem M2
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Conversas onde lead manifestou objeção de preço, atendente validou
            (M1) mas <strong>não fez</strong> a pergunta de isolamento (M2).
            Lacuna #1 do playbook v2.
          </p>
          <div className="mt-3 flex gap-2">
            {[3, 7, 14, 30].map((n) => (
              <Link
                key={n}
                href={`/crm/audit/objection-no-m2?days=${n}`}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                  days === n
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {n}d
              </Link>
            ))}
          </div>
        </header>

        <div className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          <strong>{sorted.length}</strong> conversa(s) com objeção+M1 mas sem
          M2 nos últimos <strong>{days}</strong> dias.
        </div>

        {sorted.length === 0 ? (
          <p className="text-center text-sm text-slate-400 mt-12">
            🎉 Sem falhas detectadas no período.
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((o) => {
              const lead = leadsById.get(o.lead_id);
              const owner = lead?.assigned_owner_id
                ? ownerName.get(lead.assigned_owner_id)
                : null;
              return (
                <li
                  key={o.lead_id}
                  className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <Link
                      href={`/crm/conversas/${o.lead_id}`}
                      className="text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {lead?.name || lead?.phone || o.lead_id.slice(0, 8)}
                    </Link>
                    <span className="text-[10px] text-slate-500">
                      {new Date(o.objection_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {owner && (
                    <p className="text-[10px] text-slate-500 mb-2">
                      👤 {owner} · {lead?.status} ·{" "}
                      {lead?.archetype ?? "-"}
                    </p>
                  )}
                  <div className="mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-0.5">
                      Lead disse (objeção)
                    </p>
                    <p className="text-[12px] text-slate-700 bg-white rounded px-2 py-1.5 border border-slate-200">
                      {o.objection_text}
                    </p>
                  </div>
                  <div className="mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-0.5">
                      Atendente respondeu (M1)
                    </p>
                    <p className="text-[12px] text-slate-700 bg-white rounded px-2 py-1.5 border border-slate-200">
                      {o.m1_text}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    Depois disso, {o.msgs_after_m1} mensagens outbound em 24h
                    mas <strong className="text-red-700">nenhuma com M2</strong>{" "}
                    (pergunta de isolamento).
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[10px] text-slate-400 mt-6 italic">
          Heurística textual. Pode haver falsos positivos (lead disse "caro"
          mas em outro contexto) e falsos negativos (Barbara fez o M2 com
          palavras diferentes). Use como sinal, não como veredicto.
        </p>
      </div>
    </CrmShell>
  );
}
