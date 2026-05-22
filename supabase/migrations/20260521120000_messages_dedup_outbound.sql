-- Captura de outbound enviado direto do celular da atendente.
--
-- Contexto: webhook do Z-API antes ignorava payload.fromMe=true (echo). Isso
-- escondia 100% das respostas que as atendentes mandam pelo WhatsApp Business
-- do chip — só aparecia o que era enviado via CRM /api/zapi/send (que = zero).
--
-- Agora o webhook grava fromMe=true como direction='outbound' com sent_by=null
-- (indica "veio do celular"). Pra não duplicar quando CRM /send insere primeiro
-- e o eco do webhook chega depois, criamos UNIQUE partial em zapi_message_id.

-- 1) Dedup retroativo: mantém a linha mais antiga por zapi_message_id.
delete from public.messages m
using public.messages m2
where m.zapi_message_id is not null
  and m.zapi_message_id = m2.zapi_message_id
  and m.created_at > m2.created_at;

-- 2) UNIQUE partial — permite múltiplos NULL (mensagens sem id retornado).
create unique index if not exists messages_zapi_message_id_unique
  on public.messages (zapi_message_id)
  where zapi_message_id is not null;

-- 3) Drop o índice antigo não-único (substituído pelo unique).
drop index if exists public.messages_zapi_message_id_idx;
