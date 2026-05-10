-- =========================================
-- Migration: tabela integration_config (Z-API + Facebook CAPI)
-- Edita via /crm/integrations. Lida pelo /api/quiz/submit dinamicamente.
-- Fallback automático em lib/integration-config.ts se row vazia/inválida.
-- Date: 2026-05-10
-- =========================================

create table if not exists public.integration_config (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);

alter table public.integration_config enable row level security;

drop policy if exists "auth read integration_config" on public.integration_config;
create policy "auth read integration_config"
  on public.integration_config for select
  to authenticated
  using (true);

-- escrita: somente service_role (rota PUT valida auth do user)

insert into public.integration_config (id, config) values ('current', '{}'::jsonb)
on conflict (id) do nothing;

drop trigger if exists integration_config_touch on public.integration_config;
create trigger integration_config_touch
  before update on public.integration_config
  for each row execute function public.touch_updated_at();

notify pgrst, 'reload schema';
