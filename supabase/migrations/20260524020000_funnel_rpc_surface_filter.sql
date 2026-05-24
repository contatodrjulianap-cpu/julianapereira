-- Adiciona filtro de surface ao quiz_funnel_metrics.
--   surface=null     → soma tudo (quiz + bot + legacy)
--   surface='quiz'   → flow tradicional /quiz/[variant]   (inclui legacy sem campo surface)
--   surface='bot'    → flow chat-bot WhatsApp-style /chat/[variant]
--
-- event_log.payload->>'surface' já é populado:
--   /quiz/quiz-flow.tsx        → sem surface (legacy)
--   /chat/bot-flow.tsx         → surface='bot' explícito
--   /api/quiz/submit/route.ts  → surface='quiz' (default) ou 'bot'
--
-- Pra leads, derivo surface via quiz_submit no event_log (1 evento por submit).
-- Lead sem quiz_submit registrado cai em 'quiz' (back-compat).

drop function if exists public.quiz_funnel_metrics(timestamptz, timestamptz);
drop function if exists public.quiz_funnel_metrics(timestamptz, timestamptz, text);
drop function if exists public.quiz_funnel_metrics(timestamptz, timestamptz, text, text);

create function public.quiz_funnel_metrics(
  start_at timestamptz default (now() - interval '30 days'),
  end_at timestamptz default now(),
  variant text default null,
  surface text default null
)
returns json
language sql
stable
security definer
as $$
  with
    -- Predicado de surface reutilizável no event_log:
    --   null    → tudo
    --   'quiz'  → payload->>'surface' is null OR = 'quiz'
    --   'bot'   → payload->>'surface' = 'bot'
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
        and (
          surface is null
          or (surface = 'quiz' and (payload->>'surface' is null or payload->>'surface' = 'quiz'))
          or (surface = 'bot'  and payload->>'surface' = 'bot')
        )
    ),
    by_step as (select step, count(*)::int as count from step_sessions group by step),
    pageview_count as (
      select count(distinct payload->>'session_id')::int as count
      from public.event_log
      where type = 'quiz_pageview'
        and created_at >= start_at and created_at < end_at
        and (variant is null or payload->>'variant' = variant)
        and (
          surface is null
          or (surface = 'quiz' and (payload->>'surface' is null or payload->>'surface' = 'quiz'))
          or (surface = 'bot'  and payload->>'surface' = 'bot')
        )
    ),
    -- Mapeia lead → surface via quiz_submit. Lead sem quiz_submit (raro/legacy) = 'quiz'.
    lead_surface as (
      select
        lead_id,
        coalesce(max(payload->>'surface'), 'quiz') as surface
      from public.event_log
      where type = 'quiz_submit' and lead_id is not null
      group by lead_id
    ),
    leads_quiz as (
      select l.id, l.archetype
      from public.leads l
      left join lead_surface ls on ls.lead_id = l.id
      where l.source = 'quiz'
        and l.created_at >= start_at and l.created_at < end_at
        and (variant is null or l.quiz_variant = variant)
        and (
          surface is null
          or (surface = 'quiz' and coalesce(ls.surface, 'quiz') = 'quiz')
          or (surface = 'bot'  and ls.surface = 'bot')
        )
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
        and (
          surface is null
          or (surface = 'quiz' and (payload->>'surface' is null or payload->>'surface' = 'quiz'))
          or (surface = 'bot'  and payload->>'surface' = 'bot')
        )
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
    'surface', surface,
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

grant execute on function public.quiz_funnel_metrics(timestamptz, timestamptz, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
