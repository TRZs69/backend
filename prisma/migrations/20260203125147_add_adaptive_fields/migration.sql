-- AlterTable
ALTER TABLE `user_chapters` ADD COLUMN `correctStreak` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `currentDifficulty` ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL DEFAULT 'EASY',
    ADD COLUMN `lastAiFeedback` TEXT NULL,
    ADD COLUMN `wrongStreak` INTEGER NOT NULL DEFAULT 0;
