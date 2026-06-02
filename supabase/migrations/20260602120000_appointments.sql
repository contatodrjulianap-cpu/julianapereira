-- Agendamentos: a call de avaliação (TLDV) vira um conceito próprio no lead.
--
--  · scheduled_at      → data/hora da call agendada (distinto de follow_up_at,
--                        que é toque de cadência). Dirige a aba Agendamentos.
--  · call_recording_url→ link de compartilhamento da gravação (TLDV) que a Dra.
--                        cola depois da call.
--
-- Dois status novos entram no funil entre "qualified" e os "follow_up_*":
--   new · contacted · qualified · scheduled · attended · follow_up_1..7 · won · lost · disqualified
-- leads.status é texto livre (sem enum/check), então não há ALTER de enum —
-- o app passa a gravar 'scheduled'/'attended'.

alter table public.leads
  add column if not exists scheduled_at timestamptz,
  add column if not exists call_recording_url text;

comment on column public.leads.scheduled_at is
  'Data/hora da call de avaliação agendada (TLDV). Dirige a aba Agendamentos. NÃO confundir com follow_up_at (toque de cadência).';
comment on column public.leads.call_recording_url is
  'Link de compartilhamento da gravação da call (TLDV), preenchido pela Dra. após a avaliação.';

create index if not exists leads_scheduled_at_idx
  on public.leads (scheduled_at)
  where scheduled_at is not null;

notify pgrst, 'reload schema';
