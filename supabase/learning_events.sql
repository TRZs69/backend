-- Supabase Postgres table for learning analytics event ingestion
CREATE TABLE IF NOT EXISTS public.learning_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER,
  session_id  UUID NOT NULL,
  event_type  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_count INTEGER,
  model       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_events_user_id_idx ON public.learning_events(user_id);
CREATE INDEX IF NOT EXISTS learning_events_session_id_idx ON public.learning_events(session_id);
CREATE INDEX IF NOT EXISTS learning_events_event_type_idx ON public.learning_events(event_type);
CREATE INDEX IF NOT EXISTS learning_events_occurred_at_idx ON public.learning_events(occurred_at);
