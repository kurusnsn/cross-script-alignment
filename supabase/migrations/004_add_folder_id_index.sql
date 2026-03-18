-- Speed up history queries filtered by folder
CREATE INDEX IF NOT EXISTS idx_translations_folder_id ON translations(folder_id);
CREATE INDEX IF NOT EXISTS idx_translations_user_folder ON translations(user_id, folder_id, created_at DESC);
