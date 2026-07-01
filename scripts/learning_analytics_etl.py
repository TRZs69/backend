import os
import asyncio
import asyncpg
import pandas as pd
from datetime import datetime, timedelta

SUPABASE_DB_URL = os.getenv('SUPABASE_DB_URL')
MYSQL_DB_URL = os.getenv('DATABASE_URL')

EVENT_QUERY = "SELECT id, user_id, session_id, event_type, occurred_at, payload, metadata FROM public.learning_events WHERE occurred_at >= $1"

async def fetch_events(conn, since: datetime) -> pd.DataFrame:
    rows = await conn.fetch(EVENT_QUERY, since)
    if not rows:
        return pd.DataFrame([])
    return pd.DataFrame([dict(row) for row in rows])


def normalize_payload(df: pd.DataFrame) -> pd.DataFrame:
    df['payload'] = df['payload'].apply(lambda p: p if isinstance(p, dict) else {})
    df['metadata'] = df['metadata'].apply(lambda m: m if isinstance(m, dict) else {})
    df['response_time_ms'] = df['payload'].apply(lambda p: p.get('response_time_ms'))
    df['is_correct'] = df['payload'].apply(lambda p: p.get('is_correct'))
    df['question_id'] = df['payload'].apply(lambda p: p.get('question_id'))
    return df


def compute_session_metrics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame([])

    session = df.groupby('session_id').agg(
        event_count=('id', 'count'),
        distinct_users=('user_id', 'nunique'),
        attempts=('event_type', lambda s: (s == 'attempt').sum()),
        avg_response_ms=('response_time_ms', 'mean'),
        correct_rate=('is_correct', lambda x: x.dropna().astype(int).mean() if len(x.dropna()) else None),
        first_event=('occurred_at', 'min'),
        last_event=('occurred_at', 'max')
    ).reset_index()
    session['duration_sec'] = (session['last_event'] - session['first_event']).dt.total_seconds()
    return session


def compute_user_metrics(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame([])

    user = df.groupby('user_id').agg(
        events_total=('id', 'count'),
        unique_sessions=('session_id', 'nunique'),
        avg_response_ms=('response_time_ms', 'mean'),
        correct_rate=('is_correct', lambda x: x.dropna().astype(int).mean() if len(x.dropna()) else None),
        hint_count=('event_type', lambda s: (s == 'hint').sum()),
        rating_count=('event_type', lambda s: (s == 'rating').sum())
    ).reset_index()
    return user


def main():
    since = datetime.utcnow() - timedelta(days=1)

    async def run():
        if not SUPABASE_DB_URL:
            raise ValueError('SUPABASE_DB_URL is required')

        conn = await asyncpg.connect(SUPABASE_DB_URL)
        raw_events = await fetch_events(conn, since)
        await conn.close()

        raw_events = normalize_payload(raw_events)
        session_metrics = compute_session_metrics(raw_events)
        user_metrics = compute_user_metrics(raw_events)

        print('=== Session Metrics ===')
        print(session_metrics.head())
        print('\n=== User Metrics ===')
        print(user_metrics.head())

    asyncio.run(run())


if __name__ == '__main__':
    main()
