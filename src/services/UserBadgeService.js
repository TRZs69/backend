const prisma = require('../prismaClient');

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
        const badge = await prisma.userBadge.findMany({
            where: {
                userId: parseInt(userId)
            },
            include: {
                badge: true
            }
        });

        if (!badge.length) {
            throw new Error(`No badge found for user with id ${userId}`);
        }

        return badge;
    } catch (error) {
        throw new Error(error.message);
    }
}