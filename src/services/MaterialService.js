const prisma = require('../prismaClient');

exports.getAllMaterials = async () => {
    try {
        const materials = await prisma.material.findMany(); 
        return materials;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.getMaterialById = async (id) => {
    try {
        const material = await prisma.material.findUnique({
            where: {
                id
            },
        });
        return material;
    } catch (error) {
        throw new Error(`Error retrieving material with id ${id}`);
    }
}

exports.createMaterial = async (newData) => {
    try {
        const newMaterial = await prisma.material.create({
            data: newData
        });
        return newMaterial;
    } catch (error) {
        throw new Error(error.message);
    }
};

exports.updateMaterial = async(id, updateData) => {
    try {
        const material = await prisma.material.update({
            where: { id },      
            data: updateData,     
        });
        return material;  
    } catch (error) {
        throw new Error(error.message);  
    }
}

exports.deleteMaterial = async(id) => {
    try {
        await prisma.material.delete({
            where: { id },
        });
        return `Successfully deleted material with id: ${id}`;
    } catch (error) {
        throw new Error('Error deleting material: ' + error.message); 
    }
}