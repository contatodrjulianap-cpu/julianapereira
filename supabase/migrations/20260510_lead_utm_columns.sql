-- =========================================
-- Migration: 5 colunas UTM em leads (atribuição direta)
-- Date: 2026-05-10
-- =========================================

alter table public.leads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text;

create index if not exists leads_utm_source_idx on public.leads (utm_source);
create index if not exists leads_utm_campaign_idx on public.leads (utm_campaign);

notify pgrst, 'reload schema';
