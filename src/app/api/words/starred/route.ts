import { NextRequest, NextResponse } from 'next/server';
import { getStarredWords } from '@/lib/translationHandlers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const starredWords = await getStarredWords(parseInt(userId));

    return NextResponse.json({
      success: true,
      starredWords,
      count: starredWords.length
    });

  } catch (error) {
    console.error('Error fetching starred words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch starred words' },
      { status: 500 }
    );
  }
}