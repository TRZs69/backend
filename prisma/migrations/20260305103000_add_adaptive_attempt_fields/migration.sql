-- AlterTable
ALTER TABLE `assessment_attempts`
    ADD COLUMN `poolSize` INTEGER NOT NULL DEFAULT 12,
    ADD COLUMN `objectiveTarget` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `totalTarget` INTEGER NOT NULL DEFAULT 6,
    ADD COLUMN `currentUserElo` INTEGER NOT NULL DEFAULT 750,
    ADD COLUMN `rawEloDelta` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `objectiveAnswered` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `objectiveCorrect` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `assessment_attempt_questions`
    ADD COLUMN `servedOrder` INTEGER NULL,
    ADD COLUMN `answeredAt` DATETIME(3) NULL,
    ADD COLUMN `userEloDeltaRaw` DOUBLE NULL,
    ADD COLUMN `questionEloDeltaRaw` DOUBLE NULL;

-- CreateIndex
CREATE INDEX `assessment_attempt_questions_attemptId_servedOrder_idx` ON `assessment_attempt_questions`(`attemptId`, `servedOrder`);

-- CreateIndex
CREATE INDEX `assessment_attempt_questions_attemptId_answeredAt_idx` ON `assessment_attempt_questions`(`attemptId`, `answeredAt`);
