const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
);

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function learningEventLogger(eventType, payload = {}) {
  return async (req, res, next) => {
    const envelope = {
      user_id: req.user?.id ?? null,
      session_id: req.headers['x-session-id'] || req.body.session_id || null,
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      payload,
      metadata: {
        client: req.headers['user-agent'] || null,
        ip_hash: req.ip ? hashValue(req.ip) : null,
        source: req.headers['x-client-source'] || 'web',
        request_id: req.headers['x-request-id'] || null
      },
      token_count: payload.token_count,
      model: payload.model || null
    };

    supabase
      .from('learning_events')
      .insert([envelope])
      .then(({ error }) => {
        if (error) {
          console.error('[LearningEventLogger] Supabase insert failed', error);
        }
      });

    next();
  };
}

module.exports = {
  learningEventLogger
};
