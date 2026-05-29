create table if not exists public.chatbot_ratings_2 (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,
  user_request text not null,
  bot_response text not null,
  model text,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists chatbot_ratings_2_user_id_idx
  on public.chatbot_ratings_2(user_id);

alter table public.chatbot_ratings_2 enable row level security;

create policy "Allow service role for chatbot ratings 2"
  on public.chatbot_ratings_2
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
