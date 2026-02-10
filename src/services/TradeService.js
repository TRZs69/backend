const prisma = require('../prismaClient');

exports.getAllTrades = async () => {
    try {
        const trades = await prisma.trade.findMany(); 
        return trades;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getTradeById = async (id) => {
    try {
        const trade = await prisma.trade.findUnique({
            where: {
                id
            },
        });
        return trade;
    } catch (error) {
        throw new Error(`Error retrieving trade with id ${id}`);
    }
}

exports.createTrade = async (newData) => {
    try {
        const newTrade = await prisma.trade.create({
            data: newData
        });
        return newTrade;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateTrade = async(id, updateData) => {
    try {
        const trade = await prisma.trade.update({
            where: { id },      
            data: updateData,     
        });
        return trade;  
    } catch (error) {
        throw new Error(error.message);  
    }
}

exports.deleteTrade = async(id) => {
    try {
        await prisma.trade.delete({
            where: { id },
        });
        return `Successfully deleted trade with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting trade: ' + error.message); 
    }
}


// SPECIAL SERVICES

exports.getTradesByCourse = async(courseId) => {
    try {
        const trade = await prisma.trade.findMany({
            where: {
                courseId: parseInt(courseId)
            }
        });
        return trade;
    } catch (error) {
        throw new Error(error.message);
    }
}