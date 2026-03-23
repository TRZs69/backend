require('dotenv').config();

const supabase = require('../supabase/supabase');
const prisma = require('../src/prismaClient');

const TABLE_SESSIONS = 'chat_sessions';
const BATCH_SIZE = 500;

const normalizePositiveInt = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.trunc(parsed);
};

const getMaterialChapterId = async (materialId, cache) => {
  if (cache.has(materialId)) {
    return cache.get(materialId);
  }

  try {
    const material = await prisma.material.findUnique({
      where: { id: materialId },
      select: { chapterId: true },
    });
    const chapterId = normalizePositiveInt(material?.chapterId);
    cache.set(materialId, chapterId);
    return chapterId;
  } catch (error) {
    console.error(`[backfill-chat-session-chapter] prisma lookup failed for materialId=${materialId}:`, error.message);
    cache.set(materialId, null);
    return null;
  }
};

const main = async () => {
  const applyChanges = process.argv.includes('--apply');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.LEVELY_SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[backfill-chat-session-chapter] WARNING: service role key not detected; updates may fail due to RLS.');
  }

  const materialChapterCache = new Map();

  let offset = 0;
  let scanned = 0;
  let skippedHasChapter = 0;
  let skippedNoMaterial = 0;
  let unresolvedMaterial = 0;
  let candidates = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE_SESSIONS)
      .select('id, metadata')
      .range(offset, offset + BATCH_SIZE - 1)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`[backfill-chat-session-chapter] Failed reading sessions: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const session of data) {
      scanned += 1;

      const metadata = session?.metadata && typeof session.metadata === 'object' ? { ...session.metadata } : {};
      const currentChapterId = normalizePositiveInt(metadata.chapterId);
      if (currentChapterId !== null) {
        skippedHasChapter += 1;
        continue;
      }

      const materialId = normalizePositiveInt(metadata.materialId);
      if (materialId === null) {
        skippedNoMaterial += 1;
        continue;
      }

      const chapterId = await getMaterialChapterId(materialId, materialChapterCache);
      if (chapterId === null) {
        unresolvedMaterial += 1;
        continue;
      }

      candidates += 1;
      if (!applyChanges) {
        continue;
      }

      const mergedMetadata = { ...metadata, chapterId };
      const { error: updateError } = await supabase
        .from(TABLE_SESSIONS)
        .update({ metadata: mergedMetadata })
        .eq('id', session.id);

      if (updateError) {
        failed += 1;
        console.error(`[backfill-chat-session-chapter] Failed updating session=${session.id}:`, updateError.message);
      } else {
        updated += 1;
      }
    }

    offset += data.length;
    if (data.length < BATCH_SIZE) {
      break;
    }
  }

  console.log('[backfill-chat-session-chapter] Summary');
  console.log(`- mode: ${applyChanges ? 'apply' : 'dry-run'}`);
  console.log(`- scanned: ${scanned}`);
  console.log(`- already_had_chapter: ${skippedHasChapter}`);
  console.log(`- skipped_no_material_id: ${skippedNoMaterial}`);
  console.log(`- unresolved_material_to_chapter: ${unresolvedMaterial}`);
  console.log(`- candidates: ${candidates}`);
  if (applyChanges) {
    console.log(`- updated: ${updated}`);
    console.log(`- failed: ${failed}`);
  }
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
