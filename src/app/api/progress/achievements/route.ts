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

    // Get stats needed for achievements
    const [quizStats, wordCount, languageCount, streakResult] = await Promise.all([
      query(
        `SELECT
          COUNT(*) as total_questions,
          SUM(CASE WHEN correct THEN 1 ELSE 0 END) as correct_answers
        FROM quiz_results
        WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(*) as total FROM user_words WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT COUNT(DISTINCT language_code) as total FROM user_words WHERE user_id = $1`,
        [userId]
      ),
      query(
        `WITH daily_activity AS (
          SELECT DISTINCT DATE(created_at) as activity_date
          FROM (
            SELECT added_at as created_at FROM user_words WHERE user_id = $1
            UNION ALL
            SELECT answered_at as created_at FROM quiz_results WHERE user_id = $1
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
        [userId]
      )
    ]);

    // Check for consecutive perfect quizzes
    const perfectStreakResult = await query(
      `WITH quiz_sequence AS (
        SELECT
          correct,
          ROW_NUMBER() OVER (ORDER BY answered_at DESC) as rn,
          SUM(CASE WHEN NOT correct THEN 1 ELSE 0 END) OVER (ORDER BY answered_at DESC) as error_group
        FROM quiz_results
        WHERE user_id = $1
      )
      SELECT COUNT(*) as streak
      FROM quiz_sequence
      WHERE error_group = 0`,
      [userId]
    );

    const totalQuestions = parseInt(quizStats[0]?.total_questions || 0);
    const correctAnswers = parseInt(quizStats[0]?.correct_answers || 0);
    const totalWords = parseInt(wordCount[0]?.total || 0);
    const totalLanguages = parseInt(languageCount[0]?.total || 0);
    const currentStreak = parseInt(streakResult[0]?.streak || 0);
    const perfectStreak = parseInt(perfectStreakResult[0]?.streak || 0);

    // Define achievements with progress
    const achievements = [
      {
        title: "First Steps",
        description: "Complete your first aligneration",
        earned: totalWords > 0,
        date: totalWords > 0 ? new Date().toISOString().split('T')[0] : null,
        icon: "✨",
      },
      {
        title: "Quiz Master",
        description: "Score 100% on 5 consecutive quizzes",
        earned: perfectStreak >= 5,
        date: perfectStreak >= 5 ? new Date().toISOString().split('T')[0] : null,
        progress: Math.min(perfectStreak, 5),
        total: 5,
        icon: "🧠",
      },
      {
        title: "Polyglot",
        description: "Practice with 5 different languages",
        earned: totalLanguages >= 5,
        date: totalLanguages >= 5 ? new Date().toISOString().split('T')[0] : null,
        progress: Math.min(totalLanguages, 5),
        total: 5,
        icon: "🌍",
      },
      {
        title: "Streak Champion",
        description: "Maintain a 30-day learning streak",
        earned: currentStreak >= 30,
        date: currentStreak >= 30 ? new Date().toISOString().split('T')[0] : null,
        progress: Math.min(currentStreak, 30),
        total: 30,
        icon: "🔥",
      },
      {
        title: "Word Collector",
        description: "Save 100 words to your collection",
        earned: totalWords >= 100,
        date: totalWords >= 100 ? new Date().toISOString().split('T')[0] : null,
        progress: Math.min(totalWords, 100),
        total: 100,
        icon: "📚",
      },
      {
        title: "Quiz Enthusiast",
        description: "Answer 500 quiz questions",
        earned: totalQuestions >= 500,
        date: totalQuestions >= 500 ? new Date().toISOString().split('T')[0] : null,
        progress: Math.min(totalQuestions, 500),
        total: 500,
        icon: "🎯",
      },
    ];

    return NextResponse.json({ achievements });

  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}
