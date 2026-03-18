import { NextRequest, NextResponse } from 'next/server';
import { getUserWords, addUserWord } from '@/lib/quizHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang');

    // Use authenticated user's ID, NOT client-provided user_id
    const words = await getUserWords(String(user.id), lang || undefined);
    return NextResponse.json(words);

  } catch (error) {
    console.error('Error fetching words:', error);
    return NextResponse.json(
      { error: 'Failed to fetch words' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const {
      original,
      translation,
      language_code,
      aligneration,
      audio_url,
      folder
    } = body;

    if (!original || !translation || !language_code) {
      return NextResponse.json(
        { error: 'original, translation, and language_code are required' },
        { status: 400 }
      );
    }

    // Use authenticated user's ID, NOT client-provided user_id
    const newWord = await addUserWord(
      String(user.id),
      original,
      translation,
      language_code,
      aligneration,
      audio_url,
      folder
    );

    return NextResponse.json(newWord, { status: 201 });

  } catch (error) {
    console.error('Error adding word:', error);
    return NextResponse.json(
      { error: 'Failed to add word' },
      { status: 500 }
    );
  }
}