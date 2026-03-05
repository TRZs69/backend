-- CreateTable
CREATE TABLE `assessment_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `chapterId` INTEGER NOT NULL,
    `assessmentId` INTEGER NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
    `source` ENUM('GENERATED', 'FALLBACK_BANK') NOT NULL DEFAULT 'GENERATED',
    `instruction` TEXT NOT NULL,
    `grade` INTEGER NULL,
    `pointsEarned` INTEGER NULL,
    `correctAnswers` INTEGER NULL,
    `totalQuestions` INTEGER NULL,
    `newDifficulty` ENUM('EASY', 'MEDIUM', 'HARD') NULL,
    `aiFeedback` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_attempts_userId_idx`(`userId`),
    INDEX `assessment_attempts_chapterId_idx`(`chapterId`),
    INDEX `assessment_attempts_assessmentId_idx`(`assessmentId`),
    INDEX `assessment_attempts_status_idx`(`status`),
    INDEX `assessment_attempts_userId_chapterId_status_idx`(`userId`, `chapterId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assessment_attempt_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `sourceQuestionId` INTEGER NULL,
    `question` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `options` JSON NULL,
    `answer` TEXT NULL,
    `correctedAnswer` TEXT NULL,
    `elo` INTEGER NOT NULL DEFAULT 1200,
    `order` INTEGER NOT NULL,
    `submittedAnswer` TEXT NULL,
    `isCorrect` BOOLEAN NULL,
    `score` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assessment_attempt_questions_attemptId_idx`(`attemptId`),
    INDEX `assessment_attempt_questions_sourceQuestionId_idx`(`sourceQuestionId`),
    INDEX `assessment_attempt_questions_attemptId_order_idx`(`attemptId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `chapters`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempts` ADD CONSTRAINT `assessment_attempts_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempt_questions` ADD CONSTRAINT `assessment_attempt_questions_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `assessment_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assessment_attempt_questions` ADD CONSTRAINT `assessment_attempt_questions_sourceQuestionId_fkey` FOREIGN KEY (`sourceQuestionId`) REFERENCES `questions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
