"use client"

import { useState, type ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Star,
  Copy,
  Trash2,
  MoreHorizontal,
  FolderInput,
  StarOff
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { TranslationWithWords, HistoryFolder } from "@/lib/database"

interface HistoryListProps {
  translations: TranslationWithWords[]
  folders: HistoryFolder[]
  isLoading?: boolean
  onToggleFavorite: (translationId: number) => void
  onDeleteTranslation: (translationId: number) => void
  onMoveToFolder: (translationId: number, folderId: number | null) => void
  onCopyText: (text: string) => void
  emptyState?: {
    title: string
    description: string
    icon?: ReactNode
  }
}

interface HistoryItemProps {
  translation: TranslationWithWords
  folders: HistoryFolder[]
  onToggleFavorite: () => void
  onDelete: () => void
  onMoveToFolder: (folderId: number | null) => void
  onCopyText: (text: string) => void
}

function HistoryItem({
  translation,
  folders,
  onToggleFavorite,
  onDelete,
  onMoveToFolder,
  onCopyText
}: HistoryItemProps) {
  const folderName = translation.folder_id
    ? folders.find(folder => folder.id === translation.folder_id)?.name
    : null

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Less than an hour ago"
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`

    return date.toLocaleDateString()
  }

  return (
    <Card className="group overflow-x-hidden bg-[#1A1A19] border-[#2D2D2B] shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <CardContent className="space-y-4 overflow-x-hidden pt-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-[#2D2D2B] text-[#FAF9F5]">
              {translation.source_language}
            </Badge>
            <Badge variant="secondary" className="bg-[#0F0F0D] text-[#9CA3AF] border border-[#2D2D2B]">
              → {translation.target_language}
            </Badge>
            {folderName && (
              <Badge className="bg-[#0F0F0D] text-[#9CA3AF] border border-[#2D2D2B]">
                {folderName}
              </Badge>
            )}
            {translation.is_favorite && (
              <Badge className="bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/30">
                {folderName ? "Starred" : "Starred · Uncategorized"}
              </Badge>
            )}
            <span className="text-sm text-[#9CA3AF]">
              {formatTimeAgo(translation.created_at)}
            </span>
          </div>
          <div className={`flex space-x-1 transition-opacity ${translation.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleFavorite}
              title={translation.is_favorite ? "Remove from favorites" : "Save to folder"}
              className="h-8 w-8 p-0"
            >
              {translation.is_favorite ? (
                <Star className="h-4 w-4 fill-current text-[#2DD4BF]" />
              ) : (
                <StarOff className="h-4 w-4 text-[#9CA3AF]" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopyText(translation.aligneration)}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onCopyText(translation.original_text)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Original
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopyText(translation.aligneration)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Transliteration
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopyText(translation.translated_text)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Translation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderInput className="h-4 w-4 mr-2" />
                    Move to Folder
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => onMoveToFolder(null)}>
                      Uncategorized
                    </DropdownMenuItem>
                    {folders.map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => onMoveToFolder(folder.id)}
                      >
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-[#9CA3AF] uppercase tracking-wide">
              Original
            </Label>
            <p className="mt-1 break-words text-lg font-medium">{translation.original_text}</p>
          </div>
          <div>
            <Label className="text-xs text-[#9CA3AF] uppercase tracking-wide">
              Transliteration
            </Label>
            <p className="mt-1 break-words text-lg font-medium text-[#2DD4BF]">
              {translation.aligneration}
            </p>
          </div>
          <div>
            <Label className="text-xs text-[#9CA3AF] uppercase tracking-wide">
              Translation
            </Label>
            <p className="mt-1 break-words font-medium">{translation.translated_text}</p>
          </div>
        </div>

        {/* Word breakdown if available */}
        {translation.words && translation.words.length > 0 && (
          <div>
            <Label className="text-xs text-[#9CA3AF] uppercase tracking-wide">
              Word Breakdown
            </Label>
            <div className="grid gap-2 mt-2">
              {translation.words.map((word) => (
                <div
                  key={word.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#2D2D2B] bg-[#0F0F0D] p-2 text-sm"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="break-words font-medium">{word.original_word}</span>
                    <span className="text-[#9CA3AF]">→</span>
                    <span className="break-words text-[#2DD4BF]">{word.align_word}</span>
                    <span className="text-[#9CA3AF]">→</span>
                    <span className="break-words">{word.translated_word}</span>
                  </div>
                  {word.is_starred && (
                    <Star className="h-3 w-3 fill-current text-[#2DD4BF]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function HistoryList({
  translations,
  folders,
  isLoading = false,
  onToggleFavorite,
  onDeleteTranslation,
  onMoveToFolder,
  onCopyText,
  emptyState
}: HistoryListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="bg-[#1A1A19] border-[#2D2D2B]">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between">
                <div className="flex space-x-2">
                  <div className="h-6 w-12 bg-[#2A2A28] rounded animate-pulse" />
                  <div className="h-6 w-16 bg-[#2A2A28] rounded animate-pulse" />
                  <div className="h-6 w-24 bg-[#2A2A28] rounded animate-pulse" />
                </div>
                <div className="flex space-x-1">
                  <div className="h-8 w-8 bg-[#2A2A28] rounded animate-pulse" />
                  <div className="h-8 w-8 bg-[#2A2A28] rounded animate-pulse" />
                  <div className="h-8 w-8 bg-[#2A2A28] rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="h-4 bg-[#2A2A28] rounded animate-pulse" />
                <div className="h-6 bg-[#2A2A28] rounded animate-pulse" />
                <div className="h-4 bg-[#2A2A28] rounded animate-pulse" />
                <div className="h-6 bg-[#2A2A28] rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (translations.length === 0) {
    return (
      <Card className="bg-[#1A1A19] border-[#2D2D2B]">
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-12 w-12 text-[#2DD4BF]/30 mb-4">
            {emptyState?.icon ?? <FolderInput className="h-full w-full" />}
          </div>
          <p className="text-lg text-[#FAF9F5] mb-2">{emptyState?.title ?? "No translations found"}</p>
          <p className="text-sm text-[#9CA3AF]">
            {emptyState?.description ?? "Start alignerating to build your history"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {translations.map((translation) => (
        <HistoryItem
          key={translation.id}
          translation={translation}
          folders={folders}
          onToggleFavorite={() => onToggleFavorite(translation.id)}
          onDelete={() => onDeleteTranslation(translation.id)}
          onMoveToFolder={(folderId) => onMoveToFolder(translation.id, folderId)}
          onCopyText={onCopyText}
        />
      ))}
    </div>
  )
}
