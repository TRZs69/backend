-- Chatbot response rating storage for Levely
-- Run this script inside the Supabase SQL editor.

create table if not exists public.chatbot_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  user_request text not null,
  bot_response text not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists chatbot_ratings_user_id_idx
  on public.chatbot_ratings(user_id);

alter table public.chatbot_ratings enable row level security;

create policy "Allow service role for chatbot ratings"
  on public.chatbot_ratings
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
