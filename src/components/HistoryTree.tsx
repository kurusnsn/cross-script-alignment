"use client"

import { useEffect, useRef, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  MoreHorizontal
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { HistoryFolder } from "@/lib/database"

interface HistoryTreeProps {
  folders: HistoryFolder[]
  selectedFolderId: number | null | undefined
  onFolderSelect: (folderId: number | null) => void
  onCreateFolder: (name: string) => void
  onUpdateFolder: (folderId: number, name: string) => void
  onDeleteFolder: (folderId: number) => void
  translationCounts: Record<number | string, number>
  isLoading?: boolean
}

interface FolderItemProps {
  folder: HistoryFolder
  isSelected: boolean
  count: number
  onSelect: () => void
  onEdit: (name: string) => void
  onDelete: () => void
}

function FolderItem({ folder, isSelected, count, onSelect, onEdit, onDelete }: FolderItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)

  const handleSaveEdit = () => {
    if (editName.trim() && editName.trim() !== folder.name) {
      onEdit(editName.trim())
    }
    setIsEditing(false)
    setEditName(folder.name)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditName(folder.name)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Folder: ${folder.name}, ${count} items`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors border ${
        isSelected
          ? 'bg-[#2DD4BF]/10 text-[#2DD4BF] border-[#2DD4BF]/30'
          : 'border-transparent hover:bg-[#2A2A28]'
      }`}
    >
      <div 
        role="button"
        tabIndex={0}
        className="flex items-center flex-1 min-w-0" 
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
        {isEditing ? (
          <div className="flex items-center flex-1 mr-2" onClick={e => e.stopPropagation()} role="presentation">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveEdit()
                } else if (e.key === 'Escape') {
                  handleCancelEdit()
                }
              }}
              className="h-6 text-sm flex-1 mr-1"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleSaveEdit}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleCancelEdit}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
            <Badge variant="secondary" className="ml-2 bg-[#0F0F0D] text-[#9CA3AF] border border-[#2D2D2B]">
              {count}
            </Badge>
          </>
        )}
      </div>

      {!isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              onClick={e => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function HistoryTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  translationCounts,
  isLoading = false
}: HistoryTreeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const createInputRowRef = useRef<HTMLDivElement>(null)

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim())
      setNewFolderName("")
      setIsCreating(false)
    }
  }

  const handleCancelCreate = () => {
    setIsCreating(false)
    setNewFolderName("")
  }

  const rootCount = translationCounts['root'] || 0

  useEffect(() => {
    if (!isCreating) return

    const frame = requestAnimationFrame(() => {
      createInputRowRef.current?.scrollIntoView({ block: "nearest" })
    })

    return () => cancelAnimationFrame(frame)
  }, [isCreating])

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-8 bg-[#2A2A28] rounded animate-pulse" />
        <div className="h-6 bg-[#2A2A28] rounded animate-pulse" />
        <div className="h-6 bg-[#2A2A28] rounded animate-pulse" />
      </div>
    )
  }

  if (folders.length === 0 && rootCount === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-[#2D2D2B] bg-[#0F0F0D] p-4 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-2xl border border-[#2D2D2B] bg-[#1A1A19] flex items-center justify-center text-[#2DD4BF]/40">
            <Folder className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-[#FAF9F5]">No folders yet</p>
          <p className="text-xs text-[#9CA3AF] mt-1">
            Star a translation to save it here or create your first folder.
          </p>
          <Button
            size="sm"
            className="mt-3 bg-[#2DD4BF] text-[#0E0E0D] hover:bg-[#2DD4BF]/90"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Create folder
          </Button>
        </div>

        {isCreating && (
          <div
            ref={createInputRowRef}
            className="flex min-h-10 items-center py-2 px-3 space-x-2 rounded-lg border border-[#2D2D2B] bg-[#1A1A19]"
          >
            <Folder className="h-4 w-4 text-[#9CA3AF]" />
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder()
                } else if (e.key === 'Escape') {
                  handleCancelCreate()
                }
              }}
              placeholder="Folder name"
              className="h-8 text-sm leading-tight flex-1 bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] focus-visible:border-[#2DD4BF] focus-visible:ring-[#2DD4BF]/45"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-[#2DD4BF]"
              onClick={handleCreateFolder}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-[#9CA3AF]"
              onClick={handleCancelCreate}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1 overflow-x-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center p-2 w-full justify-start text-[#FAF9F5]">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 mr-2" />
              ) : (
                <Folder className="h-4 w-4 mr-2" />
              )}
              <span className="font-medium">All History</span>
              <Badge variant="secondary" className="ml-auto bg-[#0F0F0D] text-[#9CA3AF] border border-[#2D2D2B]">
                {Object.values(translationCounts).reduce((sum, count) => sum + count, 0)}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-[#9CA3AF] hover:text-[#2DD4BF]"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <CollapsibleContent className="space-y-1 ml-4 overflow-x-hidden">
          {/* Root folder (uncategorized) */}
          <div
            role="button"
            tabIndex={0}
            aria-label={`Uncategorized history, ${rootCount} items`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFolderSelect(null);
              }
            }}
            className={`flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors border ${
              selectedFolderId === null
                ? 'bg-[#2DD4BF]/10 text-[#2DD4BF] border-[#2DD4BF]/30'
                : 'border-transparent hover:bg-[#2A2A28]'
            }`}
            onClick={() => onFolderSelect(null)}
          >
            <div className="flex items-center flex-1">
              <Folder className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Uncategorized</span>
              <Badge variant="secondary" className="ml-auto bg-[#0F0F0D] text-[#9CA3AF] border border-[#2D2D2B]">
                {rootCount}
              </Badge>
            </div>
          </div>

          {/* User folders */}
          {folders.map((folder) => (
            <div key={folder.id} className="group">
              <FolderItem
                folder={folder}
                isSelected={selectedFolderId === folder.id}
                count={translationCounts[folder.id] || 0}
                onSelect={() => onFolderSelect(folder.id)}
                onEdit={(name) => onUpdateFolder(folder.id, name)}
                onDelete={() => onDeleteFolder(folder.id)}
              />
            </div>
          ))}

          {/* Create new folder input */}
          {isCreating && (
            <div
              ref={createInputRowRef}
              className="flex min-h-10 items-center py-2 px-3 space-x-2 rounded-lg border border-[#2D2D2B] bg-[#1A1A19]"
            >
              <Folder className="h-4 w-4 text-[#9CA3AF]" />
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder()
                  } else if (e.key === 'Escape') {
                    handleCancelCreate()
                  }
                }}
                placeholder="Folder name"
                className="h-8 text-sm leading-tight flex-1 bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] focus-visible:border-[#2DD4BF] focus-visible:ring-[#2DD4BF]/45"
                autoFocus
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#2DD4BF]"
                onClick={handleCreateFolder}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[#9CA3AF]"
                onClick={handleCancelCreate}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
