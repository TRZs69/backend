require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const baseUrl = process.env.SUPABASE_URL;

  if (!baseUrl || baseUrl.trim() === '') {
    throw new Error('SUPABASE_URL is not set. Update the environment variables before running this script.');
  }

  const brokenBadges = await prisma.badge.findMany({
    where: {
      image: {
        startsWith: 'undefined',
      },
    },
  });

  if (brokenBadges.length === 0) {
    console.log('[fix-badges] No badge records require updates.');
    return;
  }

  console.log(`[fix-badges] Found ${brokenBadges.length} badge(s) with broken image URLs. Updating...`);

  for (const badge of brokenBadges) {
    const parts = badge.image.split('/');
    const fileName = parts[parts.length - 1];
    if (!fileName) {
      console.warn(`[fix-badges] Could not determine filename for badge ${badge.id}. Skipping.`);
      continue;
    }

    const normalizedImage = `${baseUrl}/storage/v1/object/public/badges/${fileName}`;
    await prisma.badge.update({
      where: { id: badge.id },
      data: { image: normalizedImage },
    });
    console.log(`[fix-badges] Updated badge ${badge.id} → ${normalizedImage}`);
  }

  console.log('[fix-badges] Completed image URL repairs.');
}

main()
  .catch((error) => {
    console.error('[fix-badges] Failed:', error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
