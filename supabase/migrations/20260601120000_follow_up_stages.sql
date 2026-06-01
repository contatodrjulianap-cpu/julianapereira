-- Follow up em estágios: o status único "proposal" (rotulado "Follow up") foi
-- quebrado em 7 estágios FU1…FU7 (um por toque da cadência). Cada um vira uma
-- coluna no Kanban. leads.status é texto livre (sem enum/check), então só
-- precisamos migrar os dados existentes — o app passa a gravar follow_up_1..7.
--
-- Leads que estavam em "proposal" entram no primeiro toque (follow_up_1).
update public.leads
set status = 'follow_up_1'
where status = 'proposal';
