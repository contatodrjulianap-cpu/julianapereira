import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrmShell } from "../crm-shell";
import { STATUS_LABEL, STATUS_BADGE } from "@/lib/lead-status";
import { LeadsFilters } from "./leads-filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SP = {
  page?: string;
  q?: string;
  status?: string;
  archetype?: string;
  source?: string;
  owner?: string;
};

// Origem (free-text) → grupos de padrões ilike pro filtro server-side.
const SOURCE_OR: Record<string, string> = {
  instagram: "source.ilike.%insta%",
  google: "source.ilike.%google%",
  tiktok: "source.ilike.%tiktok%,source.ilike.%tt%",
  quiz: "source.ilike.%quiz%",
  indicacao: "source.ilike.%indica%",
  organico: "source.ilike.%organ%,source.ilike.%seo%",
  whatsapp: "source.ilike.%whats%",
};

const ARCHETYPE_BADGE: Record<string, { label: string; cls: string }> = {
  PRONTA: { label: "🔥 Pronto", cls: "bg-red-100 text-red-800" },
  ESPERANCOSA: { label: "🟡 Esperançoso", cls: "bg-amber-100 text-amber-800" },
  CETICA: { label: "🤔 Cético", cls: "bg-slate-200 text-slate-700" },
};

// Remove caracteres que quebram a sintaxe do .or()/ilike do PostgREST.
function sanitize(s: string): string {
  return s.replace(/[,()%*]/g, "").trim();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yy = d.getFullYear().toString().slice(2);
  return `${dd}/${mm}/${yy}`;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
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

  // Atendentes pra dropdown + lookup id→nome (só admin precisa do dropdown).
  const { data: users } = await supabase
    .from("crm_users")
    .select("id, display_name")
    .order("display_name");
  const attendants = users ?? [];
  const ownerNameById = new Map<string, string | null>();
  for (const u of attendants) ownerNameById.set(u.id, u.display_name);

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "";
  const archetype = sp.archetype ?? "";
  const source = sp.source ?? "";
  const owner = sp.owner ?? "";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("leads")
    .select(
      "id, name, phone, status, archetype, source, assigned_owner_id, quiz_variant, created_at, last_message_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  // Escopo: atendente só vê os dela; admin pode filtrar por responsável.
  if (!isAdmin) {
    query = query.eq("assigned_owner_id", user.id);
  } else if (owner === "_unassigned") {
    query = query.is("assigned_owner_id", null);
  } else if (owner) {
    query = query.eq("assigned_owner_id", owner);
  }

  if (q) {
    const safe = sanitize(q);
    if (safe) query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  if (status) query = query.eq("status", status);
  if (archetype === "sem") query = query.is("archetype", null);
  else if (archetype) query = query.eq("archetype", archetype);
  if (source && SOURCE_OR[source]) query = query.or(SOURCE_OR[source]);

  const { data: leads, count } = await query;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = leads ?? [];

  const hasFilters = !!(q || status || archetype || source || owner);

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (archetype) params.set("archetype", archetype);
    if (source) params.set("source", source);
    if (owner) params.set("owner", owner);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/crm/leads?${qs}` : "/crm/leads";
  }

  return (
    <CrmShell active="leads" userEmail={user.email ?? ""}>
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-slate-900">
            📇 Todos os leads
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Base completa, paginada. {total.toLocaleString("pt-BR")}{" "}
            {total === 1 ? "lead" : "leads"}
            {hasFilters ? " no filtro" : ""}.
          </p>
        </header>

        <div className="mb-4">
          <LeadsFilters
            q={q}
            status={status}
            archetype={archetype}
            source={source}
            owner={owner}
            attendants={attendants}
            isAdmin={isAdmin}
          />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-10 text-center">
            Nenhum lead encontrado{hasFilters ? " com esses filtros" : ""}.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((l) => {
              const arch = l.archetype
                ? ARCHETYPE_BADGE[l.archetype]
                : null;
              const ownerName = l.assigned_owner_id
                ? (ownerNameById.get(l.assigned_owner_id) ?? "?")
                : null;
              return (
                <li key={l.id}>
                  <Link
                    href={`/crm/conversas/${l.id}`}
                    className="block rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 active:bg-slate-50 hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">
                        {l.name || l.phone}
                      </p>
                      <span className="shrink-0 text-[10px] text-slate-400 font-mono">
                        {fmtDate(l.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      {l.status && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            STATUS_BADGE[l.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {STATUS_LABEL[l.status] ?? l.status}
                        </span>
                      )}
                      {arch && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${arch.cls}`}
                        >
                          {arch.label}
                        </span>
                      )}
                      {l.source && (
                        <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded-full bg-slate-100">
                          {l.source}
                        </span>
                      )}
                      {isAdmin && (
                        <span className="text-[10px] text-slate-500">
                          👤 {ownerName ?? "sem responsável"}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Paginação */}
        {total > PAGE_SIZE && (
          <nav className="flex items-center justify-between mt-5 text-[13px]">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 active:bg-slate-50"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300">
                ← Anterior
              </span>
            )}
            <span className="text-slate-500 font-medium">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 active:bg-slate-50"
              >
                Próxima →
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded-lg border border-slate-100 text-slate-300">
                Próxima →
              </span>
            )}
          </nav>
        )}
      </div>
    </CrmShell>
  );
}
