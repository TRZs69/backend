-- AlterTable
ALTER TABLE `user_courses`
    ADD COLUMN `elo` INTEGER NOT NULL DEFAULT 750;

-- AlterTable
ALTER TABLE `user_chapters`
    ADD COLUMN `assessmentPointsEarned` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `assessment_attempts`
    ADD COLUMN `courseEloStart` INTEGER NOT NULL DEFAULT 750,
    ADD COLUMN `courseEloEnd` INTEGER NOT NULL DEFAULT 750;
