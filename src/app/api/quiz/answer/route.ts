import { NextRequest, NextResponse } from 'next/server';
import { recordQuizAnswer } from '@/lib/quizHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { word_id, correct, selected_option } = body;

    if (word_id === undefined || correct === undefined) {
      return NextResponse.json(
        { error: 'word_id and correct are required' },
        { status: 400 }
      );
    }

    // Use authenticated user ID, NOT client-provided user_id
    const userId = String(user.id);
    const result = await recordQuizAnswer(userId, word_id, correct);

    const message = correct
      ? "Answer recorded successfully - Correct!"
      : "Answer recorded successfully - Try again next time!";

    return NextResponse.json({
      success: true,
      result_id: result.id,
      message,
      quiz_result: result
    });

  } catch (error) {
    console.error('Error recording quiz answer:', error);
    return NextResponse.json(
      { error: 'Failed to record quiz answer' },
      { status: 500 }
    );
  }
}