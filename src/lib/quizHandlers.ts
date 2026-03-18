import {
  query,
  queryOne,
  transaction,
  UserWord,
  QuizResult
} from './database';

// Get user words for quiz generation
export async function getUserWords(userId: string, languageCode?: string, folder?: string): Promise<UserWord[]> {
  let sql = 'SELECT * FROM user_words WHERE user_id = $1';
  const params: any[] = [userId];

  if (languageCode) {
    params.push(languageCode);
    sql += ` AND language_code = $${params.length}`;
  }

  if (folder) {
    params.push(folder);
    sql += ` AND folder = $${params.length}`;
  }

  sql += ' ORDER BY added_at DESC';

  return await query<UserWord>(sql, params);
}

// Get count of user words for quiz eligibility
export async function getUserWordCount(userId: string, languageCode?: string, folder?: string): Promise<number> {
  let sql = 'SELECT COUNT(*) as count FROM user_words WHERE user_id = $1';
  const params: any[] = [userId];

  if (languageCode) {
    params.push(languageCode);
    sql += ` AND language_code = $${params.length}`;
  }

  if (folder) {
    params.push(folder);
    sql += ` AND folder = $${params.length}`;
  }

  const result = await queryOne<{ count: string }>(sql, params);
  return parseInt(result?.count || '0');
}

// Add a word to user's vocabulary
export async function addUserWord(
  userId: string,
  original: string,
  translation: string,
  languageCode: string,
  aligneration?: string,
  audioUrl?: string,
  folder?: string
): Promise<UserWord> {
  const result = await query<UserWord>(
    `INSERT INTO user_words (user_id, original, word, translation, language_code, aligneration, audio_url, folder)
     VALUES ($1, $2, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, original, translation, languageCode, aligneration, audioUrl, folder]
  );

  if (result.length === 0) {
    throw new Error('Failed to add user word');
  }

  return result[0];
}

// Get a random word for quiz
export async function getRandomQuizWord(userId: string, languageCode?: string, folder?: string): Promise<UserWord | null> {
  let sql = `SELECT * FROM user_words WHERE user_id = $1`;
  const params: any[] = [userId];

  if (languageCode) {
    params.push(languageCode);
    sql += ` AND language_code = $${params.length}`;
  }

  if (folder) {
    params.push(folder);
    sql += ` AND folder = $${params.length}`;
  }

  sql += ' ORDER BY RANDOM() LIMIT 1';

  return await queryOne<UserWord>(sql, params);
}

// Get distractor words (wrong answers) for MCQ
export async function getDistractorWords(
  userId: string,
  excludeWordId: number,
  languageCode: string,
  folder?: string,
  limit: number = 3
): Promise<UserWord[]> {
  let sql = `SELECT * FROM user_words
     WHERE user_id = $1 AND id != $2 AND language_code = $3`;
  const params: any[] = [userId, excludeWordId, languageCode];

  if (folder) {
    params.push(folder);
    sql += ` AND folder = $${params.length}`;
  }

  params.push(limit);
  sql += ` ORDER BY RANDOM() LIMIT $${params.length}`;

  return await query<UserWord>(sql, params);
}

// Record quiz answer
export async function recordQuizAnswer(
  userId: string,
  wordId: number,
  correct: boolean
): Promise<QuizResult> {
  const result = await query<QuizResult>(
    `INSERT INTO quiz_results (user_id, word_id, correct)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, wordId, correct]
  );

  if (result.length === 0) {
    throw new Error('Failed to record quiz answer');
  }

  return result[0];
}

// Get quiz statistics for a user
export async function getQuizStats(userId: string): Promise<{
  total: number;
  correct: number;
  accuracy: number;
  recentCorrect: number;
  recentTotal: number;
}> {
  const totalStats = await queryOne<{ total: string; correct: string }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct
     FROM quiz_results
     WHERE user_id = $1`,
    [userId]
  );

  const recentStats = await queryOne<{ total: string; correct: string }>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct
     FROM quiz_results
     WHERE user_id = $1 AND answered_at >= NOW() - INTERVAL '7 days'`,
    [userId]
  );

  const total = parseInt(totalStats?.total || '0');
  const correct = parseInt(totalStats?.correct || '0');
  const recentTotal = parseInt(recentStats?.total || '0');
  const recentCorrect = parseInt(recentStats?.correct || '0');

  return {
    total,
    correct,
    accuracy: total > 0 ? (correct / total) * 100 : 0,
    recentTotal,
    recentCorrect
  };
}

// Delete a user word
export async function deleteUserWord(userId: string, wordId: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM user_words WHERE user_id = $1 AND id = $2',
    [userId, wordId]
  );

  return result.length === 0; // Returns true if deletion was successful
}

// Sync starred words to user_words table
export async function syncStarredWordsToUserWords(userId: string): Promise<number> {
  return await transaction(async (client) => {
    // Get starred words that aren't already in user_words
    const starredWords = await client.query(
      `SELECT DISTINCT tw.original_word, tw.translated_word, t.source_language
       FROM translation_words tw
       JOIN translations t ON tw.translation_id = t.id
       WHERE t.user_id = $1 AND tw.is_starred = true
       AND NOT EXISTS (
         SELECT 1 FROM user_words uw
         WHERE uw.user_id = $1::text
         AND uw.word = tw.original_word
         AND uw.translation = tw.translated_word
       )`,
      [userId]
    );

    let insertedCount = 0;

    for (const word of starredWords.rows) {
      await client.query(
        `INSERT INTO user_words (user_id, word, translation, language_code)
         VALUES ($1, $2, $3, $4)`,
        [userId.toString(), word.original_word, word.translated_word, word.source_language]
      );
      insertedCount++;
    }

    return insertedCount;
  });
}
