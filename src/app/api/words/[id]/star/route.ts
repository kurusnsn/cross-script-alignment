import { NextRequest, NextResponse } from 'next/server';
import { toggleStarWord } from '@/lib/translationHandlers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wordId = parseInt(id);

    if (isNaN(wordId)) {
      return NextResponse.json(
        { error: 'Invalid word ID' },
        { status: 400 }
      );
    }

    const isStarred = await toggleStarWord(wordId);

    return NextResponse.json({
      success: true,
      isStarred,
      message: `Word ${isStarred ? 'starred' : 'unstarred'} successfully`
    });

  } catch (error) {
    console.error('Error toggling star status:', error);

    if (error instanceof Error && error.message === 'Word not found') {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to toggle star status' },
      { status: 500 }
    );
  }
}