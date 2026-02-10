const prisma = require('../prismaClient');

exports.getAllBadges = async () => {
    try {
        const badges = await prisma.badge.findMany({
            include: {
                course: true,
                chapter: true,
            }
        }); 
        return badges;
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
        return badge;
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
        throw new Error(error.message);  
    }
}

exports.deleteBadge = async(id) => {
    try {
        await prisma.badge.delete({
            where: { id },
        });
        return `Successfully deleted badge with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting badge: ' + error.message); 
    }
}


// SPECIAL SERVICES

exports.getBadgesByCourse = async(courseId) => {
    try {
        const badge = await prisma.badge.findMany({
            where: {
                courseId: parseInt(courseId)
            }
        });
        return badge;
    } catch (error) {
        throw new Error(error.message);
    }
}