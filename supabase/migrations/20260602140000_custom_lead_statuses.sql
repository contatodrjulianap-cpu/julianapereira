-- Status custom criados pela equipe dentro do CRM (Pipeline/Kanban).
-- Os status de sistema (new/contacted/.../won/lost/disqualified) continuam
-- hardcoded em lib/lead-status.ts porque têm lógica acoplada (funil, receita,
-- cadência, insight). Estes aqui são "buckets" livres, sem lógica especial —
-- viram colunas extras no Kanban e opções no dropdown.
--
-- key sempre prefixada com "c_" no app pra nunca colidir com chave de sistema.

create table if not exists public.custom_lead_statuses (
  key         text primary key,
  label       text not null,
  badge       text not null default 'bg-slate-200 text-slate-700',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists custom_lead_statuses_active_idx
  on public.custom_lead_statuses (active, sort_order);

alter table public.custom_lead_statuses enable row level security;

-- Qualquer usuário autenticado do CRM lê (precisa pra montar colunas/labels).
drop policy if exists "auth read custom statuses" on public.custom_lead_statuses;
create policy "auth read custom statuses"
  on public.custom_lead_statuses for select
  to authenticated
  using (true);

-- Escrita vai pela API (service client, com checagem de auth na rota).

notify pgrst, 'reload schema';
