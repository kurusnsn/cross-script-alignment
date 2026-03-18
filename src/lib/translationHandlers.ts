import {
  query,
  queryOne,
  transaction,
  WordBreakdown,
  TranslationWithWords,
  StarredWordWithTranslation,
  HistoryFolder,
  Translation,
  TranslationWord
} from './database';

export type {
  WordBreakdown,
  TranslationWithWords,
  StarredWordWithTranslation,
  HistoryFolder,
  Translation,
  TranslationWord
};

// Store a new translation with word breakdown
export async function storeTranslation(
  userId: number,
  sourceLang: string,
  targetLang: string,
  originalText: string,
  aligneration: string,
  translatedText: string,
  wordBreakdown: WordBreakdown[],
  embedding?: number[],
  folderId?: number
): Promise<number> {
  return await transaction(async (client) => {
    // Insert the main translation record
    const translationResult = await client.query(
      `INSERT INTO translations
       (user_id, folder_id, source_language, target_language, original_text, aligneration, translated_text, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId, folderId, sourceLang, targetLang, originalText, aligneration, translatedText, embedding ? JSON.stringify(embedding) : null]
    );

    const translationId = translationResult.rows[0].id;

    // Insert word breakdown if provided
    if (wordBreakdown && wordBreakdown.length > 0) {
      const wordValues = wordBreakdown.map((word, index) =>
        `($1, $${index * 4 + 2}, $${index * 4 + 3}, $${index * 4 + 4}, $${index * 4 + 5})`
      ).join(', ');

      const wordParams = [translationId];
      wordBreakdown.forEach(word => {
        wordParams.push(word.position, word.original_word, word.align_word, word.translated_word);
      });

      await client.query(
        `INSERT INTO translation_words
         (translation_id, position, original_word, align_word, translated_word)
         VALUES ${wordValues}`,
        wordParams
      );
    }

    return translationId;
  });
}

// Get user's translation history with optional filters
export interface HistoryFilters {
  sourceLang?: string;
  targetLang?: string;
  favoritesOnly?: boolean;
  folderId?: number | null;
  limit?: number;
  offset?: number;
  fromDate?: string;
  toDate?: string;
}

export async function getUserHistory(
  userId: number,
  filters: HistoryFilters = {}
): Promise<{ translations: TranslationWithWords[], total: number }> {
  const conditions = ['t.user_id = $1'];
  const params: any[] = [userId];
  let paramIndex = 2;

  // Build WHERE conditions based on filters
  if (filters.sourceLang) {
    conditions.push(`t.source_language = $${paramIndex}`);
    params.push(filters.sourceLang);
    paramIndex++;
  }

  if (filters.targetLang) {
    conditions.push(`t.target_language = $${paramIndex}`);
    params.push(filters.targetLang);
    paramIndex++;
  }

  if (filters.favoritesOnly) {
    conditions.push('t.is_favorite = TRUE');
  }

  if (filters.folderId !== undefined) {
    if (filters.folderId === null) {
      conditions.push('t.folder_id IS NULL');
    } else {
      conditions.push(`t.folder_id = $${paramIndex}`);
      params.push(filters.folderId);
      paramIndex++;
    }
  }

  if (filters.fromDate) {
    conditions.push(`t.created_at >= $${paramIndex}`);
    params.push(filters.fromDate);
    paramIndex++;
  }

  if (filters.toDate) {
    conditions.push(`t.created_at <= $${paramIndex}`);
    params.push(filters.toDate);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  // Single query: COUNT(*) OVER() avoids a second round-trip to the DB
  const translationsQuery = `
    SELECT
      t.*,
      COUNT(*) OVER() AS total_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', tw.id,
            'translation_id', tw.translation_id,
            'position', tw.position,
            'original_word', tw.original_word,
            'align_word', tw.align_word,
            'translated_word', tw.translated_word,
            'is_starred', tw.is_starred,
            'created_at', tw.created_at,
            'updated_at', tw.updated_at
          ) ORDER BY tw.position
        ) FILTER (WHERE tw.id IS NOT NULL),
        '[]'::json
      ) as words
    FROM translations t
    LEFT JOIN translation_words tw ON t.id = tw.translation_id
    WHERE ${whereClause}
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const rows = await query<TranslationWithWords & { total_count: string }>(translationsQuery, params);
  const total = rows.length > 0 ? parseInt(rows[0].total_count) : 0;
  // Strip total_count from each row
  const translations = rows.map(({ total_count, ...rest }) => rest as TranslationWithWords);

  return { translations, total };
}

// Toggle favorite status for a translation
export async function toggleFavoriteTranslation(translationId: number): Promise<boolean> {
  const result = await query<{ is_favorite: boolean }>(
    `UPDATE translations
     SET is_favorite = NOT is_favorite
     WHERE id = $1
     RETURNING is_favorite`,
    [translationId]
  );

  if (result.length === 0) {
    throw new Error('Translation not found');
  }

  return result[0].is_favorite;
}

// Toggle starred status for a word
export async function toggleStarWord(wordId: number): Promise<boolean> {
  const result = await query<{ is_starred: boolean }>(
    `UPDATE translation_words
     SET is_starred = NOT is_starred
     WHERE id = $1
     RETURNING is_starred`,
    [wordId]
  );

  if (result.length === 0) {
    throw new Error('Word not found');
  }

  return result[0].is_starred;
}

// Get starred words for a user with translation context
export async function getStarredWords(userId: number): Promise<StarredWordWithTranslation[]> {
  const starredWords = await query<StarredWordWithTranslation>(
    `SELECT
      tw.*,
      json_build_object(
        'id', t.id,
        'source_language', t.source_language,
        'target_language', t.target_language,
        'original_text', t.original_text,
        'created_at', t.created_at
      ) as translation
    FROM translation_words tw
    JOIN translations t ON tw.translation_id = t.id
    WHERE t.user_id = $1 AND tw.is_starred = TRUE
    ORDER BY tw.created_at DESC`,
    [userId]
  );

  return starredWords;
}

// Get a single translation with words by ID
export async function getTranslationById(
  translationId: number,
  userId?: number
): Promise<TranslationWithWords | null> {
  const conditions = ['t.id = $1'];
  const params = [translationId];

  if (userId) {
    conditions.push('t.user_id = $2');
    params.push(userId);
  }

  const whereClause = conditions.join(' AND ');

  const result = await query<TranslationWithWords>(
    `SELECT
      t.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', tw.id,
            'translation_id', tw.translation_id,
            'position', tw.position,
            'original_word', tw.original_word,
            'align_word', tw.align_word,
            'translated_word', tw.translated_word,
            'is_starred', tw.is_starred,
            'created_at', tw.created_at,
            'updated_at', tw.updated_at
          ) ORDER BY tw.position
        ) FILTER (WHERE tw.id IS NOT NULL),
        '[]'::json
      ) as words
    FROM translations t
    LEFT JOIN translation_words tw ON t.id = tw.translation_id
    WHERE ${whereClause}
    GROUP BY t.id`,
    params
  );

  return result.length > 0 ? result[0] : null;
}

// Delete a translation (cascade will handle words)
export async function deleteTranslation(translationId: number, userId: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM translations WHERE id = $1 AND user_id = $2`,
    [translationId, userId]
  );

  return result.length > 0;
}

// Search translations using vector similarity
export async function searchTranslations(
  userId: number,
  queryEmbedding: number[],
  limit: number = 10
): Promise<TranslationWithWords[]> {
  const similarityQuery = `
    SELECT
      t.*,
      (t.embedding <-> $2::vector) as distance,
      COALESCE(
        json_agg(
          json_build_object(
            'id', tw.id,
            'translation_id', tw.translation_id,
            'position', tw.position,
            'original_word', tw.original_word,
            'align_word', tw.align_word,
            'translated_word', tw.translated_word,
            'is_starred', tw.is_starred,
            'created_at', tw.created_at,
            'updated_at', tw.updated_at
          ) ORDER BY tw.position
        ) FILTER (WHERE tw.id IS NOT NULL),
        '[]'::json
      ) as words
    FROM translations t
    LEFT JOIN translation_words tw ON t.id = tw.translation_id
    WHERE t.user_id = $1 AND t.embedding IS NOT NULL
    GROUP BY t.id, t.embedding
    ORDER BY t.embedding <-> $2::vector
    LIMIT $3
  `;

  const results = await query<TranslationWithWords>(
    similarityQuery,
    [userId, JSON.stringify(queryEmbedding), limit]
  );

  return results;
}

// FOLDER MANAGEMENT FUNCTIONS

// Get all folders for a user
export async function getUserFolders(userId: number): Promise<HistoryFolder[]> {
  const folders = await query<HistoryFolder>(
    `SELECT * FROM history_folders
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );

  return folders;
}

// Create a new folder
export async function createFolder(userId: number, name: string): Promise<HistoryFolder> {
  const result = await query<HistoryFolder>(
    `INSERT INTO history_folders (user_id, name)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, name]
  );

  if (result.length === 0) {
    throw new Error('Failed to create folder');
  }

  return result[0];
}

// Update folder name
export async function updateFolder(folderId: number, userId: number, name: string): Promise<HistoryFolder> {
  const result = await query<HistoryFolder>(
    `UPDATE history_folders
     SET name = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [folderId, userId, name]
  );

  if (result.length === 0) {
    throw new Error('Folder not found or access denied');
  }

  return result[0];
}

// Delete a folder (moves all translations to root)
export async function deleteFolder(folderId: number, userId: number): Promise<boolean> {
  return await transaction(async (client) => {
    // First, move all translations in this folder to root (folder_id = NULL)
    await client.query(
      `UPDATE translations
       SET folder_id = NULL
       WHERE folder_id = $1 AND user_id = $2`,
      [folderId, userId]
    );

    // Then delete the folder
    const result = await client.query(
      `DELETE FROM history_folders
       WHERE id = $1 AND user_id = $2`,
      [folderId, userId]
    );

    return (result.rowCount ?? 0) > 0;
  });
}

// Move translation to folder
export async function moveTranslationToFolder(
  translationId: number,
  userId: number,
  folderId: number | null
): Promise<boolean> {
  const result = await query(
    `UPDATE translations
     SET folder_id = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2`,
    [translationId, userId, folderId]
  );

  return result.length > 0;
}

// Star a translation and atomically move it to a folder (creates folder if newFolderName provided)
export async function starTranslationToFolder(
  translationId: number,
  userId: number,
  folderId: number | null,
  newFolderName?: string
): Promise<{ isFavorite: boolean; folderId: number | null; folder?: HistoryFolder }> {
  return await transaction(async (client) => {
    let targetFolderId = folderId
    let newFolder: HistoryFolder | undefined

    // Create new folder if a name was provided
    if (newFolderName) {
      const folderResult = await client.query(
        `INSERT INTO history_folders (user_id, name)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, newFolderName]
      )
      newFolder = folderResult.rows[0] as HistoryFolder
      targetFolderId = newFolder.id
    }

    // Star the translation and move it to the chosen folder
    const result = await client.query(
      `UPDATE translations
       SET is_favorite = TRUE, folder_id = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING is_favorite`,
      [translationId, userId, targetFolderId]
    )

    if ((result.rowCount ?? 0) === 0) {
      throw new Error('Translation not found')
    }

    return {
      isFavorite: result.rows[0].is_favorite as boolean,
      folderId: targetFolderId,
      folder: newFolder,
    }
  })
}

// Search translations with text search (for live search suggestions)
export async function searchTranslationsText(
  userId: number,
  searchQuery: string,
  limit: number = 10
): Promise<TranslationWithWords[]> {
  const searchPattern = `%${searchQuery.toLowerCase()}%`;

  const searchSql = `
    SELECT
      t.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', tw.id,
            'translation_id', tw.translation_id,
            'position', tw.position,
            'original_word', tw.original_word,
            'align_word', tw.align_word,
            'translated_word', tw.translated_word,
            'is_starred', tw.is_starred,
            'created_at', tw.created_at,
            'updated_at', tw.updated_at
          ) ORDER BY tw.position
        ) FILTER (WHERE tw.id IS NOT NULL),
        '[]'::json
      ) as words
    FROM translations t
    LEFT JOIN translation_words tw ON t.id = tw.translation_id
    WHERE t.user_id = $1 AND (
      LOWER(t.original_text) LIKE $2 OR
      LOWER(t.aligneration) LIKE $2 OR
      LOWER(t.translated_text) LIKE $2
    )
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT $3
  `;

  const results = await query<TranslationWithWords>(
    searchSql,
    [userId, searchPattern, limit]
  );

  return results;
}