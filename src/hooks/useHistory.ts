"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'
import { TranslationWithWords, HistoryFolder } from '@/lib/database'

// Types for API responses
interface HistoryResponse {
  success: boolean
  translations: TranslationWithWords[]
  total: number
}

interface FoldersResponse {
  success: boolean
  folders: HistoryFolder[]
}

interface SearchResponse {
  success: boolean
  suggestions: TranslationWithWords[]
}

interface FolderResponse {
  success: boolean
  folder: HistoryFolder
}

type HttpError = Error & { status?: number }

const buildHttpError = (message: string, status: number): HttpError => {
  const error = new Error(message) as HttpError
  error.status = status
  return error
}

// API functions
const fetchHistory = async (userId: number, filters: HistoryFilters = {}): Promise<HistoryResponse> => {
  const params = new URLSearchParams({
    userId: userId.toString(),
    ...Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, String(value)])
    )
  })

  const response = await fetch(`/api/translations/history?${params}`)
  if (!response.ok) {
    throw buildHttpError('Failed to fetch history', response.status)
  }
  return response.json()
}

const fetchFolders = async (userId: number): Promise<FoldersResponse> => {
  const response = await fetch(`/api/history/folders?userId=${userId}`)
  if (!response.ok) {
    throw buildHttpError('Failed to fetch folders', response.status)
  }
  return response.json()
}

const searchTranslations = async (userId: number, query: string, limit = 10): Promise<SearchResponse> => {
  if (!query.trim()) {
    return { success: true, suggestions: [] }
  }

  const params = new URLSearchParams({
    userId: userId.toString(),
    query: query.trim(),
    limit: limit.toString()
  })

  const response = await fetch(`/api/history/search?${params}`)
  if (!response.ok) {
    throw buildHttpError('Failed to search translations', response.status)
  }
  return response.json()
}

const createFolder = async (userId: number, name: string): Promise<FolderResponse> => {
  const response = await fetch('/api/history/folders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, name }),
  })
  if (!response.ok) {
    throw new Error('Failed to create folder')
  }
  return response.json()
}

const updateFolder = async (folderId: number, userId: number, name: string): Promise<FolderResponse> => {
  const response = await fetch(`/api/history/folders/${folderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, name }),
  })
  if (!response.ok) {
    throw new Error('Failed to update folder')
  }
  return response.json()
}

const deleteFolder = async (folderId: number, userId: number): Promise<void> => {
  const response = await fetch(`/api/history/folders/${folderId}?userId=${userId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete folder')
  }
}

const moveTranslation = async (userId: number, translationId: number, folderId: number | null): Promise<void> => {
  const response = await fetch('/api/history/move', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, translationId, folderId }),
  })
  if (!response.ok) {
    throw new Error('Failed to move translation')
  }
}

const toggleFavorite = async (translationId: number): Promise<void> => {
  const response = await fetch(`/api/translations/${translationId}/favorite`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error('Failed to toggle favorite')
  }
}

const starTranslationToFolder = async (
  userId: number,
  translationId: number,
  folderId: number | null,
  newFolderName?: string
): Promise<{ isFavorite: boolean; folderId: number | null; folder?: { id: number; name: string } }> => {
  const response = await fetch(`/api/translations/${translationId}/star-to-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, folderId, newFolderName }),
  })
  if (!response.ok) {
    throw new Error('Failed to star translation to folder')
  }
  return response.json()
}

const deleteTranslation = async (translationId: number, userId: number): Promise<void> => {
  const response = await fetch(`/api/translations/${translationId}?userId=${userId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete translation')
  }
}

// Filter types
export interface HistoryFilters {
  sourceLang?: string
  targetLang?: string
  favoritesOnly?: boolean
  folderId?: number | null
  limit?: number
  offset?: number
  fromDate?: string
  toDate?: string
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Main history hook
import { useAuthStore } from '@/store/useAuthStore'

export function useHistory(userId?: number, filters: HistoryFilters = {}) {
  const queryClient = useQueryClient()
  const authenticatedUserId = useAuthStore(state => state.user?.id)
  const effectiveUserId = Number(userId ?? authenticatedUserId ?? 0)
  const hasUser = Number.isFinite(effectiveUserId) && effectiveUserId > 0

  // Normalize filters so sidebar (no args) and history page share the same cache key
  const normalizedFilters: HistoryFilters = {
    limit: 50,
    ...filters,
  }
  // Build a stable, sorted key so object identity doesn't cause cache misses
  const filterKey = JSON.stringify(normalizedFilters, Object.keys(normalizedFilters).sort())

  const historyQuery = useQuery({
    queryKey: ['history', effectiveUserId, filterKey],
    queryFn: () => fetchHistory(effectiveUserId, normalizedFilters),
    enabled: hasUser,
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      const status = (error as HttpError)?.status
      if (status && status >= 400 && status < 500) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
  })

  const foldersQuery = useQuery({
    queryKey: ['folders', effectiveUserId],
    queryFn: () => fetchFolders(effectiveUserId),
    enabled: hasUser,
    staleTime: 120_000,
    gcTime: 600_000,
    retry: (failureCount, error) => {
      const status = (error as HttpError)?.status
      if (status && status >= 400 && status < 500) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
  })

  // Mutations with optimistic updates
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(effectiveUserId, name),
    onSuccess: (data) => {
      queryClient.setQueryData(['folders', effectiveUserId], (old: FoldersResponse | undefined) => {
        if (!old) return { success: true, folders: [data.folder] }
        return {
          ...old,
          folders: [...old.folders, data.folder]
        }
      })
    },
  })

  const updateFolderMutation = useMutation({
    mutationFn: ({ folderId, name }: { folderId: number; name: string }) =>
      updateFolder(folderId, effectiveUserId, name),
    onSuccess: (data) => {
      queryClient.setQueryData(['folders', effectiveUserId], (old: FoldersResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          folders: old.folders.map(folder =>
            folder.id === data.folder.id ? data.folder : folder
          )
        }
      })
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: number) => deleteFolder(folderId, effectiveUserId),
    onSuccess: (_, folderId) => {
      queryClient.setQueryData(['folders', effectiveUserId], (old: FoldersResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          folders: old.folders.filter(folder => folder.id !== folderId)
        }
      })
      // Refetch history to update counts
      queryClient.invalidateQueries({ queryKey: ['history', effectiveUserId] })
    },
  })

  const moveTranslationMutation = useMutation({
    mutationFn: ({ translationId, folderId }: { translationId: number; folderId: number | null }) =>
      moveTranslation(effectiveUserId, translationId, folderId),
    onSuccess: () => {
      // Refetch history to reflect the move
      queryClient.invalidateQueries({ queryKey: ['history', effectiveUserId] })
    },
  })

  const toggleFavoriteMutation = useMutation({
    mutationFn: (translationId: number) => toggleFavorite(translationId),
    onMutate: async (translationId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['history', effectiveUserId] })

      // Snapshot previous value
      const previousHistory = queryClient.getQueryData(['history', effectiveUserId])

      // Optimistically update
      queryClient.setQueryData(['history', effectiveUserId], (old: HistoryResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          translations: old.translations.map(translation =>
            translation.id === translationId
              ? { ...translation, is_favorite: !translation.is_favorite }
              : translation
          )
        }
      })

      return { previousHistory }
    },
    onError: (err, translationId, context) => {
      // Rollback on error
      if (context?.previousHistory) {
        queryClient.setQueryData(['history', effectiveUserId], context.previousHistory)
      }
    },
  })

  const starToFolderMutation = useMutation({
    mutationFn: ({
      translationId,
      folderId,
      newFolderName,
    }: {
      translationId: number
      folderId: number | null
      newFolderName?: string
    }) => starTranslationToFolder(effectiveUserId, translationId, folderId, newFolderName),
    onSuccess: (data) => {
      // Add the newly created folder to the cache if one was created
      if (data.folder) {
        queryClient.setQueryData(['folders', effectiveUserId], (old: FoldersResponse | undefined) => {
          if (!old) return { success: true, folders: [data.folder] }
          return { ...old, folders: [...old.folders, data.folder] }
        })
      }
      // Refetch history to reflect the star + folder move
      queryClient.invalidateQueries({ queryKey: ['history', effectiveUserId] })
    },
  })

  const deleteTranslationMutation = useMutation({
    mutationFn: (translationId: number) => deleteTranslation(translationId, effectiveUserId),
    onSuccess: (_, translationId) => {
      queryClient.setQueryData(['history', effectiveUserId], (old: HistoryResponse | undefined) => {
        if (!old) return old
        return {
          ...old,
          translations: old.translations.filter(translation => translation.id !== translationId),
          total: old.total - 1
        }
      })
    },
  })

  return {
    // Data
    translations: historyQuery.data?.translations || [],
    folders: foldersQuery.data?.folders || [],
    total: historyQuery.data?.total || 0,

    // Loading states
    isLoading: historyQuery.isLoading || foldersQuery.isLoading,
    isHistoryLoading: historyQuery.isLoading,
    isFoldersLoading: foldersQuery.isLoading,

    // Error states
    error: historyQuery.error || foldersQuery.error,
    historyError: historyQuery.error,
    foldersError: foldersQuery.error,

    // Mutations
    createFolder: createFolderMutation.mutate,
    updateFolder: updateFolderMutation.mutate,
    deleteFolder: deleteFolderMutation.mutate,
    moveTranslation: moveTranslationMutation.mutate,
    toggleFavorite: toggleFavoriteMutation.mutate,
    starToFolder: starToFolderMutation.mutate,
    deleteTranslation: deleteTranslationMutation.mutate,

    // Mutation states
    isCreatingFolder: createFolderMutation.isPending,
    isUpdatingFolder: updateFolderMutation.isPending,
    isDeletingFolder: deleteFolderMutation.isPending,
    isMovingTranslation: moveTranslationMutation.isPending,
    isTogglingFavorite: toggleFavoriteMutation.isPending,
    isStarringToFolder: starToFolderMutation.isPending,
    isDeletingTranslation: deleteTranslationMutation.isPending,

    // Refetch functions
    refetchHistory: historyQuery.refetch,
    refetchFolders: foldersQuery.refetch,
  }
}

// Search hook with debouncing
export function useHistorySearch(userId: number, query: string, limit = 10) {
  const debouncedQuery = useDebounce(query, 300)

  const searchQuery = useQuery({
    queryKey: ['search', userId, debouncedQuery, limit],
    queryFn: () => searchTranslations(userId, debouncedQuery, limit),
    enabled: !!userId && debouncedQuery.trim().length > 0,
  })

  return {
    suggestions: searchQuery.data?.suggestions || [],
    isSearching: searchQuery.isLoading,
    searchError: searchQuery.error,
  }
}

// Copy to clipboard helper
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)

  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }, [])

  return { copyText, copied }
}
