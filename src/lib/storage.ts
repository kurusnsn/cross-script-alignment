import { Pool } from 'pg';

// Assume a Pool instance is created and configured elsewhere,
// for example, in a separate configuration file.
// For this example, we'll create it here.
const pool = new Pool({
  // Your PostgreSQL connection details go here
  // e.g., user, host, database, password, port
  // It's recommended to use environment variables for these.
  connectionString: process.env.POSTGRES_URL,
});

interface WordBreakdown {
  position: number;
  original_word: string;
  align_word: string;
  translated_word: string;
}

export async function storeTranslation(
  userId: number,
  sourceLang: string,
  targetLang: string,
  originalText: string,
  aligneration: string,
  translatedText: string,
  wordBreakdown: WordBreakdown[]
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertTranslationQuery = `
      INSERT INTO translations (user_id, source_language, target_language, original_text, aligneration, translated_text)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const translationResult = await client.query(insertTranslationQuery, [
      userId,
      sourceLang,
      targetLang,
      originalText,
      aligneration,
      translatedText,
    ]);
    const translationId = translationResult.rows[0].id;

    const insertWordsQuery = `
      INSERT INTO translation_words (translation_id, position, original_word, align_word, translated_word)
      VALUES ($1, $2, $3, $4, $5);
    `;
    for (const word of wordBreakdown) {
      await client.query(insertWordsQuery, [
        translationId,
        word.position,
        word.original_word,
        word.align_word,
        word.translated_word,
      ]);
    }

    await client.query('COMMIT');
    return { success: true, translationId };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error storing translation:', error);
    throw error;
  } finally {
    client.release();
  }
}

interface HistoryFilters {
  language?: string;
  isFavorite?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export async function getUserHistory(userId: number, filters: HistoryFilters = {}) {
  const client = await pool.connect();
  try {
    let query = 'SELECT * FROM translations WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filters.language) {
      query += ` AND (source_language = $${paramIndex} OR target_language = $${paramIndex})`;
      params.push(filters.language);
      paramIndex++;
    }

    if (filters.isFavorite !== undefined) {
      query += ` AND is_favorite = $${paramIndex}`;
      params.push(filters.isFavorite);
      paramIndex++;
    }

    if (filters.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC;';

    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user history:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleFavoriteTranslation(translationId: number) {
  const client = await pool.connect();
  try {
    const query = `
      UPDATE translations
      SET is_favorite = NOT is_favorite
      WHERE id = $1
      RETURNING id, is_favorite;
    `;
    const result = await client.query(query, [translationId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleStarWord(wordId: number) {
  const client = await pool.connect();
  try {
    const query = `
      UPDATE translation_words
      SET is_starred = NOT is_starred
      WHERE id = $1
      RETURNING id, is_starred;
    `;
    const result = await client.query(query, [wordId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error toggling word star:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getStarredWords(userId: number) {
  const client = await pool.connect();
  try {
    const query = `
      SELECT
        w.id as word_id,
        w.original_word,
        w.align_word,
        w.translated_word,
        w.is_starred,
        t.id as translation_id,
        t.original_text,
        t.source_language,
        t.target_language,
        t.created_at
      FROM translation_words w
      JOIN translations t ON w.translation_id = t.id
      WHERE t.user_id = $1 AND w.is_starred = TRUE
      ORDER BY t.created_at DESC, w.position ASC;
    `;
    const result = await client.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching starred words:', error);
    throw error;
  } finally {
    client.release();
  }
}
