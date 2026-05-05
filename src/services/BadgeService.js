const prisma = require('../prismaClient');

const BADGE_BASE_URL = process.env.SUPABASE_URL + '/storage/v1/object/public/badges/';
const ELO_BADGE_BANDS = [
    { name: 'Beginner', fileName: 'beginner.png', type: 'BEGINNER' },
    { name: 'Basic Understanding', fileName: 'basic_understanding.png', type: 'BEGINNER' },
    { name: 'Developing Learner', fileName: 'developing_learner.png', type: 'INTERMEDIATE' },
    { name: 'Intermediate', fileName: 'intermediate.png', type: 'INTERMEDIATE' },
    { name: 'Proficient', fileName: 'proficient.png', type: 'ADVANCE' },
    { name: 'Advanced', fileName: 'advanced.png', type: 'ADVANCE' },
    { name: 'Mastery', fileName: 'master.png', type: 'ADVANCE' },
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

const normalizeBadgePayload = (badge) => {
    if (!badge) {
        return badge;
    }

    return {
        ...badge,
        image: normalizeBadgeImage(badge.image),
    };
};

exports.getAllBadges = async () => {
    try {
        const badges = await prisma.badge.findMany({
            include: {
                course: true,
                chapter: true,
            }
        }); 
        return badges.map((badge) => normalizeBadgePayload(badge));
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getBadgeById = async (id) => {
    try {
        const badge = await prisma.badge.findUnique({
            where: {
                id
            },
        });
        return normalizeBadgePayload(badge);
    } catch (error) {
        throw new Error(`Error retrieving badge with id ${id}`);
    }
}

exports.createBadge = async (newData) => {
    try {
        const newBadge = await prisma.badge.create({
            data: newData
        });
        return newBadge;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateBadge = async(id, updateData) => {
    try {
        const badge = await prisma.badge.update({
            where: { id },      
            data: updateData,     
        });
        return badge;  
    } catch (error) {
        if (error.code === 'P2025') {
            return null;
        }
        throw new Error(error.message);  
    }
}

exports.deleteBadge = async(id) => {
    try {
        await prisma.$transaction([
            prisma.userBadge.deleteMany({
                where: { badgeId: id },
            }),
            prisma.badge.delete({
                where: { id },
            }),
        ]);

        return `Successfully deleted badge with id: ${id}`;
    } catch (error) {
        if (error.code === 'P2025') {
            return null;
        }
        throw new Error('Error deleting badge: ' + error.message); 
    }
}


exports.getBadgesByCourse = async(courseId) => {
    try {
        const badge = await prisma.badge.findMany({
            where: {
                courseId: parseInt(courseId)
            }
        });
        return badge.map((item) => normalizeBadgePayload(item));
    } catch (error) {
        throw new Error(error.message);
    }
}