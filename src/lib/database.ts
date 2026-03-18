import { Pool, PoolClient } from 'pg';

// Database connection pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Types for our database models
export interface User {
  id: number;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryFolder {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Translation {
  id: number;
  user_id: number;
  folder_id?: number;
  source_language: string;
  target_language: string;
  original_text: string;
  aligneration: string;
  translated_text: string;
  is_favorite: boolean;
  embedding?: number[]; // Vector embedding for similarity search
  created_at: string;
  updated_at: string;
}

export interface TranslationWord {
  id: number;
  translation_id: number;
  position: number;
  original_word: string;
  align_word: string;
  translated_word: string;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface WordBreakdown {
  position: number;
  original_word: string;
  align_word: string;
  translated_word: string;
}

export interface TranslationWithWords extends Translation {
  words: TranslationWord[];
}

export interface StarredWordWithTranslation extends TranslationWord {
  translation: Pick<Translation, 'id' | 'source_language' | 'target_language' | 'original_text' | 'created_at'>;
}

// Quiz system types
export interface UserWord {
  id: number;
  user_id: string;
  word: string; // Kept for backward compatibility
  original: string; // New primary field as per plan.md
  aligneration?: string; // Optional aligneration
  translation: string;
  language_code: string;
  audio_url?: string;
  folder?: string; // Optional folder organization
  added_at: string;
}

export interface QuizResult {
  id: number;
  user_id: string;
  word_id: number;
  correct: boolean;
  answered_at: string;
}