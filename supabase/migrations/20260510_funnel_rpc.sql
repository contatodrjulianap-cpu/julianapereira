-- =========================================
-- Migration: RPC pra agregar métricas de funil do quiz
-- Date: 2026-05-10 (quarta iteração)
-- =========================================

create or replace function public.quiz_funnel_metrics(days_back integer default 30)
returns json
language plpgsql
stable
security definer
as $$
declare
  result json;
  cutoff timestamptz;
begin
  cutoff := now() - (days_back || ' days')::interval;

  with step_sessions as (
    select distinct
      payload->>'step' as step,
      payload->>'session_id' as session_id
    from public.event_log
    where type = 'quiz_step_view'
      and created_at >= cutoff
      and payload->>'session_id' is not null
      and payload->>'step' is not null
  ),
  by_step as (
    select step, count(*)::int as count
    from step_sessions
    group by step
  ),
  pageview as (
    select count(distinct payload->>'session_id')::int as count
    from public.event_log
    where type = 'quiz_pageview'
      and created_at >= cutoff
  ),
  leads_quiz as (
    select id, phone
    from public.leads
    where source = 'quiz' and created_at >= cutoff
  ),
  wa_clicks as (
    select count(distinct payload->>'session_id')::int as count
    from public.event_log
    where type = 'quiz_wa_click'
      and created_at >= cutoff
  ),
  matched as (
    select count(distinct l.id)::int as count
    from leads_quiz l
    where exists (
      select 1 from public.messages m
      where m.lead_id = l.id and m.direction = 'inbound'
    )
  )
  select json_build_object(
    'days_back', days_back,
    'pageviews', coalesce((select count from pageview), 0),
    'leads_total', (select count(*) from leads_quiz),
    'wa_clicks', coalesce((select count from wa_clicks), 0),
    'phone_matched', coalesce((select count from matched), 0),
    'by_step', coalesce(
      (select json_agg(json_build_object('step', step, 'count', count))
       from by_step),
      '[]'::json
    )
  ) into result;

  return result;
end;
$$;

grant execute on function public.quiz_funnel_metrics(integer) to authenticated, service_role;
