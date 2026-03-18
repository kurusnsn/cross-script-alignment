import { NextRequest, NextResponse } from 'next/server';
import { toggleFavoriteTranslation } from '@/lib/translationHandlers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const translationId = parseInt(id);

    if (isNaN(translationId)) {
      return NextResponse.json(
        { error: 'Invalid translation ID' },
        { status: 400 }
      );
    }

    const isFavorite = await toggleFavoriteTranslation(translationId);

    return NextResponse.json({
      success: true,
      isFavorite,
      message: `Translation ${isFavorite ? 'added to' : 'removed from'} favorites`
    });

  } catch (error) {
    console.error('Error toggling favorite status:', error);

    if (error instanceof Error && error.message === 'Translation not found') {
      return NextResponse.json(
        { error: 'Translation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to toggle favorite status' },
      { status: 500 }
    );
  }
}