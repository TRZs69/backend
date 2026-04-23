const express = require('express');
const userChapterController = require('../controllers/UserChapterController');

const router = express.Router();

router.get('/userchapter', userChapterController.getAllUserChapters);

router.get('/userchapter/:id', userChapterController.getUserChapterById);

router.post('/userchapter', userChapterController.createUserChapter);

router.put('/userchapter/:id', userChapterController.updateUserChapter);

router.delete('/userchapter/:id', userChapterController.deleteUserChapter);


router.get('/userchapter/:userId/:chapterId', userChapterController.getUserChapterByUserByChapter);

router.put('/userchapter/:userId/:chapterId', userChapterController.updateUserChapterByUserByChapter);


module.exports = router;
