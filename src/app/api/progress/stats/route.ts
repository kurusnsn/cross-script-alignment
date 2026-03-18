import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userId = String(user.id);
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || undefined;
    const params = lang ? [userId, lang] : [userId];
    const wordLangClause = lang ? 'AND language_code = $2' : '';
    const quizLangClause = lang ? 'AND uw.language_code = $2' : '';

    // Get quiz stats
    const quizStatsResult = await query(
      `SELECT
        COUNT(*) as total_questions,
        SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_answers,
        ROUND(AVG(CASE WHEN correct THEN 100 ELSE 0 END)::numeric, 1) as accuracy
      FROM quiz_results qr
      JOIN user_words uw ON qr.word_id = uw.id
      WHERE qr.user_id = $1 ${quizLangClause}`,
      params
    );

    // Get weekly activity (last 7 days)
    const weeklyActivityResult = await query(
      `SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'Dy') as day,
        COUNT(DISTINCT CASE WHEN source = 'word' THEN id END) as alignerations,
        COUNT(DISTINCT CASE WHEN source = 'quiz' THEN id END) as quizzes,
        0 as voice_chat
      FROM (
        -- User words (alignerations)
        SELECT id, added_at as created_at, 'word' as source
        FROM user_words
        WHERE user_id = $1 ${wordLangClause}
        UNION ALL
        -- Quiz results
        SELECT qr.id, qr.answered_at as created_at, 'quiz' as source
        FROM quiz_results qr
        JOIN user_words uw ON qr.word_id = uw.id
        WHERE qr.user_id = $1 ${quizLangClause}
      ) combined
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('day', created_at), TO_CHAR(DATE_TRUNC('day', created_at), 'Dy')
      ORDER BY DATE_TRUNC('day', created_at)`,
      params
    );

    // Get monthly accuracy trend (last 6 months)
    const monthlyTrendResult = await query(
      `SELECT
        TO_CHAR(DATE_TRUNC('month', qr.answered_at), 'Mon') as month,
        ROUND(AVG(CASE WHEN qr.correct THEN 100 ELSE 0 END)::numeric, 1) as accuracy
      FROM quiz_results qr
      JOIN user_words uw ON qr.word_id = uw.id
      WHERE qr.user_id = $1
        ${quizLangClause}
        AND qr.answered_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', qr.answered_at)
      ORDER BY DATE_TRUNC('month', qr.answered_at)`,
      params
    );

    // Get language distribution
    const languageDistResult = await query(
      `SELECT
        language_code as name,
        COUNT(*) as value
      FROM user_words
      WHERE user_id = $1 ${wordLangClause}
      GROUP BY language_code
      ORDER BY value DESC
      LIMIT 5`,
      params
    );

    // Calculate total percentages for language distribution
    const totalLangWords = languageDistResult.reduce((sum: number, row: any) => sum + parseInt(row.value), 0);
    const languageData = languageDistResult.map((row: any, index: number) => ({
      name: row.name,
      value: totalLangWords > 0 ? Math.round((parseInt(row.value) / totalLangWords) * 100) : 0,
      color: ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'][index] || '#6b7280'
    }));

    // Get total words count
    const totalWordsResult = await query(
      `SELECT COUNT(*) as total FROM user_words WHERE user_id = $1 ${wordLangClause}`,
      params
    );

    // Get current streak
    const streakResult = await query(
      `WITH daily_activity AS (
        SELECT DISTINCT DATE(created_at) as activity_date
        FROM (
          SELECT added_at as created_at
          FROM user_words
          WHERE user_id = $1 ${wordLangClause}
          UNION ALL
          SELECT qr.answered_at as created_at
          FROM quiz_results qr
          JOIN user_words uw ON qr.word_id = uw.id
          WHERE qr.user_id = $1 ${quizLangClause}
        ) combined
        ORDER BY activity_date DESC
      ),
      streak_calc AS (
        SELECT
          activity_date,
          activity_date - ROW_NUMBER() OVER (ORDER BY activity_date DESC)::int as grp
        FROM daily_activity
        WHERE activity_date <= CURRENT_DATE
      )
      SELECT COUNT(*) as streak
      FROM streak_calc
      WHERE grp = (SELECT grp FROM streak_calc LIMIT 1)`,
      params
    );

    // Get unique languages practiced
    const languageCountResult = await query(
      `SELECT COUNT(DISTINCT language_code) as total
      FROM user_words
      WHERE user_id = $1 ${wordLangClause}`,
      params
    );

    // Format weekly data to always have 7 days
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = days.map(day => {
      const found = weeklyActivityResult.find((r: any) => r.day === day);
      return {
        day,
        alignerations: found ? parseInt(found.alignerations) : 0,
        quizzes: found ? parseInt(found.quizzes) : 0,
        voiceChat: found ? parseInt(found.voice_chat) : 0
      };
    });

    const stats = {
      // Overview stats
      totalWords: parseInt(totalWordsResult[0]?.total || 0),
      averageAccuracy: parseFloat(quizStatsResult[0]?.accuracy || 0),
      currentStreak: parseInt(streakResult[0]?.streak || 0),
      totalLanguages: parseInt(languageCountResult[0]?.total || 0),

      // Quiz stats
      totalQuestions: parseInt(quizStatsResult[0]?.total_questions || 0),
      correctAnswers: parseInt(quizStatsResult[0]?.correct_answers || 0),

      // Weekly activity
      weeklyActivity: weeklyData,

      // Monthly trend
      monthlyTrend: monthlyTrendResult.map((row: any) => ({
        month: row.month,
        accuracy: parseFloat(row.accuracy || 0)
      })),

      // Language distribution
      languageDistribution: languageData,
    };

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress stats' },
      { status: 500 }
    );
  }
}
