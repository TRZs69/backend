# Learning Analytics Documentation for `student_summaries_2`

## Tujuan
Dokumen ini menjelaskan bagaimana kolom-kolom learning analytics di tabel `public.student_summaries_2` dihitung dan dari mana sumber datanya berasal.

## Lokasi Kode Utama
- `supabase/student_summary_v2.sql`
  - Definisi tabel `public.student_summaries_2`
  - Fungsi agregasi utama `public.recompute_student_summary_v2`
- `src/services/EvaluationService.js`
  - Definisi event names dan mapping hasil summary ke API
- `src/services/AssessmentService.js`
  - Mencatat event `assessment_start` dan `assessment_submit`
- `src/services/UserChapterService.js`
  - Mencatat event `assignment_submit`
- `src/services/ChatbotService.js`
  - Mencatat event `chatbot_interaction`

---

## Sumber Data Utama
Semua agregasi learning analytics dibangun dari tabel `public.activity_logs`.

### Event penting
- `session_start` → sesi mulai
- `session_end` → sesi berakhir
- `assessment_start` → mulai percobaan assessment
- `assessment_submit` → submit assessment
- `assignment_submit` → submit assignment
- `chapter_completed` → selesaikan bab
- `badge_earned` → badge diperoleh
- `chatbot_interaction` → interaksi chatbot

---

## Penjelasan Kolom dan Cara Penghitungan

### `sessions_total`
- Kategori: sesi
- Diitung dari: `count(*) filter (where event_name = 'session_start')`
- Artinya: jumlah sesi yang dicatat selama periode.
- Lokasi: `student_summary_v2.sql`, CTE `session_metrics`.

### `active_days`
- Kategori: sesi
- Diitung dari: `count(distinct date(timezone('Asia/Jakarta', event_ts))) where event_name = 'session_start'`
- Artinya: jumlah hari berbeda pengguna aktif memulai sesi.
- Lokasi: `student_summary_v2.sql`, CTE `session_metrics`.

### `return_rate_pct`
- Kategori: retensi
- Diitung dari: `round((active_days::numeric / nullif(period_days, 0)) * 100, 2)` dan dibatasi 0..100.
- Artinya: persentase hari aktif terhadap total hari periode.
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

### `avg_session_duration_sec`
- Kategori: sesi
- Diitung dari:
  - `session_pairs` ketika `session_id` tersedia
  - fallback `daily_window` bila `session_id` tidak tersedia
  - `avg(extract(epoch from (end_ts - start_ts)))`
- Artinya: rata-rata durasi sesi dalam detik.
- Lokasi: `student_summary_v2.sql`, CTE `session_metrics`.

### `assessments_submitted`
- Kategori: assessment
- Diitung dari: `count(*) filter (where event_name = 'assessment_submit')`
- Artinya: jumlah submission assessment tercatat.
- Lokasi: `student_summary_v2.sql`, CTE `assessment_metrics`.

### `assessment_attempts`
- Kategori: assessment
- Diitung dari: `count(distinct assessment_attempt_id) filter (where event_name in ('assessment_start', 'assessment_submit') and assessment_attempt_id is not null and assessment_attempt_id <> 0)`
- Artinya: jumlah percobaan assessment unik.
- Lokasi: `student_summary_v2.sql`, CTE `assessment_metrics`.

### `avg_grade`
- Kategori: assessment
- Diitung dari: `avg(score) filter (where event_name = 'assessment_submit' and score is not null')`
- Artinya: rata-rata nilai assessment yang di-submit.
- Lokasi: `student_summary_v2.sql`, CTE `assessment_metrics`.

### `total_points_earned`
- Kategori: assessment
- Diitung dari: `sum(points) filter (where event_name = 'assessment_submit')`
- Artinya: jumlah total poin yang diperoleh dari assessment.
- Lokasi: `student_summary_v2.sql`, CTE `assessment_metrics`.

### `retry_attempts`
- Kategori: assessment
- Diitung dari: `greatest(0, assessments_submitted - distinct_assessment_chapters)`
- Artinya: estimasi jumlah submit ulang assessment berdasarkan jumlah submit dan jumlah bab assessment unik.
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

### `chapters_completed`
- Kategori: kemajuan belajar
- Diitung dari: `count(distinct chapter_id) filter (where event_name = 'chapter_completed')`
- Artinya: jumlah bab yang diselesaikan.
- Lokasi: `student_summary_v2.sql`, CTE `progress_metrics`.

### `badges_earned`
- Kategori: penghargaan
- Diitung dari: `count(*) filter (where event_name = 'badge_earned')`
- Artinya: jumlah badge yang diraih.
- Lokasi: `student_summary_v2.sql`, CTE `progress_metrics`.

### `assignments_submitted`
- Kategori: assignment
- Diitung dari: `count(*) filter (where event_name = 'assignment_submit')`
- Artinya: jumlah tugas yang dikirimkan.
- Lokasi: `student_summary_v2.sql`, CTE `progress_metrics`.

### `chat_sessions`
- Kategori: chatbot
- Diitung dari: `count(distinct chat_session_id) filter (where event_name = 'chatbot_interaction' and chat_session_id is not null and chat_session_id <> '')`
- Artinya: jumlah sesi chat unik.
- Lokasi: `student_summary_v2.sql`, CTE `chat_metrics`.

### `chat_messages`
- Kategori: chatbot
- Diitung dari:
  - `sum(case when metadata->>'messages_total' ~ '^-?[0-9]+$' then (metadata->>'messages_total')::integer else 1 end)`
- Artinya: total pesan chat berdasarkan metadata `messages_total`.
- Lokasi: `student_summary_v2.sql`, CTE `chat_metrics`.

### `chat_user_messages`
- Kategori: chatbot
- Diitung dari:
  - `sum(case when metadata->>'user_messages' ~ '^-?[0-9]+$' then (metadata->>'user_messages')::integer else 1 end)`
- Artinya: total pesan pengguna di chat.
- Lokasi: `student_summary_v2.sql`, CTE `chat_metrics`.

### `total_activity`
- Kategori: aktivitas keseluruhan
- Diitung dari: `count(*) from filtered_events`
- Artinya: jumlah semua event yang terjadi dalam periode.
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

### `system_usage_intensity`
- Kategori: intensitas penggunaan
- Diitung dari: `round((total_activity::numeric / nullif(period_days, 0))::numeric, 4)`
- Artinya: rata-rata aktivitas per hari.
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

### `total_available_chapters`
- Kategori: konteks kemajuan
- Diambil dari:
  - parameter `p_total_available_chapters`
  - atau metadata event `total_available_chapters` jika tersedia
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

### `learning_progress_rate`
- Kategori: kemajuan belajar
- Diitung dari: `round(((chapters_completed::numeric / total_available_chapters::numeric) * 100)::numeric, 2)` ketika `total_available_chapters > 0`
- Artinya: persentase bab selesai terhadap bab tersedia.
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

### `features_used`
- Kategori: penggunaan fitur
- Diitung dari jumlah jenis event fitur yang pernah muncul:
  - `user_login`
  - `session_start` / `session_end`
  - `assessment_submit`
  - `material_access`
  - `assignment_submit`
  - `chatbot_interaction`
- Lokasi: `student_summary_v2.sql`, CTE `feature_flags` dan `feature_metrics`.

### `feature_utilization_score`
- Kategori: penggunaan fitur
- Diitung dari: `round(((features_used::numeric / 6) * 100)::numeric, 2)`
- Artinya: persentase pemakaian dari 6 fitur yang dihitung.
- Lokasi: `student_summary_v2.sql`, CTE `totals`.

---

## Catatan Penting untuk Analisis
- `assessment_attempts` hanya akurat jika `assessment_attempt_id` ada dan valid.
- `chat_messages` dan `chat_user_messages` bergantung pada metadata chat; jika metadata tidak valid, fallbacknya menjadi 1 per event.
- `chat_sessions` bergantung pada `chat_session_id`; nilai kosong atau tidak konsisten dapat membuat hitungan salah.
- `retry_attempts` adalah turunan estimasi, bukan hitungan langsung dari event khusus retry.

## Rekomendasi Penggunaan
Untuk analisis hasil learning analytics, gunakan nilai-nilai ini sebagai dasar laporan:
- aktivitas sesi dan retensi: `sessions_total`, `active_days`, `return_rate_pct`, `avg_session_duration_sec`
- performa assessment: `assessments_submitted`, `assessment_attempts`, `avg_grade`, `total_points_earned`, `retry_attempts`
- kemajuan materi: `chapters_completed`, `learning_progress_rate`
- penggunaan fitur: `features_used`, `feature_utilization_score`
- interaksi chatbot: `chat_sessions`, `chat_messages`, `chat_user_messages`

## Cara Verifikasi Data
1. Periksa jumlah event di `activity_logs` untuk masing-masing event type.
2. Bandingkan dengan nilai field di `student_summaries_2`.
3. Pastikan metadata chatbot berisi `messages_total` dan `user_messages` yang valid untuk setiap `chatbot_interaction`.
4. Jika nilai tidak cocok, telusuri apakah event yang tercatat duplikat atau ada event yang hilang.

## 5.3.6 Implementasi Learning Analytics Log Data

- **Tujuan**: Menangkap, menyimpan, dan memproses jejak interaksi mahasiswa (event-level) untuk analitik perilaku, efektivitas instruksi, dan sinyal adaptif.
- **Implementasi contoh**: lihat `supabase/learning_events.sql`, `src/utils/learningAnalyticsLogger.js`, dan `scripts/learning_analytics_etl.py`.

**Skema Penyimpanan (Supabase / Postgres)**

```sql
CREATE TABLE learning_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER,
  session_id  UUID NOT NULL,
  event_type  TEXT NOT NULL, -- e.g., 'page_view','attempt','hint','rating'
  occurred_at TIMESTAMPTZ DEFAULT now(),
  payload     JSONB DEFAULT '{}'::jsonb, -- bebas, berisi detail event (answer, latency, score)
  metadata    JSONB DEFAULT '{}'::jsonb, -- device, ip_hash, client_version
  token_count INTEGER,
  model       TEXT
);
```

**Contoh envelope JSON (format event)**

```json
{
  "user_id": 123,
  "session_id": "b7f2-...",
  "event_type": "attempt",
  "occurred_at": "2026-06-10T10:12:34Z",
  "payload": {
    "question_id": 456,
    "is_correct": true,
    "response_time_ms": 820,
    "attempt_no": 1,
    "difficulty_band": "intermediate"
  },
  "metadata": {
    "client": "web",
    "ua": "Chrome/..."
  }
}
```

**Prisma (MySQL) — ringkasan transaksional / fitur**

```prisma
model AnalyticsSummary {
  id             Int      @id @default(autoincrement())
  userId         Int
  periodStart    DateTime
  periodEnd      DateTime
  avgResponseMs  Float?
  attempts       Int     @default(0)
  correctRate    Float?
  engagementScore Float?
  createdAt      DateTime @default(now())
}
```

**Node.js / Express — Middleware logging (non-blocking)**
- Pastikan logging tidak menunda respons utama (push ke background/queue).

```js
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function learningEventLogger(eventType, payload = {}) {
  return async (req, res, next) => {
    const envelope = {
      user_id: req.user?.id ?? null,
      session_id: req.headers['x-session-id'] || null,
      event_type: eventType,
      payload,
      metadata: { ip_hash: req.ip ? hash(req.ip) : null, client: req.headers['user-agent'] },
      occurred_at: new Date().toISOString()
    };

    // Fire-and-forget: kirim ke Supabase tanpa tunggu (tangani error di background)
    supabase.from('learning_events').insert([envelope]).then(({ error }) => {
      if (error) console.error('log error', error);
    });

    next();
  };
}
```

- Untuk volume tinggi, gunakan queue (Redis/Bull) atau streaming ingestion.

**Python ETL / Pipeline Analitik (skeleton)**

- Flow: ambil event dari Supabase → transformasi (sessionization, cleaning) → hitung metrik per-user / per-session → simpan ringkasan ke MySQL / data-warehouse.

```py
import asyncpg
import pandas as pd
from datetime import datetime, timedelta

async def fetch_events(conn, since: datetime):
    q = "SELECT * FROM learning_events WHERE occurred_at >= $1"
    rows = await conn.fetch(q, since)
    return pd.DataFrame([dict(r) for r in rows])

def compute_session_metrics(df):
    # contoh: total attempts, avg response time, correctness rate per session
    df['payload'] = df['payload'].apply(lambda p: p or {})
    df['response_ms'] = df['payload'].apply(lambda p: p.get('response_time_ms'))
    grouped = df.groupby('session_id').agg(
        attempts=('id', 'count'),
        avg_response_ms=('response_ms', 'mean'),
        correct_rate=('payload', lambda s: sum(1 for p in s if p.get('is_correct')) / max(1, len(s)))
    ).reset_index()
    return grouped

# Simpan ringkasan ke MySQL (SQLAlchemy / pymysql) atau export ke parquet/BigQuery.
```

**Contoh Query Analitik (SQL)**

- Session duration (per session): asumsi ada event 'session_start' dan 'session_end'

```sql
SELECT
  session_id,
  MIN(occurred_at) AS start_ts,
  MAX(occurred_at) AS end_ts,
  EXTRACT(EPOCH FROM MAX(occurred_at) - MIN(occurred_at)) AS duration_s
FROM learning_events
GROUP BY session_id;
```

- Correctness rate per question:

```sql
SELECT
  payload->>'question_id' AS question_id,
  AVG( (payload->>'is_correct')::int ) AS correct_rate,
  COUNT(*) AS attempts
FROM learning_events
WHERE event_type = 'attempt'
GROUP BY payload->>'question_id';
```

**Metrik Utama yang Dihasilkan**
- Engagement: sesi aktif, waktu per sesi, events per session.
- Learning outcomes: correctness rate, attempts-to-master, hint usage, time-on-task.
- Adaptivity signals: per-user difficulty drift, Elo transitions, response latency trends.
- System health: event ingestion lag, drop rate, malformed events.

**Integrasi ke Pipeline ML**
- Simpan fitur (rolling correctness, avg response time, streaks, time decay) terpisah untuk model.
- Jadwalkan ETL harian/real-time: Airflow / Prefect / cron + job incremental (by occurred_at).
- Simpan schema version, feature definitions, dan snapshots untuk reproducibility.

**Keamanan & Privasi**
- Hash identitas/IP bila perlu, enkripsi sensitif, retention policy (mis. raw event 90 hari, ringkasan lebih lama).
- Anonimisasi saat mengekspor ke tim riset.

Jika ingin, saya dapat menambahkan contoh Airflow DAG, Dockerfile, atau notebook analitik sebagai kelanjutan.
