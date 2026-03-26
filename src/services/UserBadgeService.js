const prisma = require('../prismaClient');

const BADGE_BASE_URL = 'https://itarozdimxukkhwxruti.supabase.co/storage/v1/object/public/badges/';
const ELO_BADGE_BANDS = [
    { name: 'Beginner', min: 750, fileName: 'beginner.png', type: 'BEGINNER' },
    { name: 'Basic Understanding', min: 1000, fileName: 'basic_understanding.png', type: 'BEGINNER' },
    { name: 'Developing Learner', min: 1200, fileName: 'developing_learner.png', type: 'INTERMEDIATE' },
    { name: 'Intermediate', min: 1400, fileName: 'intermediate.png', type: 'INTERMEDIATE' },
    { name: 'Proficient', min: 1600, fileName: 'proficient.png', type: 'ADVANCE' },
    { name: 'Advanced', min: 1800, fileName: 'advanced.png', type: 'ADVANCE' },
    { name: 'Mastery', min: 2000, fileName: 'master.png', type: 'ADVANCE' },
];

const BADGE_NAME_ALIASES = {
    beginnerdesigner: 'Beginner',
    intermediatedesigner: 'Intermediate',
    advancedesigner: 'Advanced',
    advanceddesigner: 'Advanced',
};

const normalizeNameKey = (value = '') =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const getNormalizedBandByName = (name = '') => {
    const directNeedle = String(name || '').trim().toLowerCase();
    const aliasResolved = BADGE_NAME_ALIASES[normalizeNameKey(name)] || null;
    const needle = aliasResolved ? aliasResolved.toLowerCase() : directNeedle;
    return ELO_BADGE_BANDS.find((band) => band.name.toLowerCase() === needle) || null;
};

const normalizeBadgeImage = (rawImage) => {
    const image = String(rawImage || '').trim();
    if (!image) {
        return image;
    }

    if (!/^https?:\/\//i.test(image)) {
        return image;
    }

    const version = Date.now();
    const separator = image.includes('?') ? '&' : '?';
    return `${image}${separator}v=${version}`;
};

const buildEloBadgesForUser = ({ userId, userElo, fallbackCourseId, fallbackChapterId }) => {
    const effectiveElo = Number.isFinite(Number(userElo)) ? Number(userElo) : 750;
    return ELO_BADGE_BANDS
        .filter((band) => effectiveElo >= band.min)
        .map((band, index) => ({
            id: 9000000 + (Number(userId) || 0) * 100 + index,
            userId: Number(userId),
            badgeId: 8000000 + index,
            isPurchased: true,
            badge: {
                id: 8000000 + index,
                name: band.name,
                type: band.type,
                image: `${BADGE_BASE_URL}${band.fileName}`,
                courseId: Number(fallbackCourseId) || 1,
                chapterId: Number(fallbackChapterId) || 1,
            },
        }));
};

exports.getAllUserBadges = async () => {
    try {
        const UserBadges = await prisma.UserBadge.findMany(); 
        return UserBadges;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getUserBadgeById = async (id) => {
    try {
        const UserBadge = await prisma.UserBadge.findUnique({
            where: {
                id
            },
        });
        return UserBadge;
    } catch (error) {
        throw new Error(`Error retrieving UserBadge with id ${id}`);
    }
}

exports.createUserBadge = async (newData) => {
    try {
        const newUserBadge = await prisma.UserBadge.create({
            data: newData
        });
        return newUserBadge;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateUserBadge = async(id, updateData) => {
    try {
        const UserBadge = await prisma.UserBadge.update({
            where: { id },      
            data: updateData, 
            include: {
                badge: true
            }    
        });
        return UserBadge;  
    } catch (error) {
        throw new Error(error.message);  
    }
}

exports.deleteUserBadge = async(id) => {
    try {
        await prisma.UserBadge.delete({
            where: { id },
        });
        return `Successfully deleted UserBadge with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting UserBadge: ' + error.message); 
    }
}


// SPECIAL SERVICES

exports.getBadgesByUser = async (userId) => {
    try {
        const normalizedUserId = parseInt(userId);
        const badge = await prisma.userBadge.findMany({
            where: {
                userId: normalizedUserId
            },
            include: {
                badge: true
            }
        });

        const [user, firstChapter] = await Promise.all([
            prisma.user.findUnique({
                where: { id: normalizedUserId },
                select: { role: true, elo: true },
            }),
            prisma.chapter.findFirst({
                orderBy: { id: 'asc' },
                select: { id: true, courseId: true },
            }),
        ]);

        const withNormalizedImages = badge.map((entry) => {
            const normalizedImage = normalizeBadgeImage(entry?.badge?.image);
            const band = getNormalizedBandByName(entry?.badge?.name);
            if (!entry?.badge) {
                return entry;
            }

            if (!band) {
                return {
                    ...entry,
                    badge: {
                        ...entry.badge,
                        image: normalizedImage,
                    },
                };
            }

            return {
                ...entry,
                badge: {
                    ...entry.badge,
                    name: band.name,
                    image: normalizedImage,
                    type: band.type,
                },
            };
        });

        const isStudent = String(user?.role || '').toUpperCase() === 'STUDENT';
        if (!isStudent) {
            return withNormalizedImages;
        }

        const existingBandNames = new Set(
            withNormalizedImages
                .map((entry) => String(entry?.badge?.name || '').trim().toLowerCase())
                .filter(Boolean),
        );

        const eloBadges = buildEloBadgesForUser({
            userId: normalizedUserId,
            userElo: user?.elo,
            fallbackCourseId: firstChapter?.courseId,
            fallbackChapterId: firstChapter?.id,
        }).filter((entry) => !existingBandNames.has(String(entry.badge.name || '').toLowerCase()));

        return [...withNormalizedImages, ...eloBadges];
    } catch (error) {
        throw new Error(error.message);
    }
}