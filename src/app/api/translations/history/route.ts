import { NextRequest, NextResponse } from 'next/server';
import { getUserHistory, HistoryFilters } from '@/lib/translationHandlers';

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

    // Parse filters from query parameters
    const filters: HistoryFilters = {};

    if (searchParams.get('sourceLang')) {
      filters.sourceLang = searchParams.get('sourceLang')!;
    }

    if (searchParams.get('targetLang')) {
      filters.targetLang = searchParams.get('targetLang')!;
    }

    if (searchParams.get('favoritesOnly') === 'true') {
      filters.favoritesOnly = true;
    }

    if (searchParams.get('limit')) {
      filters.limit = parseInt(searchParams.get('limit')!);
    }

    if (searchParams.get('offset')) {
      filters.offset = parseInt(searchParams.get('offset')!);
    }

    if (searchParams.get('fromDate')) {
      filters.fromDate = searchParams.get('fromDate')!;
    }

    if (searchParams.get('toDate')) {
      filters.toDate = searchParams.get('toDate')!;
    }

    if (searchParams.get('folderId')) {
      const folderIdParam = searchParams.get('folderId')!;
      if (folderIdParam === 'null') {
        filters.folderId = null;
      } else {
        filters.folderId = parseInt(folderIdParam);
      }
    }

    const result = await getUserHistory(parseInt(userId), filters);

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error fetching translation history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translation history' },
      { status: 500 }
    );
  }
}