"use client"

import { useState } from "react"
import { Folder, Plus, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type HistoryItem = {
  id: string
  original: string
  aligneration: string
  timestamp: Date
  folderId?: string
}

type FolderItem = {
  id: string
  name: string
}

interface TransliterationSidebarProps {
  history: HistoryItem[]
  onSelectHistory: (item: HistoryItem) => void
  selectedHistoryId?: string
}

export default function TransliterationSidebar({
  history,
  onSelectHistory,
  selectedHistoryId,
}: TransliterationSidebarProps) {
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [isAddingFolder, setIsAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder: FolderItem = {
        id: `folder-${Date.now()}`,
        name: newFolderName.trim(),
      }
      setFolders([...folders, newFolder])
      setNewFolderName("")
      setIsAddingFolder(false)
    }
  }

  const handleDeleteFolder = (folderId: string) => {
    setFolders(folders.filter(f => f.id !== folderId))
  }

  const getUncategorizedHistory = () => {
    return history.filter(item => !item.folderId)
  }

  return (
    <div className="w-80 border-r bg-[#0F0F0D] flex flex-col h-full">
      {/* Previous Translations - Now showing all uncategorized */}
      <div className="flex-1 flex flex-col p-4 border-b">
        <h3 className="font-semibold text-sm text-[#9CA3AF] mb-3">Previous Translations</h3>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {getUncategorizedHistory().map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectHistory(item)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors",
                  selectedHistoryId === item.id && "bg-accent"
                )}
              >
                <div className="font-medium truncate">{item.original}</div>
                <div className="text-xs text-[#9CA3AF] truncate">{item.aligneration}</div>
                <div className="text-xs text-[#9CA3AF]">
                  {item.timestamp.toLocaleTimeString()}
                </div>
              </button>
            ))}
            {getUncategorizedHistory().length === 0 && (
              <p className="text-xs text-[#9CA3AF] text-center py-4">
                No translations yet
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Folders Section - Flat list without expansion */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-[#9CA3AF]">Folders</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsAddingFolder(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {/* Add Folder Input */}
          {isAddingFolder && (
            <div className="flex items-center space-x-2 mb-2">
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateFolder()
                  } else if (e.key === "Escape") {
                    setIsAddingFolder(false)
                    setNewFolderName("")
                  }
                }}
                placeholder="Folder name"
                className="h-8 text-sm"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleCreateFolder}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Folder List - Simple flat structure */}
          {folders.map((folder) => (
            <div key={folder.id} className="flex items-center justify-between group hover:bg-accent rounded-md px-3 py-2">
              <div className="flex items-center space-x-2 flex-1">
                <Folder className="h-4 w-4" />
                <span className="text-sm truncate">{folder.name}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteFolder(folder.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {folders.length === 0 && !isAddingFolder && (
            <p className="text-xs text-[#9CA3AF] text-center py-4">
              Click + to create a folder
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
