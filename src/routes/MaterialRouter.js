const express = require('express');
const materialController = require('../controllers/MaterialController');
const { uploadImage } = require('../middlewares/FileUpload');
const cacheMiddleware = require('../middlewares/cacheMiddleware');

const router = express.Router();

router.get('/material', materialController.getAllMaterials);

router.get('/material/image/*', materialController.getMaterialImage);

router.get('/material/:id', materialController.getMaterialById);

router.post('/material', materialController.createMaterial);

router.post('/material/upload-image', uploadImage, materialController.uploadImage);

router.put('/material/:id', materialController.updateMaterial);

router.delete('/material/:id', materialController.deleteMaterial);

module.exports = router;
