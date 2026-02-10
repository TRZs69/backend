const prisma = require('../prismaClient');

exports.getAllUserTrades = async () => {
    try {
        const UserTrades = await prisma.UserTrade.findMany(); 
        return UserTrades;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getUserTradeById = async (id) => {
    try {
        const UserTrade = await prisma.UserTrade.findUnique({
            where: {
                id
            },
        });
        return UserTrade;
    } catch (error) {
        throw new Error(`Error retrieving UserTrade with id ${id}`);
    }
}

exports.createUserTrade = async (newData) => {
    try {
        const newUserTrade = await prisma.UserTrade.create({
            data: newData
        });
        return newUserTrade;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateUserTrade = async(id, updateData) => {
    try {
        const UserTrade = await prisma.UserTrade.update({
            where: { id },      
            data: updateData,     
        });
        return UserTrade;  
    } catch (error) {
        throw new Error(error.message);  
    }
}

exports.deleteUserTrade = async(id) => {
    try {
        await prisma.UserTrade.delete({
            where: { id },
        });
        return `Successfully deleted UserTrade with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting UserTrade: ' + error.message); 
    }
}


// SPECIAL SERVICES

exports.getTradesByUser = async (userId) => {
    try {
        const trade = await prisma.userTrade.findMany({
            where: {
                userId: parseInt(userId)
            },
            include: {
                trade: true
            }
        });

        if (!trade.length) {
            throw new Error(`No trade found for user with id ${userId}`);
        }

        return trade;
    } catch (error) {
        throw new Error(error.message);
    }
}