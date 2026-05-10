-- =========================================
-- Migration: pipeline fields — campos pra view de CRM-style
-- Date: 2026-05-10 (terceira iteração)
-- =========================================

alter table public.leads
  add column if not exists assigned_to text,            -- responsável (livre, ex: 'Lucas', 'Bárbara', 'Wanderson')
  add column if not exists next_contact_at date,
  add column if not exists deal_value numeric(12,2),
  add column if not exists notes_log jsonb default '[]'::jsonb;
  -- notes_log estrutura: [{"at": "ISO", "by": "user_id ou nome", "text": "..."}]

-- Status já existe (text default 'new'), mas vamos formalizar os valores no app:
-- new · contacted · qualified · proposal · won · lost
-- Sem CHECK pra dar flexibilidade durante validação. Adicionar depois se virar fonte de bug.

create index if not exists leads_status_assigned_idx on public.leads (status, assigned_to);
create index if not exists leads_next_contact_idx on public.leads (next_contact_at) where next_contact_at is not null;
