-- Lido/não-lido nas Conversas (estilo WhatsApp)
-- ============================================
-- last_read_at = última vez que a atendente ABRIU a conversa.
-- Um lead conta como "não lido" quando a ÚLTIMA mensagem é do lead (inbound)
-- e chegou DEPOIS desse last_read_at (ou a conversa nunca foi aberta).

alter table public.leads
  add column if not exists last_read_at timestamptz;

-- Trigger de updated_at dedicado pra leads: abrir conversa (mexer só em
-- last_read_at) NÃO pode bumpar updated_at — updated_at alimenta métricas de
-- won/mês (Pipeline) e "atualizados hoje" (Status). Mantém touch_updated_at()
-- intacto pras outras tabelas.
create or replace function public.touch_updated_at_leads()
returns trigger as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'last_read_at')
     is distinct from (to_jsonb(old) - 'updated_at' - 'last_read_at') then
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.touch_updated_at_leads();

notify pgrst, 'reload schema';
