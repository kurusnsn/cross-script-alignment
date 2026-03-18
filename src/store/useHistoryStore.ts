"use client"

import { create } from 'zustand'

export interface HistoryItem {
  id: string
  original: string
  aligneration: string
  translation: string
  timestamp: Date
  folderId?: string
  response?: any
  request?: any
  alignment?: any
  phraseAlignments?: any
  wordAlignments?: any
  result_json?: any
}

export interface Folder {
  id: number
  name: string
}

interface HistoryState {
  // UI State
  selectedHistoryId: string | undefined
  selectedFolderId: number | null | undefined   // undefined=all, null=uncategorized, number=specific folder
  favoritesOnly: boolean
  searchQuery: string

  // Actions
  selectHistoryItem: (id: string | undefined) => void
  setSelectedFolderId: (id: number | null | undefined) => void
  setFavoritesOnly: (favoritesOnly: boolean) => void
  setSearchQuery: (query: string) => void

  // Resetters
  resetHistoryUI: () => void
}

export const useHistoryStore = create<HistoryState>((set) => ({
  selectedHistoryId: undefined,
  selectedFolderId: undefined,
  favoritesOnly: false,
  searchQuery: "",

  selectHistoryItem: (id) => set({ selectedHistoryId: id }),
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),
  setFavoritesOnly: (favoritesOnly) => set({ favoritesOnly }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  resetHistoryUI: () => set({
    selectedHistoryId: undefined,
    selectedFolderId: undefined,
    favoritesOnly: false,
    searchQuery: ""
  })
}))
