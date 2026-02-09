-- Chat history storage for Levely chatbot
-- Run this script inside the Supabase SQL editor or the CLI once per project.

create extension if not exists pgcrypto;

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id bigint null,
  device_id text null,
  title text null,
  last_message_preview text null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  metadata jsonb default '{}'::jsonb not null,
  token_count integer null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created_idx
  on public.chat_messages(session_id, created_at);

create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions(user_id, updated_at desc);

create or replace function public.touch_chat_session()
returns trigger as $$
begin
  update public.chat_sessions
     set last_message_preview = coalesce(new.content, last_message_preview),
         updated_at = greatest(now(), new.created_at)
   where id = new.session_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists chat_messages_touch_session on public.chat_messages;
create trigger chat_messages_touch_session
  after insert on public.chat_messages
  for each row execute function public.touch_chat_session();

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "Allow service role for chat sessions"
  on public.chat_sessions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Allow service role for chat messages"
  on public.chat_messages
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
