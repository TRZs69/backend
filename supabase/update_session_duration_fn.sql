-- =============================================
-- UPDATE: recompute_student_summary_v2
-- Perubahan: avg_session_duration_sec sekarang menggunakan
-- dual strategy: session_id pairs (jika ada) atau daily window (fallback)
-- Deploy via: Supabase Dashboard > SQL Editor > New Query > Paste > Run
-- =============================================

create or replace function public.recompute_student_summary_v2(
  p_user_id bigint,
  p_period_start timestamptz default '2026-03-26 00:00:00+07',
  p_period_end timestamptz default '2026-06-03 23:59:59.999+07',
  p_student_id text default null,
  p_student_name text default null,
  p_total_available_chapters integer default null
) returns void
language plpgsql
security definer
as $$
declare
  v_period_days integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_period_end < p_period_start then
    raise exception 'p_period_end must be greater than or equal to p_period_start';
  end if;

  v_period_days := greatest(
    1,
    (date(timezone('Asia/Jakarta', p_period_end)) - date(timezone('Asia/Jakarta', p_period_start)) + 1)
  );

  with filtered_events as (
    select *
    from public.activity_logs
    where user_id = p_user_id
      and event_ts >= p_period_start
      and event_ts <= p_period_end
  ),
  session_pairs as (
    -- Strategy 1: group by explicit session_id when available
    select
      session_id,
      min(event_ts) as start_ts,
      greatest(
        max(event_ts),
        coalesce(max(event_ts) filter (where event_name = 'session_end'), max(event_ts))
      ) as end_ts,
      'session_id' as strategy
    from filtered_events
    where session_id is not null and session_id <> ''
    group by session_id
  ),
  daily_window as (
    -- Strategy 2 (fallback): one synthetic session per active day
    -- Uses the span from first to last event of each calendar day (Jakarta time)
    select
      date(timezone('Asia/Jakarta', event_ts)) as active_day,
      min(event_ts) as start_ts,
      max(event_ts) as end_ts,
      'daily' as strategy
    from filtered_events
    group by date(timezone('Asia/Jakarta', event_ts))
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
        -- Prefer session_id pairs; fall back to daily window when no session_id exists
        case
          when (select count(*) from session_pairs) > 0 then (
            select avg(extract(epoch from (end_ts - start_ts)))
            from session_pairs
            where end_ts >= start_ts
          )
          else (
            select avg(extract(epoch from (end_ts - start_ts)))
            from daily_window
            where end_ts >= start_ts
          )
        end
      ), 0) as avg_session_duration_sec
  ),
  assessment_metrics as (
    select
      coalesce(count(*) filter (where event_name = 'assessment_submit'), 0) as assessments_submitted,
      coalesce(count(distinct assessment_attempt_id) filter (where event_name in ('assessment_start', 'assessment_submit') and assessment_attempt_id is not null and assessment_attempt_id <> 0), 0) as assessment_attempts,
      coalesce(avg(score) filter (where event_name = 'assessment_submit' and score is not null), 0) as avg_grade,
      coalesce(sum(points) filter (where event_name = 'assessment_submit'), 0) as total_points_earned,
      coalesce(count(distinct chapter_id) filter (where event_name = 'assessment_submit' and chapter_id is not null), 0) as distinct_assessment_chapters
    from filtered_events
  ),
  progress_metrics as (
    select
      coalesce(count(distinct chapter_id) filter (where event_name = 'chapter_completed'), 0) as chapters_completed,
      coalesce(count(*) filter (where event_name = 'badge_earned'), 0) as badges_earned,
      coalesce(count(*) filter (where event_name = 'assignment_submit'), 0) as assignments_submitted
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
  ),
  feature_flags as (
    select
      bool_or(event_name = 'user_login') as used_login,
      bool_or(event_name in ('session_start', 'session_end')) as used_session,
      bool_or(event_name = 'assessment_submit') as used_assessment,
      bool_or(event_name = 'material_access') as used_material,
      bool_or(event_name = 'assignment_submit') as used_assignment,
      bool_or(event_name = 'chatbot_interaction') as used_chatbot
    from filtered_events
  ),
  feature_metrics as (
    select
      (case when used_login then 1 else 0 end) +
      (case when used_session then 1 else 0 end) +
      (case when used_assessment then 1 else 0 end) +
      (case when used_material then 1 else 0 end) +
      (case when used_assignment then 1 else 0 end) +
      (case when used_chatbot then 1 else 0 end) as features_used
    from feature_flags
  ),
  totals as (
    select
      p_user_id as user_id,
      coalesce(p_student_id, '') as student_id_fallback,
      coalesce(p_student_name, '') as student_name_fallback,
      p_period_start as period_start,
      p_period_end as period_end,
      v_period_days as period_days,
      sm.sessions_total,
      sm.active_days,
      greatest(0, least(100, round((sm.active_days::numeric / nullif(v_period_days, 0)) * 100, 2))) as return_rate_pct,
      round(sm.avg_session_duration_sec::numeric, 2) as avg_session_duration_sec,
      am.assessments_submitted,
      am.assessment_attempts,
      pm.assignments_submitted,
      round(am.avg_grade::numeric, 2) as avg_grade,
      round(am.total_points_earned::numeric, 2) as total_points_earned,
      greatest(0, am.assessments_submitted - am.distinct_assessment_chapters) as retry_attempts,
      pm.chapters_completed,
      pm.badges_earned,
      cm.chat_sessions,
      cm.chat_messages,
      cm.chat_user_messages,
      coalesce((select count(*) from filtered_events), 0) as total_activity,
      coalesce((select features_used from feature_metrics), 0) as features_used,
      coalesce(
        p_total_available_chapters,
        (
          select max(
            case
              when (metadata->>'total_available_chapters') ~ '^[0-9]+$'
                then (metadata->>'total_available_chapters')::integer
              else null
            end
          )
          from filtered_events
        ),
        0
      ) as total_available_chapters
    from session_metrics sm
    cross join assessment_metrics am
    cross join progress_metrics pm
    cross join chat_metrics cm
  )
  insert into public.student_summaries_2 (
    user_id,
    student_id,
    student_name,
    period_start,
    period_end,
    period_days,
    sessions_total,
    active_days,
    return_rate_pct,
    avg_session_duration_sec,
    assessments_submitted,
    assessment_attempts,
    assignments_submitted,
    avg_grade,
    total_points_earned,
    retry_attempts,
    chapters_completed,
    badges_earned,
    chat_sessions,
    chat_messages,
    chat_user_messages,
    engagement_behavioral_score,
    engagement_consistency_score,
    engagement_persistence_score,
    total_activity,
    system_usage_intensity,
    total_available_chapters,
    learning_progress_rate,
    features_used,
    feature_utilization_score,
    updated_at
  )
  select
    t.user_id,
    nullif(t.student_id_fallback, ''),
    nullif(t.student_name_fallback, ''),
    t.period_start,
    t.period_end,
    t.period_days,
    t.sessions_total,
    t.active_days,
    t.return_rate_pct,
    t.avg_session_duration_sec,
    t.assessments_submitted,
    t.assessment_attempts,
    t.assignments_submitted,
    t.avg_grade,
    t.total_points_earned,
    t.retry_attempts,
    t.chapters_completed,
    t.badges_earned,
    t.chat_sessions,
    t.chat_messages,
    t.chat_user_messages,
    round(
      (
        least(100, (t.sessions_total::numeric / nullif(t.period_days, 0)) * 100) * 0.40
        + least(100, (t.assessments_submitted::numeric / nullif(t.period_days, 0)) * 100) * 0.35
        + least(100, (t.chat_messages::numeric / nullif(t.period_days, 0)) * 10) * 0.25
      )::numeric,
      2
    ) as engagement_behavioral_score,
    round(
      (
        least(100, (t.active_days::numeric / nullif(t.period_days, 0)) * 100) * 0.50
        + t.return_rate_pct * 0.50
      )::numeric,
      2
    ) as engagement_consistency_score,
    round(
      (
        least(100, (t.avg_session_duration_sec / 1800) * 100) * 0.60
        + least(100, t.retry_attempts * 20)::numeric * 0.40
      )::numeric,
      2
    ) as engagement_persistence_score,
    t.total_activity,
    round((t.total_activity::numeric / nullif(t.period_days, 0))::numeric, 4) as system_usage_intensity,
    t.total_available_chapters,
    round(
      (
        case
          when t.total_available_chapters > 0
            then (t.chapters_completed::numeric / t.total_available_chapters::numeric) * 100
          else 0
        end
      )::numeric,
      2
    ) as learning_progress_rate,
    t.features_used,
    round(((t.features_used::numeric / 6) * 100)::numeric, 2) as feature_utilization_score,
    now()
  from totals t
  on conflict (user_id) do update set
    student_id = excluded.student_id,
    student_name = excluded.student_name,
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    period_days = excluded.period_days,
    sessions_total = excluded.sessions_total,
    active_days = excluded.active_days,
    return_rate_pct = excluded.return_rate_pct,
    avg_session_duration_sec = excluded.avg_session_duration_sec,
    assessments_submitted = excluded.assessments_submitted,
    assessment_attempts = excluded.assessment_attempts,
    assignments_submitted = excluded.assignments_submitted,
    avg_grade = excluded.avg_grade,
    total_points_earned = excluded.total_points_earned,
    retry_attempts = excluded.retry_attempts,
    chapters_completed = excluded.chapters_completed,
    badges_earned = excluded.badges_earned,
    chat_sessions = excluded.chat_sessions,
    chat_messages = excluded.chat_messages,
    chat_user_messages = excluded.chat_user_messages,
    engagement_behavioral_score = excluded.engagement_behavioral_score,
    engagement_consistency_score = excluded.engagement_consistency_score,
    engagement_persistence_score = excluded.engagement_persistence_score,
    total_activity = excluded.total_activity,
    system_usage_intensity = excluded.system_usage_intensity,
    total_available_chapters = excluded.total_available_chapters,
    learning_progress_rate = excluded.learning_progress_rate,
    features_used = excluded.features_used,
    feature_utilization_score = excluded.feature_utilization_score,
    updated_at = now();
end;
$$;
