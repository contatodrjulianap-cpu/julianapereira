-- =========================================
-- Migration: initial schema (leads + messages + event_log)
-- Date: 2026-05-10
-- =========================================

-- Extensions
create extension if not exists "uuid-ossp";

-- =========================================
-- Tabela: leads
-- =========================================
create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  name text,
  email text,
  avatar_url text,
  source text,                          -- 'quiz', 'whatsapp_inbound', 'manual', etc
  quiz_goal text,                       -- 'clarear', 'lentes', 'corrigir', 'outro'
  quiz_budget text,                     -- 'ate_5k', '5k_15k', '15k_30k', '30k_mais'
  status text default 'new',            -- 'new', 'contacted', 'qualified', 'closed_won', 'closed_lost'
  tags text[] default '{}',
  notes text,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists leads_last_message_at_idx
  on public.leads (last_message_at desc nulls last);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_source_idx on public.leads (source);

-- =========================================
-- Tabela: messages
-- =========================================
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  text text,
  media_url text,
  media_type text,                      -- 'image', 'audio', 'video', 'document'
  raw jsonb,
  zapi_message_id text,
  sent_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists messages_lead_id_created_idx
  on public.messages (lead_id, created_at);
create index if not exists messages_zapi_message_id_idx
  on public.messages (zapi_message_id);

-- =========================================
-- Tabela: event_log (audit log de tudo que acontece no servidor)
-- =========================================
create table if not exists public.event_log (
  id uuid primary key default uuid_generate_v4(),
  type text not null,                   -- 'fb_capi', 'zapi_send_text', 'zapi_webhook', 'quiz_submit', etc
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  target text,                          -- 'facebook', 'zapi', 'supabase', 'vercel'
  lead_id uuid references public.leads(id) on delete set null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  payload jsonb,
  response jsonb,
  error text,
  duration_ms integer,
  created_at timestamptz default now()
);

create index if not exists event_log_created_at_idx
  on public.event_log (created_at desc);
create index if not exists event_log_type_idx on public.event_log (type);
create index if not exists event_log_lead_id_idx on public.event_log (lead_id);
create index if not exists event_log_status_idx on public.event_log (status);

-- =========================================
-- updated_at trigger pra leads
-- =========================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at();

-- =========================================
-- RLS — Row Level Security
-- =========================================
alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.event_log enable row level security;

-- leads: usuários autenticados podem ver/editar todos
drop policy if exists "auth users full access on leads" on public.leads;
create policy "auth users full access on leads"
  on public.leads for all
  to authenticated
  using (true)
  with check (true);

-- messages: idem
drop policy if exists "auth users full access on messages" on public.messages;
create policy "auth users full access on messages"
  on public.messages for all
  to authenticated
  using (true)
  with check (true);

-- event_log: só leitura pra autenticados (escrita só via service_role)
drop policy if exists "auth users read event_log" on public.event_log;
create policy "auth users read event_log"
  on public.event_log for select
  to authenticated
  using (true);

-- =========================================
-- Realtime — habilitar replicação na tabela
-- =========================================
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.messages;
