-- Limpeza dos leads-fantasma criados pela migração de LID do WhatsApp.
--
-- Contexto: o WhatsApp passou a entregar o MESMO contato ora pelo número real
-- (phone=55..., com chatLid de sidecar), ora só pelo LID (phone=NNN@lid, sem
-- chatLid). O webhook só mesclava @lid->real no eco outbound, então inbounds
-- @lid puros criavam uma 2ª linha de lead "fantasma" pro mesmo humano.
--
-- Esta migração mescla cada ghost (@lid) no lead real (número de verdade) cujas
-- mensagens já carregam aquele chatLid. Repointa messages + event_log, concilia
-- campos (preenche nulos), e deleta o ghost. Idempotente: rodar de novo é no-op
-- (não sobram ghosts com gêmeo real).
--
-- Só mescla quando o gêmeo é um lead de NÚMERO REAL (não @lid), pra evitar
-- corromper eventuais cadeias @lid<->@lid.

begin;

create temp table _lid_pairs on commit drop as
select
  g.id              as ghost_id,
  g.phone           as ghost_phone,
  g.name            as gname,
  g.avatar_url      as gavatar,
  g.notes           as gnotes,
  g.last_message_at as glast,
  r.id              as real_id
from public.leads g
join lateral (
  select l2.id
  from public.messages m2
  join public.leads l2 on l2.id = m2.lead_id
  where m2.raw->>'chatLid' = g.phone
    and l2.id <> g.id
    and l2.phone not like '%@lid'      -- gêmeo precisa ser número real
  order by l2.created_at               -- mais antigo = canônico
  limit 1
) r on true
where g.phone like '%@lid';

-- 1) Repointa mensagens do ghost -> lead real, pulando as que colidiriam no
--    UNIQUE de zapi_message_id (eco já gravado no lead real).
update public.messages m
set lead_id = p.real_id
from _lid_pairs p
where m.lead_id = p.ghost_id
  and (
    m.zapi_message_id is null
    or not exists (
      select 1 from public.messages m2
      where m2.lead_id = p.real_id
        and m2.zapi_message_id = m.zapi_message_id
    )
  );

-- 2) Sobras no ghost = duplicatas exatas que já existem no lead real -> apaga.
delete from public.messages m
using _lid_pairs p
where m.lead_id = p.ghost_id;

-- 3) Preserva trilha de auditoria.
update public.event_log e
set lead_id = p.real_id
from _lid_pairs p
where e.lead_id = p.ghost_id;

-- 4) Concilia o lead real: preenche nulos com dados do ghost, puxa o
--    last_message_at mais recente.
update public.leads r
set name            = coalesce(r.name, p.gname),
    avatar_url      = coalesce(r.avatar_url, p.gavatar),
    notes           = coalesce(r.notes, p.gnotes),
    last_message_at = greatest(
                        coalesce(r.last_message_at, p.glast),
                        coalesce(p.glast, r.last_message_at)
                      ),
    updated_at      = now()
from _lid_pairs p
where r.id = p.real_id;

-- 5) Remove os ghosts.
delete from public.leads g
using _lid_pairs p
where g.id = p.ghost_id;

commit;
