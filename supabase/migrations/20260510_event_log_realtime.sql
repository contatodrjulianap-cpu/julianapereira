-- =========================================
-- Migration: habilita Realtime na tabela event_log
-- Permite a aba Log do CRM receber eventos novos em tempo real.
-- Date: 2026-05-10
-- =========================================

-- Adiciona event_log à publicação do Realtime (idempotente via DO block)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_log'
  ) then
    alter publication supabase_realtime add table public.event_log;
  end if;
end$$;
