"use client"

import { useState, useMemo } from "react"
import { FolderOpen, Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { HistoryTree } from "@/components/HistoryTree"
import { HistoryList } from "@/components/HistoryList"
import { HistorySearchBar } from "@/components/HistorySearchBar"
import { StarFolderDialog } from "@/components/StarFolderDialog"
import { useHistory, useHistorySearch, useCopyToClipboard } from "@/hooks/useHistory"
import { useHistoryStore } from "@/store/useHistoryStore"
import { TranslationWithWords } from "@/lib/database"
import { useAuthStore } from "@/store/useAuthStore"

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [starDialogOpen, setStarDialogOpen] = useState(false)
  const [pendingStarId, setPendingStarId] = useState<number | null>(null)

  // Folder selection is shared with the sidebar via Zustand store
  const { selectedFolderId, setSelectedFolderId, favoritesOnly, setFavoritesOnly } = useHistoryStore()

  const { user } = useAuthStore()
  const userId = user?.id ? Number(user.id) : undefined

  // Prepare filters for history query
  const filters = useMemo(() => ({
    folderId: selectedFolderId,
    favoritesOnly: favoritesOnly ? true : undefined,
    limit: 50
  }), [selectedFolderId, favoritesOnly])

  // Fetch history and folders
  const {
    translations,
    folders,
    total,
    isLoading,
    createFolder,
    updateFolder,
    deleteFolder,
    moveTranslation,
    toggleFavorite,
    starToFolder,
    deleteTranslation,
    isStarringToFolder,
  } = useHistory(userId, filters)

  // Search functionality
  const searchUserId = userId ?? 0
  const { suggestions, isSearching } = useHistorySearch(searchUserId, searchQuery, 10)

  // Copy to clipboard functionality
  const { copyText } = useCopyToClipboard()

  // Calculate translation counts per folder
  const translationCounts = useMemo(() => {
    const counts: Record<number | string, number> = { root: 0 }

    folders.forEach(folder => {
      counts[folder.id] = 0
    })

    translations.forEach(translation => {
      if (translation.folder_id) {
        counts[translation.folder_id] = (counts[translation.folder_id] || 0) + 1
      } else {
        counts['root'] += 1
      }
    })

    return counts
  }, [folders, translations])

  // Handle search suggestion selection
  const handleSuggestionSelect = (suggestion: TranslationWithWords) => {
    // Set the folder filter to match the suggestion's folder
    setSelectedFolderId(suggestion.folder_id || null)
    setSearchQuery("")
  }

  // Handle folder selection
  const handleFolderSelect = (folderId: number | null) => {
    setSelectedFolderId(folderId)
  }

  // Intercept star clicks: unstar directly, but star → open folder dialog
  const handleStarClick = (translationId: number) => {
    const translation = translations.find((t) => t.id === translationId)
    if (!translation) return

    if (translation.is_favorite) {
      // Already starred — just unstar it
      toggleFavorite(translationId)
    } else {
      // Not starred — require a folder choice first
      setPendingStarId(translationId)
      setStarDialogOpen(true)
    }
  }

  const handleStarDialogConfirm = (folderId: number | null, newFolderName?: string) => {
    if (pendingStarId === null) return
    starToFolder({ translationId: pendingStarId, folderId, newFolderName })
    setStarDialogOpen(false)
    setPendingStarId(null)
  }

  const handleStarDialogClose = () => {
    setStarDialogOpen(false)
    setPendingStarId(null)
  }

  // Handle copying with notification
  const handleCopyText = (text: string) => {
    copyText(text)
    // You could add a toast notification here
  }

  const selectedFolderLabel = useMemo(() => {
    if (selectedFolderId === undefined) return "All history"
    if (selectedFolderId === null) return "Uncategorized"
    return folders.find(f => f.id === selectedFolderId)?.name || "Unknown Folder"
  }, [selectedFolderId, folders])

  const emptyState = useMemo(() => {
    if (favoritesOnly) {
      return {
        title: "No favorites yet",
        description: "Star a translation to save it to a folder for practice."
      }
    }
    if (selectedFolderId === null) {
      return {
        title: "No uncategorized translations",
        description: "Everything is neatly organized. Pick another folder or view all history."
      }
    }
    if (typeof selectedFolderId === "number") {
      return {
        title: "This folder is empty",
        description: "Move translations here from your history to keep things organized."
      }
    }
    return {
      title: "No history yet",
      description: "Start alignerating to build your history."
    }
  }, [favoritesOnly, selectedFolderId])

  return (
    <>
    <StarFolderDialog
      open={starDialogOpen}
      folders={folders}
      onClose={handleStarDialogClose}
      onConfirm={handleStarDialogConfirm}
      isLoading={isStarringToFolder}
    />
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#2A2A28] text-[#FAF9F5] xl:flex-row">
      {/* Sidebar with folder tree */}
      <div className="w-full border-b border-[#2D2D2B] bg-[#1A1A19] p-6 pt-16 overflow-y-auto overflow-x-hidden max-h-[45vh] xl:max-h-none xl:w-80 xl:flex-none xl:border-b-0 xl:border-r xl:pt-6">
        <div className="space-y-6">
          <div className="text-center xl:text-left">
            <h2 className="text-lg font-semibold">Folders</h2>
            <p className="text-sm text-[#9CA3AF]">
              Organize your translations
            </p>
          </div>

          <HistoryTree
            folders={folders}
            selectedFolderId={selectedFolderId}
            onFolderSelect={handleFolderSelect}
            onCreateFolder={createFolder}
            onUpdateFolder={(folderId, name) => updateFolder({ folderId, name })}
            onDeleteFolder={deleteFolder}
            translationCounts={translationCounts}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">History</h1>
            <p className="text-[#9CA3AF]">
              View and manage your aligneration history
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2D2D2B] bg-[#0F0F0D] px-3 py-1 text-xs text-[#9CA3AF]">
              <Star className="h-3 w-3 text-[#2DD4BF]" />
              <span>Stars save translations to folders for practice.</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`h-8 rounded-full border px-3 text-xs transition-all ${
                favoritesOnly
                  ? "bg-[#2DD4BF] border-[#2DD4BF] text-[#0E0E0D]"
                  : "bg-[#1A1A19] border-[#2D2D2B] text-[#9CA3AF] hover:text-[#2DD4BF]"
              }`}
            >
              <Star className="h-3 w-3 mr-1" />
              Favorites
            </Button>
          </div>

          {/* Search Bar */}
          <Card className="bg-[#1A1A19] border-[#2D2D2B]">
            <CardContent className="pt-6">
              <HistorySearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                suggestions={suggestions}
                isSearching={isSearching}
                onSuggestionSelect={handleSuggestionSelect}
              />
            </CardContent>
          </Card>

          {/* Current filter info */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2D2D2B] bg-[#0F0F0D] px-3 py-1 text-[#9CA3AF]">
              <FolderOpen className="h-3 w-3 text-[#2DD4BF]" />
              <span>{selectedFolderLabel}</span>
              <span className="text-[#2DD4BF]">{total}</span>
            </div>
            {favoritesOnly && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 px-3 py-1 text-[#2DD4BF]">
                <Star className="h-3 w-3" />
                <span>Favorites only</span>
              </div>
            )}
          </div>

          <Separator className="bg-[#2A2A28]" />

          {/* History List */}
          <HistoryList
            translations={translations}
            folders={folders}
            isLoading={isLoading}
            onToggleFavorite={handleStarClick}
            onDeleteTranslation={deleteTranslation}
            onMoveToFolder={(translationId, folderId) => moveTranslation({ translationId, folderId })}
            onCopyText={handleCopyText}
            emptyState={emptyState}
          />

          {/* Statistics */}
          {total > 0 && (
            <Card className="bg-[#1A1A19] border-[#2D2D2B]">
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
                <CardDescription className="text-[#9CA3AF]">Your aligneration activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{total}</div>
                    <p className="text-sm text-[#9CA3AF]">Total Translations</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {new Set(translations.map(t => t.source_language)).size}
                    </div>
                    <p className="text-sm text-[#9CA3AF]">Source Languages</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {new Set(translations.map(t => t.target_language)).size}
                    </div>
                    <p className="text-sm text-[#9CA3AF]">Target Languages</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{folders.length}</div>
                    <p className="text-sm text-[#9CA3AF]">Folders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
    </>
  )
}
