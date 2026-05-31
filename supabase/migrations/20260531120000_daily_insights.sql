-- daily_insights: rollup diário do funil + síntese do "insight do dia".
-- Quem escreve: o agente agendado (Claude Code, cron) usando SUPABASE_SERVICE_ROLE_KEY.
--   Ele roda FORA do app (tem Utmify MCP + lê Supabase) e dá upsert aqui.
-- Quem lê: admin (Ju + Lucas) — alimenta a tela /crm/insights.
-- NÃO toca em leads, round-robin ou qualquer fluxo existente.

create table if not exists public.daily_insights (
  id            uuid primary key default gen_random_uuid(),
  dia           date not null,                  -- dia de referência (normalmente D-1)
  cliente       text not null default 'sakura',

  -- funil (fonte: Supabase desta base)
  leads_novos   int,
  por_fonte     jsonb default '{}'::jsonb,       -- {"quiz":n,"bot":n,"ads":n}
  transicoes    jsonb default '{}'::jsonb,       -- movimentos de status (event_log)
  wons          int,
  parados       int,                             -- follow_up_at vencido + status ativo
  por_atendente jsonb default '{}'::jsonb,       -- {"Gabi":{...},"Barbara":{...}}

  -- ads (fonte: Utmify; fica null na v1 até o MCP da Ju ser registrado)
  investimento_brl numeric,
  cpl_brl          numeric,
  cpa_brl          numeric,

  -- síntese do agente
  narrativa     text,                            -- o "insight do dia" em prosa curta
  alerts        jsonb default '[]'::jsonb,       -- [{"tipo":"lead_parado","sev":"alta","msg":"..."}]
  fontes        jsonb default '[]'::jsonb,       -- honestidade de cobertura (o que leu de fato)

  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  unique (cliente, dia)                          -- 1 rollup por cliente/dia → permite upsert
);

alter table public.daily_insights enable row level security;

-- leitura: só admin (mesmo idioma das outras policies do CRM)
create policy "admin read daily_insights"
  on public.daily_insights for select
  to authenticated
  using ( exists (select 1 from crm_users where id = auth.uid() and role = 'admin') );

-- escrita: só service_role (o agente agendado). service_role já bypassa RLS;
-- o grant garante os privilégios de tabela.
grant all on public.daily_insights to service_role;
