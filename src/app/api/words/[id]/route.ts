import { NextRequest, NextResponse } from 'next/server';
import { deleteUserWord } from '@/lib/quizHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const wordId = parseInt(id);

    if (isNaN(wordId)) {
      return NextResponse.json(
        { error: 'Invalid word ID' },
        { status: 400 }
      );
    }

    const success = await deleteUserWord(String(user.id), wordId);

    if (success) {
      return NextResponse.json({ message: 'Word deleted successfully' });
    } else {
      return NextResponse.json(
        { error: 'Word not found or not authorized' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Error deleting word:', error);
    return NextResponse.json(
      { error: 'Failed to delete word' },
      { status: 500 }
    );
  }
}