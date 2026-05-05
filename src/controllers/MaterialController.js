const materialService = require('../services/MaterialService');
const supabase = require('../../supabase/supabase');
const fs = require('fs');

const MATERIAL_IMAGE_FOLDER = 'editor-images';

const getAllMaterials = async (_, res) => {
    try {
        const materials = await materialService.getAllMaterials();
        res.status(200).json(materials);
        console.log(`getAllMaterials successfully requested`);
    } catch (error) {
        res.status(500).json({ message: "Failed to get materials", detail: error.message });
        console.log(error.mesage);
    }
};

const getMaterialById = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid material ID" });
    }

    try {
        const material = await materialService.getMaterialById(id);
        if (!material) {
            return res.status(404).json({ message: `Material with id ${id} not found` });
        }
        res.status(200).json(material);
    } catch (error) {
        res.status(500).json({ message: `Failed to get material with id ${id}` })
        console.log(error.message);

    }
}

const createMaterial = async (req, res) => {
    try {
        const newData = req.body;

        const material = await materialService.createMaterial(newData);
        res.status(201).json({ message: `Successfully create new material ${newData.name}`, material: material });
    } catch (error) {
        res.status(500).json({ message: "Failed to create new material", data: error.message });
        console.log(error.message);

    }
};

const updateMaterial = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid material ID" });
    }
    const updateData = req.body;

    try {
        const material = await materialService.updateMaterial(id, updateData);
        if (!material) {
            return res.status(404).json({ message: `Material with id ${id} not found` });
        }
        res.status(200).json({ message: "Successfully updated material", material: material });
    } catch (error) {
        res.status(500).json({ message: "Failed to update material", detail: error.message });
        console.log(error.message);
    }
};

const deleteMaterial = async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid material ID" });
    }

    try {
        const result = await materialService.deleteMaterial(id);
        if (!result) {
            return res.status(404).json({ message: `Material with id ${id} not found` });
        }
        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete material' });
        console.log(error.message);
    }
};

const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const file = req.file;
        const storagePath = `${MATERIAL_IMAGE_FOLDER}/${file.filename}`;
        const bytes = fs.readFileSync(file.path);

        const { error: upErr } = await supabase.storage.from('materials').upload(storagePath, bytes, {
            contentType: file.mimetype,
            upsert: true,
        });

        try {
            fs.unlinkSync(file.path);
        } catch (e) {
            console.error("Failed to delete temp file:", e);
        }

        if (upErr) {
            throw upErr;
        }

        const { data: publicUrlData } = supabase.storage
            .from('materials')
            .getPublicUrl(storagePath);

        res.status(200).json({
            link: publicUrlData.publicUrl,
            path: storagePath,
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to upload image', detail: error.message });
        console.log(error.message);
    }
};

const getMaterialImage = async (req, res) => {
    try {
        const encodedPath = req.params.path || req.params[0];
        if (!encodedPath) {
            return res.status(400).json({ message: 'Missing image path' });
        }

        let storagePath;
        try {
            storagePath = decodeURIComponent(encodedPath);
        } catch (error) {
            return res.status(400).json({ message: 'Invalid image path format' });
        }

        const { data, error } = await supabase.storage.from('materials').download(storagePath);

        if (error || !data) {
            return res.status(404).json({ message: 'Image not found' });
        }

        const mimeType = data.type || 'application/octet-stream';
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(buffer);
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve image', detail: error.message });
    }
};

module.exports = {
    getAllMaterials,
    getMaterialById,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    uploadImage,
    getMaterialImage,
};
