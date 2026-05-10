-- =========================================
-- Migration: tabela quiz_config (single-row JSON pra editor visual)
-- O construtor de quiz no /crm/builder edita esse row.
-- O quiz público (/quiz) lê com fallback pro hardcoded em quiz-archetypes.ts.
-- Date: 2026-05-10
-- =========================================

create table if not exists public.quiz_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);

alter table public.quiz_config enable row level security;

drop policy if exists "anon read quiz_config" on public.quiz_config;
create policy "anon read quiz_config"
  on public.quiz_config for select
  to anon
  using (true);

drop policy if exists "auth read quiz_config" on public.quiz_config;
create policy "auth read quiz_config"
  on public.quiz_config for select
  to authenticated
  using (true);

-- escrita: somente service_role (rota PUT valida auth do user)

-- seed: row vazio (API GET retorna fallback hardcoded se config = {})
insert into public.quiz_config (id, config) values ('current', '{}'::jsonb)
on conflict (id) do nothing;

-- trigger updated_at (reuse touch_updated_at já criada no initial_schema)
drop trigger if exists quiz_config_touch on public.quiz_config;
create trigger quiz_config_touch
  before update on public.quiz_config
  for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
