const supabase = require('../../supabase/supabase');
const NodeCache = require('node-cache');

const chatCache = new NodeCache({ stdTTL: 600, checkperiod: 620 });

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
  title: row.title,
  lastMessagePreview: row.last_message_preview,
  metadata: row.metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizeRole = (role) => (role === 'assistant' ? 'assistant' : 'user');

const normalizeChapterId = (chapterId) => {
  const parsed = Number(chapterId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.trunc(parsed);
};

async function findLatestSessionForUser({ userId, chapterId }) {
  if (!isEnabled || userId === undefined || userId === null) {
    return null;
  }

  const normalizedChapterId = normalizeChapterId(chapterId);

  try {
    let query = supabase
      .from(TABLE_SESSIONS)
      .select('id')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (normalizedChapterId !== null) {
      query = query.filter('metadata->>chapterId', 'eq', String(normalizedChapterId));
    } else {
      query = query.filter('metadata->chapterId', 'is', null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
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

async function ensureSession({ sessionId, userId, chapterId }) {
  if (!isEnabled) {
    return null;
  }

  const normalizedChapterId = normalizeChapterId(chapterId);

  if (sessionId) {
    try {
      const { data, error } = await supabase
        .from(TABLE_SESSIONS)
        .select('id, metadata')
        .eq('id', sessionId)
        .maybeSingle();

      if (!error && data?.id) {
        const currentMetadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
        const currentChapterId = normalizeChapterId(currentMetadata.chapterId);

        if (currentChapterId === normalizedChapterId) {
          return data.id;
        }

        // Context changed (different chapter), update the existing session's metadata
        const updatedMetadata = { ...currentMetadata, chapterId: normalizedChapterId };
        const { error: updateError } = await supabase
          .from(TABLE_SESSIONS)
          .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
          .eq('id', sessionId);

        if (!updateError) {
          return sessionId;
        }
        logError('ensureSession.updateContext', updateError);
      }
    } catch (error) {
      logError('ensureSession.lookup', error);
    }
  }

  const payload = {
    user_id: userId ?? null,
    metadata: normalizedChapterId !== null ? { chapterId: normalizedChapterId } : {},
  };

  // If sessionId was provided but not found, we can try to use it
  if (sessionId) {
    payload.id = sessionId;
  }

  const { data, error } = await supabase
    .from(TABLE_SESSIONS)
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .single();

  if (error) {
    logError('ensureSession.upsert', error);
    throw new Error('Gagal mengamankan sesi chat');
  }

  return data.id;
}

async function createSession({ userId, title, metadata = {}, chapterId }) {
  if (!isEnabled) {
    throw new Error('Chat history tidak aktif');
  }

  const normalizedChapterId = normalizeChapterId(chapterId);
  const normalizedMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};
  if (normalizedChapterId !== null) {
    normalizedMetadata.chapterId = normalizedChapterId;
  }

  const payload = {
    user_id: userId ?? null,
    title: title ? title.toString().trim().slice(0, 120) : null,
    metadata: normalizedMetadata,
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

async function listSessions({ userId, chapterId, limit = 20, offset = 0 }) {
  if (!isEnabled || userId === undefined || userId === null) {
    return [];
  }

  const normalizedChapterId = normalizeChapterId(chapterId);

  let query = supabase
    .from(TABLE_SESSIONS)
    .select('id, user_id, title, last_message_preview, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (normalizedChapterId !== null) {
    query = query.filter('metadata->>chapterId', 'eq', String(normalizedChapterId));
  } else {
    query = query.filter('metadata->chapterId', 'is', null);
  }

  const { data, error } = await query;

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

  const cacheKey = `messages_${sessionId}_${limit}`;
  const cachedMessages = chatCache.get(cacheKey);

  if (cachedMessages) {
    return cachedMessages;
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

  const formattedMessages = data.map(mapRowToMessage);
  chatCache.set(cacheKey, formattedMessages);

  return formattedMessages;
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
    return [];
  }

  const { data, error } = await supabase.from(TABLE_MESSAGES).insert(rows).select();

  if (error) {
    logError('appendMessages', error);
    return [];
  } else {
    const keys = chatCache.keys().filter(key => key.startsWith(`messages_${sessionId}`));
    if (keys.length > 0) {
      chatCache.del(keys);
    }
    return (data || []).map(mapRowToMessage);
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

async function truncateAfterMessage({ sessionId, messageId }) {
  if (!isEnabled || !sessionId || !messageId) {
    return;
  }

  try {
    const { data: targetMsg, error: fetchError } = await supabase
      .from(TABLE_MESSAGES)
      .select('created_at')
      .eq('id', messageId)
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !targetMsg) {
      logError('truncateAfterMessage.fetch', fetchError);
      throw new Error('Pesan asal tidak ditemukan');
    }

    
    const { error: deleteError } = await supabase
      .from(TABLE_MESSAGES)
      .delete()
      .eq('session_id', sessionId)
      .gt('created_at', targetMsg.created_at);

    if (deleteError) {
      logError('truncateAfterMessage.delete', deleteError);
      throw new Error('Gagal menghapus riwayat setelah pesan');
    } else {
      const keys = chatCache.keys().filter(key => key.startsWith(`messages_${sessionId}`));
      if (keys.length > 0) {
        chatCache.del(keys);
      }
    }
  } catch (error) {
    logError('truncateAfterMessage.catch', error);
    throw error;
  }
}

async function updateMessageContent({ messageId, content }) {
  if (!isEnabled || !messageId || !content) {
    return;
  }

  const { error } = await supabase
    .from(TABLE_MESSAGES)
    .update({ content: content.trim() })
    .eq('id', messageId);

  if (error) {
    logError('updateMessageContent', error);
    throw new Error('Gagal memperbarui konten pesan');
  }
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
    .select('id, user_id, title, last_message_preview, metadata, created_at, updated_at')
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
  truncateAfterMessage,
  updateMessageContent,
};
