import { NextRequest, NextResponse } from 'next/server';
import { searchTranslationsText } from '@/lib/translationHandlers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('query');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: []
      });
    }

    const suggestions = await searchTranslationsText(parseInt(userId), query.trim(), limit);

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('Error searching translations:', error);
    return NextResponse.json(
      { error: 'Failed to search translations' },
      { status: 500 }
    );
  }
}