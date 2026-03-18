import { NextRequest, NextResponse } from 'next/server';
import { searchTranslations } from '@/lib/translationHandlers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, queryEmbedding, limit } = body;

    // Validate required fields
    if (!userId || !queryEmbedding) {
      return NextResponse.json(
        { error: 'userId and queryEmbedding are required' },
        { status: 400 }
      );
    }

    // Validate embedding format
    if (!Array.isArray(queryEmbedding)) {
      return NextResponse.json(
        { error: 'queryEmbedding must be an array of numbers' },
        { status: 400 }
      );
    }

    const similarTranslations = await searchTranslations(
      userId,
      queryEmbedding,
      limit || 10
    );

    return NextResponse.json({
      success: true,
      translations: similarTranslations,
      count: similarTranslations.length
    });

  } catch (error) {
    console.error('Error searching translations:', error);
    return NextResponse.json(
      { error: 'Failed to search translations' },
      { status: 500 }
    );
  }
}