-- Migration: Create translations table
-- Created: 2025-01-20

CREATE TABLE IF NOT EXISTS translations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    original_text TEXT NOT NULL,
    aligneration TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    embedding VECTOR(768), -- Vector embeddings for similarity search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_translations_user_id ON translations(user_id);
CREATE INDEX IF NOT EXISTS idx_translations_created_at ON translations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_translations_languages ON translations(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translations_is_favorite ON translations(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS idx_translations_user_created ON translations(user_id, created_at DESC);

-- Add vector similarity search index for embeddings
CREATE INDEX IF NOT EXISTS idx_translations_embedding ON translations USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add trigger to update updated_at automatically
CREATE TRIGGER update_translations_updated_at
    BEFORE UPDATE ON translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();