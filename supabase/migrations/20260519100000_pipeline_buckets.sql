-- Sprint 2: pinned + follow_up_at em leads
-- Permite swipe actions (fixar lead) e agendamento de follow-up curto.

alter table public.leads add column if not exists pinned boolean not null default false;
alter table public.leads add column if not exists follow_up_at timestamptz;

create index if not exists leads_pinned_idx
  on public.leads (pinned desc, last_message_at desc nulls last)
  where pinned = true;

create index if not exists leads_follow_up_idx
  on public.leads (follow_up_at)
  where follow_up_at is not null;
