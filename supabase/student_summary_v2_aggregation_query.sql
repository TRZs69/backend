-- Aggregation query template (PostgreSQL CTE) for one user-period.
-- Replace :user_id, :period_start, :period_end as needed.
with filtered_events as (
  select *
  from public.activity_logs
  where user_id = :user_id
    and event_ts >= :period_start::timestamptz
    and event_ts <= :period_end::timestamptz
),
session_pairs as (
  select
    session_id,
    min(event_ts) filter (where event_name = 'session_start') as start_ts,
    max(event_ts) filter (where event_name = 'session_end') as end_ts
  from filtered_events
  where session_id is not null
    and event_name in ('session_start', 'session_end')
  group by session_id
),
session_metrics as (
  select
    coalesce((select count(*) from filtered_events where event_name = 'session_start'), 0) as sessions_total,
    coalesce((
      select count(distinct date(timezone('Asia/Jakarta', event_ts)))
      from filtered_events
      where event_name = 'session_start'
    ), 0) as active_days,
    coalesce((
      select avg(extract(epoch from (end_ts - start_ts)))
      from session_pairs
      where start_ts is not null
        and end_ts is not null
        and end_ts >= start_ts
    ), 0) as avg_session_duration_sec
),
assessment_metrics as (
  select
    coalesce(count(*) filter (where event_name = 'assessment_submit'), 0) as assessments_submitted,
    coalesce(avg(score) filter (where event_name = 'assessment_submit' and score is not null), 0) as avg_grade,
    coalesce(sum(points) filter (where event_name = 'assessment_submit'), 0) as total_points_earned,
    coalesce(count(distinct chapter_id) filter (where event_name = 'assessment_submit' and chapter_id is not null), 0) as distinct_assessment_chapters
  from filtered_events
),
progress_metrics as (
  select
    coalesce(count(*) filter (where event_name = 'chapter_completed'), 0) as chapters_completed,
    coalesce(count(*) filter (where event_name = 'badge_earned'), 0) as badges_earned
  from filtered_events
),
chat_metrics as (
  select
    coalesce(count(distinct chat_session_id) filter (
      where event_name = 'chatbot_interaction'
        and chat_session_id is not null
        and chat_session_id <> ''
    ), 0) as chat_sessions,
    coalesce(sum(
      case
        when event_name <> 'chatbot_interaction' then 0
        when (metadata->>'messages_total') ~ '^-?[0-9]+$' then (metadata->>'messages_total')::integer
        else 1
      end
    ), 0) as chat_messages,
    coalesce(sum(
      case
        when event_name <> 'chatbot_interaction' then 0
        when (metadata->>'user_messages') ~ '^-?[0-9]+$' then (metadata->>'user_messages')::integer
        else 1
      end
    ), 0) as chat_user_messages
  from filtered_events
)
select
  sm.sessions_total,
  sm.active_days,
  sm.avg_session_duration_sec,
  am.assessments_submitted,
  am.avg_grade,
  am.total_points_earned,
  greatest(0, am.assessments_submitted - am.distinct_assessment_chapters) as retry_attempts,
  pm.chapters_completed,
  pm.badges_earned,
  cm.chat_sessions,
  cm.chat_messages,
  cm.chat_user_messages
from session_metrics sm
cross join assessment_metrics am
cross join progress_metrics pm
cross join chat_metrics cm;
