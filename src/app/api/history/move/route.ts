import { NextRequest, NextResponse } from 'next/server';
import { moveTranslationToFolder } from '@/lib/translationHandlers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, translationId, folderId } = body;

    if (!userId || !translationId) {
      return NextResponse.json(
        { error: 'userId and translationId are required' },
        { status: 400 }
      );
    }

    const success = await moveTranslationToFolder(
      parseInt(translationId),
      parseInt(userId),
      folderId ? parseInt(folderId) : null
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Translation not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true
    });

  } catch (error) {
    console.error('Error moving translation:', error);
    return NextResponse.json(
      { error: 'Failed to move translation' },
      { status: 500 }
    );
  }
}