const supabase = require('../../supabase/supabase');

const TABLE_SESSIONS = 'chat_sessions';
const TABLE_MESSAGES = 'chat_messages';

const hasServiceRoleKey = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const hasUrl = Boolean(process.env.SUPABASE_URL);
const isEnabled = hasServiceRoleKey && hasUrl;

const logError = (scope, error) => {
  if (!error) {
    return;
  }

  const details = error?.details || error?.message || error;
  const hint = error?.hint ? ` (${error.hint})` : '';
  console.error(`[ChatHistoryRepository] ${scope}:`, details, hint);
};

const mapRowToMessage = (row = {}) => ({
  id: row.id,
  sessionId: row.session_id,
  role: row.role,
  content: row.content,
  createdAt: row.created_at,
});

const mapRowToSession = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  deviceId: row.device_id,
  title: row.title,
  lastMessagePreview: row.last_message_preview,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizeRole = (role) => (role === 'assistant' ? 'assistant' : 'user');

async function findLatestSessionForUser({ userId }) {
  if (!isEnabled || userId === undefined || userId === null) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(TABLE_SESSIONS)
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // PGRST116 = multiple rows, treat as warning but continue.
      if (error.code !== 'PGRST116') {
        logError('findLatestSessionForUser', error);
      }
      return null;
    }

    return data?.id || null;
  } catch (error) {
    logError('findLatestSessionForUser', error);
    return null;
  }
}

async function ensureSession({ sessionId, userId, deviceId }) {
  if (!isEnabled) {
    return null;
  }

  if (sessionId) {
    try {
      const { data, error } = await supabase
        .from(TABLE_SESSIONS)
        .select('id')
        .eq('id', sessionId)
        .maybeSingle();

      if (!error && data?.id) {
        return data.id;
      }
    } catch (error) {
      logError('ensureSession.lookup', error);
    }
  }

  // Removed auto-resume logic to support "lazy" new chat creation.
  // if (!sessionId && userId !== undefined && userId !== null) {
  //   const latestSessionId = await findLatestSessionForUser({ userId });
  //   if (latestSessionId) {
  //     return latestSessionId;
  //   }
  // }

  const payload = {
    user_id: userId ?? null,
    device_id: deviceId ?? null,
  };

  if (sessionId) {
    payload.id = sessionId;
  }

  const { data, error } = await supabase
    .from(TABLE_SESSIONS)
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    logError('ensureSession.insert', error);
    throw new Error('Gagal membuat sesi chat baru');
  }

  return data.id;
}

async function createSession({ userId, deviceId, title, metadata = {} }) {
  if (!isEnabled) {
    throw new Error('Chat history tidak aktif');
  }

  const payload = {
    user_id: userId ?? null,
    device_id: deviceId ?? null,
    title: title ? title.toString().trim().slice(0, 120) : null,
    metadata,
  };

  const { data, error } = await supabase
    .from(TABLE_SESSIONS)
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    logError('createSession.insert', error);
    throw new Error('Gagal membuat sesi chat baru');
  }

  return mapRowToSession(data);
}

async function listSessions({ userId, limit = 20, offset = 0 }) {
  if (!isEnabled || userId === undefined || userId === null) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE_SESSIONS)
    .select('id, user_id, device_id, title, last_message_preview, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    logError('listSessions', error);
    return [];
  }

  return data.map(mapRowToSession);
}

async function fetchMessages({ sessionId, limit = 50 }) {
  if (!isEnabled || !sessionId) {
    return [];
  }

  const { data, error } = await supabase
    .from(TABLE_MESSAGES)
    .select('id, session_id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    logError('fetchMessages', error);
    return [];
  }

  return data.map(mapRowToMessage);
}

async function appendMessages({ sessionId, messages = [] }) {
  if (!isEnabled || !sessionId || !messages.length) {
    return;
  }

  const rows = messages
    .map((message) => ({
      session_id: sessionId,
      role: sanitizeRole(message.role),
      content: (message.content || '').trim(),
      metadata: message.metadata || {},
      token_count: message.tokenCount ?? null,
    }))
    .filter((row) => row.content);

  if (!rows.length) {
    return;
  }

  const { error } = await supabase.from(TABLE_MESSAGES).insert(rows);

  if (error) {
    logError('appendMessages', error);
  }
}

async function deleteSession({ sessionId }) {
  if (!isEnabled || !sessionId) {
    return { deleted: false };
  }

  const { error } = await supabase.from(TABLE_SESSIONS).delete().eq('id', sessionId);

  if (error) {
    logError('deleteSession', error);
    throw new Error('Gagal menghapus sesi chat');
  }

  return { deleted: true };
}

async function renameSession({ sessionId, title }) {
  if (!isEnabled || !sessionId) {
    throw new Error('SessionId is required');
  }

  const normalizedTitle = title ? title.toString().trim().slice(0, 120) : null;
  const { data, error } = await supabase
    .from(TABLE_SESSIONS)
    .update({ title: normalizedTitle })
    .eq('id', sessionId)
    .select('id, user_id, device_id, title, last_message_preview, metadata, created_at, updated_at')
    .single();

  if (error) {
    logError('renameSession', error);
    throw new Error('Gagal memperbarui judul sesi');
  }

  return mapRowToSession(data);
}

module.exports = {
  isEnabled,
  ensureSession,
  createSession,
  listSessions,
  fetchMessages,
  appendMessages,
  deleteSession,
  renameSession,
  findLatestSessionForUser,
};
