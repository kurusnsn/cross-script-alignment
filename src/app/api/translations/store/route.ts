import { NextRequest, NextResponse } from 'next/server';
import { storeTranslation, WordBreakdown } from '@/lib/translationHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    const {
      sourceLang,
      targetLang,
      originalText,
      aligneration,
      translatedText,
      wordBreakdown,
      embedding
    } = body;

    // Validate required fields (userId now comes from JWT, not body)
    if (!sourceLang || !targetLang || !originalText || !aligneration || !translatedText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate word breakdown format if provided
    if (wordBreakdown && !Array.isArray(wordBreakdown)) {
      return NextResponse.json(
        { error: 'wordBreakdown must be an array' },
        { status: 400 }
      );
    }

    // Validate embedding format if provided
    if (embedding && !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'embedding must be an array of numbers' },
        { status: 400 }
      );
    }

    // Use authenticated user's ID, NOT client-provided userId
    const normalizedUserId = Number.parseInt(String(user.id), 10);
    if (Number.isNaN(normalizedUserId)) {
      return NextResponse.json(
        { error: 'Authenticated user id must be numeric for translation history storage' },
        { status: 400 }
      );
    }

    const translationId = await storeTranslation(
      normalizedUserId,
      sourceLang,
      targetLang,
      originalText,
      aligneration,
      translatedText,
      wordBreakdown || [],
      embedding
    );

    return NextResponse.json({
      success: true,
      translationId,
      message: 'Translation stored successfully'
    });

  } catch (error) {
    console.error('Error storing translation:', error);
    return NextResponse.json(
      { error: 'Failed to store translation' },
      { status: 500 }
    );
  }
}