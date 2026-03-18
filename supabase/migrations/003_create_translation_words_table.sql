-- Migration: Create translation_words table
-- Created: 2025-01-20

CREATE TABLE IF NOT EXISTS translation_words (
    id SERIAL PRIMARY KEY,
    translation_id INTEGER NOT NULL REFERENCES translations(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    original_word VARCHAR(255) NOT NULL,
    align_word VARCHAR(255) NOT NULL,
    translated_word VARCHAR(255) NOT NULL,
    is_starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique position per translation
    UNIQUE(translation_id, position)
);

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_translation_words_translation_id ON translation_words(translation_id);
CREATE INDEX IF NOT EXISTS idx_translation_words_position ON translation_words(translation_id, position);
CREATE INDEX IF NOT EXISTS idx_translation_words_is_starred ON translation_words(is_starred) WHERE is_starred = TRUE;
CREATE INDEX IF NOT EXISTS idx_translation_words_starred_user ON translation_words(is_starred, translation_id) WHERE is_starred = TRUE;

-- Add trigger to update updated_at automatically
CREATE TRIGGER update_translation_words_updated_at
    BEFORE UPDATE ON translation_words
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();