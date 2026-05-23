-- Adiciona filtro de variant ao quiz_funnel_metrics. variant=null = soma
-- ambos (resina+porcelana). variant='resina' ou 'porcelana' = isolado.
--
-- event_log: filtra por payload->>'variant' nos quiz_pageview/step_view/wa_click
--   (trackEvent passa variant em todas as chamadas a partir do fix de hoje).
-- leads: filtra por public.leads.quiz_variant.
--
-- Eventos antigos (antes do fix do step_view advanceFrom) podem não ter
-- variant no payload — vão aparecer só no filtro "ambos". Aceitável porque
-- esses já são histórico.

drop function if exists public.quiz_funnel_metrics(timestamptz, timestamptz);
drop function if exists public.quiz_funnel_metrics(timestamptz, timestamptz, text);

create function public.quiz_funnel_metrics(
  start_at timestamptz default (now() - interval '30 days'),
  end_at timestamptz default now(),
  variant text default null
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
        and created_at >= start_at and created_at < end_at
        and payload->>'session_id' is not null
        and payload->>'step' is not null
        and (variant is null or payload->>'variant' = variant)
    ),
    by_step as (select step, count(*)::int as count from step_sessions group by step),
    pageview_count as (
      select count(distinct payload->>'session_id')::int as count
      from public.event_log
      where type = 'quiz_pageview'
        and created_at >= start_at and created_at < end_at
        and (variant is null or payload->>'variant' = variant)
    ),
    leads_quiz as (
      select id, archetype
      from public.leads
      where source = 'quiz'
        and created_at >= start_at and created_at < end_at
        and (variant is null or quiz_variant = variant)
    ),
    by_archetype as (
      select archetype, count(*)::int as count
      from leads_quiz
      where archetype is not null
      group by archetype
    ),
    wa_clicks_count as (
      select count(distinct payload->>'session_id')::int as count
      from public.event_log
      where type = 'quiz_wa_click'
        and created_at >= start_at and created_at < end_at
        and (variant is null or payload->>'variant' = variant)
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
    'variant', variant,
    'pageviews', coalesce((select count from pageview_count), 0),
    'leads_total', (select count(*)::int from leads_quiz),
    'wa_clicks', coalesce((select count from wa_clicks_count), 0),
    'phone_matched', coalesce((select count from matched_count), 0),
    'by_step', coalesce(
      (select json_agg(json_build_object('step', step, 'count', count)) from by_step),
      '[]'::json
    ),
    'by_archetype', coalesce(
      (select json_agg(json_build_object('archetype', archetype, 'count', count)) from by_archetype),
      '[]'::json
    )
  );
$$;

grant execute on function public.quiz_funnel_metrics(timestamptz, timestamptz, text) to authenticated, service_role;

notify pgrst, 'reload schema';
