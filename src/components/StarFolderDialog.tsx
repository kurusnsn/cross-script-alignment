"use client"

import { useState, useEffect } from "react"
import { Folder, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HistoryFolder } from "@/lib/database"

interface StarFolderDialogProps {
  open: boolean
  folders: HistoryFolder[]
  onClose: () => void
  onConfirm: (folderId: number | null, newFolderName?: string) => void
  isLoading?: boolean
}

export function StarFolderDialog({
  open,
  folders,
  onClose,
  onConfirm,
  isLoading = false,
}: StarFolderDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const hasFolders = folders.length > 0

  // Reset state each time the dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFolderId(null)
      setIsCreatingNew(!hasFolders)
      setNewFolderName("")
    }
  }, [open, hasFolders])

  const handleConfirm = () => {
    if (isCreatingNew) {
      if (!newFolderName.trim()) return
      onConfirm(null, newFolderName.trim())
    } else {
      onConfirm(selectedFolderId)
    }
  }

  const canConfirm = isCreatingNew
    ? newFolderName.trim().length > 0
    : selectedFolderId !== null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] shadow-[0_0_40px_rgba(0,0,0,0.45)] rounded-2xl [&>button]:text-[#9CA3AF] [&>button:hover]:text-[#FAF9F5] [&>button:focus-visible]:ring-[#2DD4BF] [&>button]:ring-offset-[#0F0F0D]">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl text-[#FAF9F5]">
            {hasFolders ? "Save to Folder" : "Create a Folder"}
          </DialogTitle>
          <DialogDescription className="text-[#9CA3AF]">
            {hasFolders
              ? "Choose a folder for this starred translation, or create a new one."
              : "You need a folder to save starred translations. Create your first folder below."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {hasFolders && !isCreatingNew ? (
            <>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                    selectedFolderId === folder.id
                      ? "border-[#2DD4BF]/60 bg-[#0F1F1C] text-[#2DD4BF] shadow-[inset_0_0_0_1px_rgba(45,212,191,0.1)]"
                      : "border-[#2D2D2B] bg-[#0F0F0D] text-[#FAF9F5] hover:border-[#2DD4BF]/30 hover:bg-[#1A1A19]"
                  }`}
                >
                  <Folder className="h-4 w-4 shrink-0" />
                  <span className="truncate font-medium">{folder.name}</span>
                </button>
              ))}
              <button
                onClick={() => setIsCreatingNew(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-[#2D2D2B] bg-[#0F0F0D] hover:border-[#2DD4BF]/40 hover:bg-[#1A1A19] text-left transition-colors text-[#9CA3AF] hover:text-[#2DD4BF]"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Create new folder</span>
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="new-folder-name" className="text-[#9CA3AF]">
                Folder name
              </Label>
              <Input
                id="new-folder-name"
                placeholder="e.g. Japanese phrases"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canConfirm && handleConfirm()}
                autoFocus
                className="h-11 bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] placeholder:text-[#9CA3AF]/50 focus-visible:border-[#2DD4BF] focus-visible:ring-[#2DD4BF]/45"
              />
              {hasFolders && (
                <button
                  onClick={() => setIsCreatingNew(false)}
                  className="text-sm text-[#9CA3AF] hover:text-[#FAF9F5] underline-offset-4 hover:underline"
                >
                  Back to folder list
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-[#2D2D2B] pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="border-[#2D2D2B] text-[#9CA3AF] hover:text-[#FAF9F5] hover:bg-[#1A1A19]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-[#2DD4BF] text-[#0E0E0D] hover:bg-[#2DD4BF]/90"
          >
            {isLoading
              ? "Saving..."
              : isCreatingNew
              ? "Create & Star"
              : "Save to Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
