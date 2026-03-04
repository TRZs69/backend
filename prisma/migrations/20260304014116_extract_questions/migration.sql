/*
  Warnings:

  - You are about to drop the column `answers` on the `assessments` table. All the data in the column will be lost.
  - You are about to drop the column `questions` on the `assessments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `assessments` DROP COLUMN `answers`,
    DROP COLUMN `questions`;

-- AlterTable
ALTER TABLE `user_chapters` ADD COLUMN `assessmentEloDelta` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `users` MODIFY `points` INTEGER NULL DEFAULT 750;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assessmentId` INTEGER NOT NULL,
    `question` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `options` JSON NULL,
    `answer` TEXT NULL,
    `correctedAnswer` TEXT NULL,
    `elo` INTEGER NOT NULL DEFAULT 1200,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `questions_assessmentId_idx`(`assessmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `assessments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
