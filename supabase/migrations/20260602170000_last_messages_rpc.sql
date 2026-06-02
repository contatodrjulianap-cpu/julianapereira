-- Última mensagem por lead (preview da lista de Conversas)
-- =========================================================
-- O fetch antigo fazia messages.in(lead_id, ids) sem limite e batia no
-- max-rows (1000) do PostgREST: com 16k+ mensagens, só os leads mais recentes
-- recebiam preview (e um único lead com 500+ msgs comia a janela inteira).
-- Esta RPC retorna SÓ a última mensagem de cada lead via DISTINCT ON — chamada
-- em lotes de ids no client, cada resposta fica bem abaixo do cap.

create or replace function public.last_messages_for_leads(p_lead_ids uuid[])
returns table (
  lead_id uuid,
  direction text,
  text text,
  media_type text,
  created_at timestamptz
)
language sql
stable
as $$
  select distinct on (m.lead_id)
    m.lead_id, m.direction, m.text, m.media_type, m.created_at
  from public.messages m
  where m.lead_id = any(p_lead_ids)
  order by m.lead_id, m.created_at desc
$$;

notify pgrst, 'reload schema';
