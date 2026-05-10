-- =========================================
-- Migration: quiz archetypes — adiciona arquétipo + geo + case + scores brutos
-- Date: 2026-05-10 (segunda iteração)
-- =========================================

alter table public.leads
  add column if not exists archetype text,    -- 'PRONTA', 'ESPERANCOSA', 'CETICA'
  add column if not exists geo text,           -- 'SP', 'BR', 'INTL'
  add column if not exists case_type text,     -- 'clareamento+lentes', 'alinhamento', 'reconstrucao', etc
  add column if not exists archetype_scores jsonb,
  add column if not exists quiz_answers jsonb,
  add column if not exists instagram text;

create index if not exists leads_archetype_idx on public.leads (archetype);
create index if not exists leads_geo_idx on public.leads (geo);
