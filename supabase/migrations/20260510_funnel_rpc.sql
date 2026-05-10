-- =========================================
-- Migration: RPC quiz_funnel_metrics — cleanup forçado + recriação
-- Aceita intervalo (start_at, end_at) pra suportar presets variados na UI:
--   hoje · ontem · 7d · 30d · 90d · custom (data a data)
-- Date: 2026-05-10 (revisão final com cleanup brutal)
-- =========================================

-- Remove TODAS as versões/signatures existentes (ovewrite seguro)
do $$
declare
  r record;
begin
  for r in
    select oid, pg_get_function_identity_arguments(oid) as args
    from pg_proc
    where proname = 'quiz_funnel_metrics'
      and pronamespace = 'public'::regnamespace
  loop
    execute format('drop function if exists public.quiz_funnel_metrics(%s)', r.args);
  end loop;
end$$;

create function public.quiz_funnel_metrics(
  start_at timestamptz default (now() - interval '30 days'),
  end_at timestamptz default now()
)
returns json
language sql
stable
security definer
as $$
  with
    step_sessions as (
      select distinct
        payload->>'step' as step,
        payload->>'session_id' as session_id
      from public.event_log
      where type = 'quiz_step_view'
        and created_at >= start_at
        and created_at < end_at
        and payload->>'session_id' is not null
        and payload->>'step' is not null
    ),
    by_step as (
      select step, count(*)::int as count
      from step_sessions
      group by step
    ),
    pageview_count as (
      select count(distinct payload->>'session_id')::int as count
      from public.event_log
      where type = 'quiz_pageview'
        and created_at >= start_at
        and created_at < end_at
    ),
    leads_quiz as (
      select id
      from public.leads
      where source = 'quiz'
        and created_at >= start_at
        and created_at < end_at
    ),
    wa_clicks_count as (
      select count(distinct payload->>'session_id')::int as count
      from public.event_log
      where type = 'quiz_wa_click'
        and created_at >= start_at
        and created_at < end_at
    ),
    matched_count as (
      select count(distinct l.id)::int as count
      from leads_quiz l
      where exists (
        select 1 from public.messages m
        where m.lead_id = l.id and m.direction = 'inbound'
      )
    )
  select json_build_object(
    'start_at', start_at,
    'end_at', end_at,
    'pageviews', coalesce((select count from pageview_count), 0),
    'leads_total', (select count(*)::int from leads_quiz),
    'wa_clicks', coalesce((select count from wa_clicks_count), 0),
    'phone_matched', coalesce((select count from matched_count), 0),
    'by_step', coalesce(
      (select json_agg(json_build_object('step', step, 'count', count))
       from by_step),
      '[]'::json
    )
  );
$$;

grant execute on function public.quiz_funnel_metrics(timestamptz, timestamptz) to authenticated, service_role;

-- Refresh do schema cache do PostgREST (Supabase API gateway)
notify pgrst, 'reload schema';
