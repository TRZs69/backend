const express = require('express');
// @ts-ignore
const materialController = require('../controllers/MaterialController');
const { uploadImage } = require('../middlewares/FileUpload');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

// Route for get all materials
router.get('/material', cacheMiddleware(300), materialController.getAllMaterials);

// Route for get material by id
router.get('/material/:id', cacheMiddleware(300), materialController.getMaterialById);

// Router for create material
router.post('/material', materialController.createMaterial);

// Router for uploading image from Froala Editor
router.post('/material/upload-image', uploadImage, materialController.uploadImage);

// Router for update material by id
router.put('/material/:id', materialController.updateMaterial);

// Router for delete material by id
router.delete('/material/:id', materialController.deleteMaterial);

module.exports = router;
