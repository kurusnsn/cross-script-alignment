"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserWord } from '@/lib/database'

const LOCAL_API_BASE = '/api'
type HttpError = Error & { status?: number }

const buildHttpError = (message: string, status: number): HttpError => {
  const error = new Error(message) as HttpError
  error.status = status
  return error
}

// Fetch user words
const fetchWords = async (_userId: string, token: string | null): Promise<UserWord[]> => {
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${LOCAL_API_BASE}/words`, { headers })
  if (!response.ok) {
    throw buildHttpError('Failed to fetch words', response.status)
  }
  return response.json()
}

// Add a new word
const addWord = async (word: {
  original: string
  translation: string
  aligneration?: string
  language_code: string
  folder?: string
}, token: string | null): Promise<UserWord> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${LOCAL_API_BASE}/words`, {
    method: 'POST',
    headers,
    body: JSON.stringify(word)
  })
  if (!response.ok) {
    throw buildHttpError('Failed to add word', response.status)
  }
  return response.json()
}

// Delete a word
const deleteWord = async (wordId: number, token: string | null): Promise<void> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${LOCAL_API_BASE}/words/${wordId}`, {
    method: 'DELETE',
    headers
  })
  if (!response.ok) {
    throw buildHttpError('Failed to delete word', response.status)
  }
}

// Toggle star on a word
const toggleStar = async (wordId: number, starred: boolean, token: string | null): Promise<void> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${LOCAL_API_BASE}/words/${wordId}/star`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ starred })
  })
  if (!response.ok) {
    throw buildHttpError('Failed to toggle star', response.status)
  }
}

export function useWords(userId: string, token: string | null) {
  const queryClient = useQueryClient()

  // Main words query with caching
  const wordsQuery = useQuery({
    queryKey: ['words', userId],
    queryFn: () => fetchWords(userId, token),
    enabled: !!userId,
    staleTime: 60_000, // 1 minute - data is fresh for this long
    gcTime: 300_000, // 5 minutes - keep in cache
    placeholderData: (prev) => prev,
    retry: (failureCount, error) => {
      const status = (error as HttpError)?.status
      if (status && status >= 400 && status < 500) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
  })

  // Add word mutation
  const addMutation = useMutation({
    mutationFn: (word: Parameters<typeof addWord>[0]) => addWord(word, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words', userId] })
    }
  })

  // Delete word mutation
  const deleteMutation = useMutation({
    mutationFn: (wordId: number) => deleteWord(wordId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words', userId] })
    }
  })

  // Star toggle mutation
  const starMutation = useMutation({
    mutationFn: ({ wordId, starred }: { wordId: number; starred: boolean }) => 
      toggleStar(wordId, starred, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['words', userId] })
    }
  })

  return {
    words: wordsQuery.data ?? [],
    isLoading: wordsQuery.isLoading,
    error: wordsQuery.error,
    refetch: wordsQuery.refetch,
    addWord: addMutation.mutate,
    isAdding: addMutation.isPending,
    deleteWord: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    toggleStar: (wordId: number, starred: boolean) => starMutation.mutate({ wordId, starred }),
    isStarring: starMutation.isPending,
  }
}
