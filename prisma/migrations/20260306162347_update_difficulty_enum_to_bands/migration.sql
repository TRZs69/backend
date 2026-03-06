/*
  Migration: update_difficulty_enum_to_bands

  Replaces the Difficulty enum (EASY, MEDIUM, HARD) with ELO band titles
  (BEGINNER, BASIC_UNDERSTANDING, DEVELOPING_LEARNER, INTERMEDIATE,
   PROFICIENT, ADVANCED, MASTERY).

  Existing data is migrated:
    EASY   -> BEGINNER
    MEDIUM -> INTERMEDIATE
    HARD   -> ADVANCED
*/

-- Step 1: Widen the enum on assessment_attempts to include both old and new values
ALTER TABLE `assessment_attempts`
  MODIFY `newDifficulty` ENUM('EASY', 'MEDIUM', 'HARD', 'BEGINNER', 'BASIC_UNDERSTANDING', 'DEVELOPING_LEARNER', 'INTERMEDIATE', 'PROFICIENT', 'ADVANCED', 'MASTERY') NULL;

-- Step 2: Migrate existing data in assessment_attempts
UPDATE `assessment_attempts` SET `newDifficulty` = 'BEGINNER' WHERE `newDifficulty` = 'EASY';
UPDATE `assessment_attempts` SET `newDifficulty` = 'INTERMEDIATE' WHERE `newDifficulty` = 'MEDIUM';
UPDATE `assessment_attempts` SET `newDifficulty` = 'ADVANCED' WHERE `newDifficulty` = 'HARD';

-- Step 3: Narrow enum to only new values
ALTER TABLE `assessment_attempts`
  MODIFY `newDifficulty` ENUM('BEGINNER', 'BASIC_UNDERSTANDING', 'DEVELOPING_LEARNER', 'INTERMEDIATE', 'PROFICIENT', 'ADVANCED', 'MASTERY') NULL;

-- Step 4: Widen the enum on user_chapters to include both old and new values
ALTER TABLE `user_chapters`
  MODIFY `currentDifficulty` ENUM('EASY', 'MEDIUM', 'HARD', 'BEGINNER', 'BASIC_UNDERSTANDING', 'DEVELOPING_LEARNER', 'INTERMEDIATE', 'PROFICIENT', 'ADVANCED', 'MASTERY') NOT NULL DEFAULT 'EASY';

-- Step 5: Migrate existing data in user_chapters
UPDATE `user_chapters` SET `currentDifficulty` = 'BEGINNER' WHERE `currentDifficulty` = 'EASY';
UPDATE `user_chapters` SET `currentDifficulty` = 'INTERMEDIATE' WHERE `currentDifficulty` = 'MEDIUM';
UPDATE `user_chapters` SET `currentDifficulty` = 'ADVANCED' WHERE `currentDifficulty` = 'HARD';

-- Step 6: Narrow enum to only new values with new default
ALTER TABLE `user_chapters`
  MODIFY `currentDifficulty` ENUM('BEGINNER', 'BASIC_UNDERSTANDING', 'DEVELOPING_LEARNER', 'INTERMEDIATE', 'PROFICIENT', 'ADVANCED', 'MASTERY') NOT NULL DEFAULT 'BEGINNER';
