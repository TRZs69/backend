const prisma = require('../prismaClient');

exports.getAllAssignments = async () => {
    try {
        const assignments = await prisma.assignment.findMany(); 
        return assignments;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getAssignmentById = async (id) => {
    try {
        const assignment = await prisma.assignment.findUnique({
            where: {
                id
            },
        });
        return assignment;
    } catch (error) {
        throw new Error(`Error retrieving assignment with id ${id}`);
    }
}

exports.createAssignment = async (newData) => {
    try {
        const newAssignment = await prisma.assignment.create({
            data: newData
        });
        return newAssignment;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateAssignment = async(id, updateData) => {
    try {
        const assignment = await prisma.assignment.update({
            where: { id },      
            data: updateData,     
        });
        return assignment;  
    } catch (error) {
        throw new Error(error.message);  
    }
}

exports.deleteAssignment = async(id) => {
    try {
        await prisma.assignment.delete({
            where: { id },
        });
        return `Successfully deleted assignment with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting assignment: ' + error.message); 
    }
}