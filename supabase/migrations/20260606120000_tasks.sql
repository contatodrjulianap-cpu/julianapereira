-- tasks: tarefas operacionais geradas por regra (cron) e executadas À MÃO pelo
-- atendente. NÃO dispara nada sozinho (sem Z-API automático) — só lembra o humano.
--
-- Caso de uso v1: LEMBRETE DE AVALIAÇÃO (anti no-show). O cron lê leads.scheduled_at
-- e cria a tarefa na fila do atendente dono; ele abre a conversa, manda a mensagem
-- na mão e marca como feita. Aparece na tela /crm/status.
--
-- Separação SDR×Closer: o KIND carrega a fase
--   · follow-up  → fase SDR (já modelado em leads.follow_up_at; não usa esta tabela)
--   · lembrete_avaliacao / lembrete_dia / confirmar_avaliacao / no_show → fase Closer
--
-- Idempotência: unique(lead_id, kind, due_day) — o gerador roda várias vezes/dia
-- sem duplicar a mesma tarefa.

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references public.leads(id) on delete cascade,
  kind              text not null,              -- 'lembrete_avaliacao' | 'lembrete_dia' | 'confirmar_avaliacao' | 'no_show'
  title             text not null,              -- texto curto exibido na fila
  due_at            timestamptz not null,       -- quando a tarefa deve ser feita
  due_day           date not null,              -- dia (SP) de referência — chave de idempotência
  assigned_owner_id uuid references public.crm_users(id) on delete set null,
  done              boolean not null default false,
  done_at           timestamptz,
  done_by           uuid references public.crm_users(id) on delete set null,
  source            text not null default 'auto',  -- 'auto' (cron) | 'manual'
  created_at        timestamptz not null default now(),
  unique (lead_id, kind, due_day)
);

create index if not exists tasks_owner_open_idx
  on public.tasks (assigned_owner_id, done, due_at);
create index if not exists tasks_open_due_idx
  on public.tasks (done, due_at) where done = false;
create index if not exists tasks_lead_idx on public.tasks (lead_id);

alter table public.tasks enable row level security;

-- Mesma linguagem das policies de leads: autenticado tem acesso (o app filtra por
-- assigned_owner_id na query; admin vê tudo). O cron escreve via service_role.
create policy "auth users full access on tasks"
  on public.tasks for all
  to authenticated
  using (true)
  with check (true);

grant all on public.tasks to service_role;

notify pgrst, 'reload schema';
