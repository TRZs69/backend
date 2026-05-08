create extension if not exists pgcrypto;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  event_name text not null,
  event_ts timestamptz not null default now(),
  session_id text null,
  chapter_id bigint null,
  assessment_attempt_id bigint null,
  chat_session_id text null,
  score numeric null,
  points numeric null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_logs
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id bigint,
  add column if not exists event_name text,
  add column if not exists event_ts timestamptz default now(),
  add column if not exists session_id text,
  add column if not exists chapter_id bigint,
  add column if not exists assessment_attempt_id bigint,
  add column if not exists chat_session_id text,
  add column if not exists score numeric,
  add column if not exists points numeric,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists idempotency_key text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_logs_pkey'
      and conrelid = 'public.activity_logs'::regclass
  ) then
    alter table public.activity_logs add constraint activity_logs_pkey primary key (id);
  end if;
end $$;

create unique index if not exists activity_logs_idempotency_key_uq
  on public.activity_logs(idempotency_key);

create index if not exists activity_logs_user_id_event_ts_idx
  on public.activity_logs(user_id, event_ts desc);

create index if not exists activity_logs_event_name_idx
  on public.activity_logs(event_name);

create index if not exists activity_logs_user_event_idx
  on public.activity_logs(user_id, event_name, event_ts desc);

create table if not exists public.student_summaries_2 (
  user_id bigint primary key,
  student_id text null,
  student_name text null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  period_days integer not null,
  sessions_total integer not null default 0,
  active_days integer not null default 0,
  return_rate_pct numeric(7,2) not null default 0,
  avg_session_duration_sec numeric(12,2) not null default 0,
  assessments_submitted integer not null default 0,
  avg_grade numeric(7,2) not null default 0,
  total_points_earned numeric(14,2) not null default 0,
  retry_attempts integer not null default 0,
  chapters_completed integer not null default 0,
  badges_earned integer not null default 0,
  chat_sessions integer not null default 0,
  chat_messages integer not null default 0,
  chat_user_messages integer not null default 0,
  engagement_behavioral_score numeric(7,2) not null default 0,
  engagement_consistency_score numeric(7,2) not null default 0,
  engagement_persistence_score numeric(7,2) not null default 0,
  total_activity integer not null default 0,
  system_usage_intensity numeric(14,4) not null default 0,
  total_available_chapters integer not null default 0,
  learning_progress_rate numeric(7,2) not null default 0,
  features_used integer not null default 0,
  feature_utilization_score numeric(7,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_summaries_2
  add column if not exists user_id bigint,
  add column if not exists student_id text,
  add column if not exists student_name text,
  add column if not exists period_start timestamptz,
  add column if not exists period_end timestamptz,
  add column if not exists period_days integer,
  add column if not exists sessions_total integer default 0,
  add column if not exists active_days integer default 0,
  add column if not exists return_rate_pct numeric(7,2) default 0,
  add column if not exists avg_session_duration_sec numeric(12,2) default 0,
  add column if not exists assessments_submitted integer default 0,
  add column if not exists avg_grade numeric(7,2) default 0,
  add column if not exists total_points_earned numeric(14,2) default 0,
  add column if not exists retry_attempts integer default 0,
  add column if not exists chapters_completed integer default 0,
  add column if not exists badges_earned integer default 0,
  add column if not exists chat_sessions integer default 0,
  add column if not exists chat_messages integer default 0,
  add column if not exists chat_user_messages integer default 0,
  add column if not exists engagement_behavioral_score numeric(7,2) default 0,
  add column if not exists engagement_consistency_score numeric(7,2) default 0,
  add column if not exists engagement_persistence_score numeric(7,2) default 0,
  add column if not exists total_activity integer default 0,
  add column if not exists system_usage_intensity numeric(14,4) default 0,
  add column if not exists total_available_chapters integer default 0,
  add column if not exists learning_progress_rate numeric(7,2) default 0,
  add column if not exists features_used integer default 0,
  add column if not exists feature_utilization_score numeric(7,2) default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_summaries_2_pkey'
      and conrelid = 'public.student_summaries_2'::regclass
  ) then
    alter table public.student_summaries_2 add constraint student_summaries_2_pkey primary key (user_id);
  end if;
end $$;

create index if not exists student_summaries_2_updated_at_idx
  on public.student_summaries_2(updated_at desc);

create or replace function public.recompute_student_summary_v2(
  p_user_id bigint,
  p_period_start timestamptz default '2026-03-26 00:00:00+07',
  p_period_end timestamptz default '2026-05-14 23:59:59.999+07',
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
    select
      user_id,
      session_id,
      min(event_ts) filter (where event_name = 'session_start') as start_ts,
      max(event_ts) filter (where event_name = 'session_end') as end_ts
    from filtered_events
    where session_id is not null
      and event_name in ('session_start', 'session_end')
    group by user_id, session_id
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

create or replace function public.recompute_all_student_summaries_v2(
  p_period_start timestamptz default '2026-03-26 00:00:00+07',
  p_period_end timestamptz default '2026-05-14 23:59:59.999+07'
) returns integer
language plpgsql
security definer
as $$
declare
  r record;
  v_processed integer := 0;
begin
  for r in
    select distinct user_id
    from public.activity_logs
    where user_id is not null
  loop
    perform public.recompute_student_summary_v2(
      r.user_id,
      p_period_start,
      p_period_end,
      null,
      null,
      null
    );
    v_processed := v_processed + 1;
  end loop;

  return v_processed;
end;
$$;

alter table public.activity_logs enable row level security;
alter table public.student_summaries_2 enable row level security;

drop policy if exists "Allow service role for activity logs" on public.activity_logs;
create policy "Allow service role for activity logs"
  on public.activity_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Allow service role for student summaries v2" on public.student_summaries_2;
create policy "Allow service role for student summaries v2"
  on public.student_summaries_2
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
