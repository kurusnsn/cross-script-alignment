import { NextRequest, NextResponse } from 'next/server';
import { getQuizStats, getUserWords } from '@/lib/quizHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const userId = String(user.id); // Use authenticated user ID
    const stats = await getQuizStats(userId);
    const userWords = await getUserWords(userId);

    return NextResponse.json({
      success: true,
      total_questions: stats.total,
      correct_answers: stats.correct,
      accuracy: stats.accuracy,
      recent_accuracy: stats.recentTotal > 0 ? (stats.recentCorrect / stats.recentTotal) * 100 : 0,
      words_learned: userWords.length,
      stats
    });

  } catch (error) {
    console.error('Error fetching quiz stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz statistics' },
      { status: 500 }
    );
  }
}