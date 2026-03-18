import { NextRequest, NextResponse } from 'next/server';
import { syncStarredWordsToUserWords } from '@/lib/quizHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    let syncedCount = 0;
    try {
      syncedCount = await syncStarredWordsToUserWords(String(user.id));
    } catch (syncError) {
      console.warn('Starred-word sync skipped:', syncError);
      syncedCount = 0;
    }

    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      message: `Successfully synced ${syncedCount} words to quiz vocabulary`
    });

  } catch (error) {
    console.error('Error syncing words:', error);
    return NextResponse.json(
      { error: 'Failed to sync words' },
      { status: 500 }
    );
  }
}