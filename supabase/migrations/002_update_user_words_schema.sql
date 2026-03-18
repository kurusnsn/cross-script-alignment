-- Migration to update user_words table according to plan.md
-- This updates the existing schema to match the new requirements

-- First, let's add the new columns to the existing table
ALTER TABLE user_words
ADD COLUMN IF NOT EXISTS original TEXT,
ADD COLUMN IF NOT EXISTS aligneration TEXT,
ADD COLUMN IF NOT EXISTS folder TEXT;

-- Migrate existing data: copy 'word' column to new 'original' column
UPDATE user_words
SET original = word
WHERE original IS NULL;

-- Make 'original' NOT NULL after data migration
ALTER TABLE user_words
ALTER COLUMN original SET NOT NULL;

-- Add index for folder searches
CREATE INDEX IF NOT EXISTS idx_user_words_folder ON user_words(user_id, folder);

-- Update the sync function to work with new schema
CREATE OR REPLACE FUNCTION sync_starred_words_to_user_words(p_user_id TEXT)
RETURNS INT AS $$
DECLARE
    inserted_count INT := 0;
BEGIN
    -- Insert starred words that don't already exist in user_words
    INSERT INTO user_words (user_id, original, word, translation, language_code)
    SELECT
        p_user_id,
        tw.original_word,
        tw.original_word,  -- Keep backward compatibility
        tw.translated_word,
        t.source_language
    FROM translation_words tw
    JOIN translations t ON tw.translation_id = t.id
    WHERE t.user_id = p_user_id::INTEGER
    AND tw.is_starred = true
    AND NOT EXISTS (
        SELECT 1 FROM user_words uw
        WHERE uw.user_id = p_user_id
        AND uw.original = tw.original_word
        AND uw.translation = tw.translated_word
        AND uw.language_code = t.source_language
    );

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- Update existing sample data to have 'original' field populated
UPDATE user_words
SET original = word
WHERE original IS NULL;

-- Note: We keep the 'word' column for backward compatibility
-- In the future, we can drop it after updating all application code