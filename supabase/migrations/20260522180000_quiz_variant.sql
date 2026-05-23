-- =========================================
-- Migration: split do quiz em 2 variants (resina | porcelana)
-- - Adiciona coluna `quiz_variant` em leads pra rastrear funil
-- - Faz seed de 2 rows em quiz_config (uma por variant)
-- - Mantém row legacy `id='current'` (sem uso novo, pode ser removida depois)
-- Date: 2026-05-22
-- =========================================

-- Coluna pra rastrear de qual quiz veio o lead
alter table public.leads add column if not exists quiz_variant text;

create index if not exists leads_quiz_variant_idx on public.leads (quiz_variant);

-- Seed das 2 configs (config={} faz cair no DEFAULT_CONFIG_FOR(variant) no app)
insert into public.quiz_config (id, config) values
  ('resina', '{}'::jsonb),
  ('porcelana', '{}'::jsonb)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
