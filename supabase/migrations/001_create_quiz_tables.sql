-- Migration to create quiz system tables
-- Run this against your PostgreSQL database

-- Create user_words table
CREATE TABLE IF NOT EXISTS user_words (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    language_code TEXT NOT NULL,
    audio_url TEXT,
    added_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_words_user_id ON user_words(user_id);
CREATE INDEX IF NOT EXISTS idx_user_words_language ON user_words(language_code);
CREATE INDEX IF NOT EXISTS idx_user_words_user_lang ON user_words(user_id, language_code);

-- Create quiz_results table
CREATE TABLE IF NOT EXISTS quiz_results (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    word_id INT REFERENCES user_words(id) ON DELETE CASCADE,
    correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_results_user_id ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_word_id ON quiz_results(word_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_answered_at ON quiz_results(answered_at);

-- Add some sample data for testing (using user_id = '1' to match frontend)
-- Note: In production, this would come from actual starred words

INSERT INTO user_words (user_id, word, translation, language_code) VALUES
('1', '犬', 'dog', 'ja'),
('1', '猫', 'cat', 'ja'),
('1', '家', 'house', 'ja'),
('1', '水', 'water', 'ja'),
('1', 'こんにちは', 'hello', 'ja'),
('1', 'Здравствуйте', 'hello', 'ru'),
('1', 'собака', 'dog', 'ru'),
('1', 'кот', 'cat', 'ru'),
('1', 'дом', 'house', 'ru'),
('1', 'вода', 'water', 'ru'),
('1', 'مرحبا', 'hello', 'ar'),
('1', 'كلب', 'dog', 'ar'),
('1', 'قطة', 'cat', 'ar'),
('1', 'بيت', 'house', 'ar'),
('1', 'ماء', 'water', 'ar')
ON CONFLICT DO NOTHING;

-- Create a function to sync starred words to user_words
-- This would be called from the application code
CREATE OR REPLACE FUNCTION sync_starred_words_to_user_words(p_user_id TEXT)
RETURNS INT AS $$
DECLARE
    inserted_count INT := 0;
BEGIN
    -- Insert starred words that don't already exist in user_words
    INSERT INTO user_words (user_id, word, translation, language_code)
    SELECT
        p_user_id,
        tw.original_word,
        tw.translated_word,
        t.source_language
    FROM translation_words tw
    JOIN translations t ON tw.translation_id = t.id
    WHERE t.user_id = p_user_id::INTEGER
    AND tw.is_starred = true
    AND NOT EXISTS (
        SELECT 1 FROM user_words uw
        WHERE uw.user_id = p_user_id
        AND uw.word = tw.original_word
        AND uw.translation = tw.translated_word
        AND uw.language_code = t.source_language
    );

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;