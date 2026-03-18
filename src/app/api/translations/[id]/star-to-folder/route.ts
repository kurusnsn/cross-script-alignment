import { NextRequest, NextResponse } from 'next/server'
import { starTranslationToFolder } from '@/lib/translationHandlers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const translationId = parseInt(id)

    if (isNaN(translationId)) {
      return NextResponse.json({ error: 'Invalid translation ID' }, { status: 400 })
    }

    const body = await request.json()
    const { userId, folderId, newFolderName } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (folderId == null && !newFolderName) {
      return NextResponse.json(
        { error: 'Either folderId or newFolderName is required' },
        { status: 400 }
      )
    }

    const result = await starTranslationToFolder(
      translationId,
      parseInt(userId),
      folderId != null ? parseInt(folderId) : null,
      newFolderName || undefined
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Error starring translation to folder:', error)

    if (error instanceof Error && error.message === 'Translation not found') {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to star translation to folder' }, { status: 500 })
  }
}
