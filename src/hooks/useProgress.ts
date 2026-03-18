"use client"

import { useQuery } from '@tanstack/react-query'

const LOCAL_API_BASE = '/api'
type HttpError = Error & { status?: number }

const buildHttpError = (message: string, status: number): HttpError => {
  const error = new Error(message) as HttpError
  error.status = status
  return error
}

const buildAuthHeaders = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {}

export interface ProgressStats {
  totalWords: number
  averageAccuracy: number
  currentStreak: number
  totalLanguages: number
  totalQuestions: number
  correctAnswers: number
  weeklyActivity: Array<{
    day: string
    alignerations: number
    quizzes: number
    voiceChat: number
  }>
  monthlyTrend: Array<{
    month: string
    accuracy: number
  }>
  languageDistribution: Array<{
    name: string
    value: number
    color: string
  }>
}

export interface Achievement {
  title: string
  description: string
  earned: boolean
  date?: string | null
  icon: string
  progress?: number
  total?: number
}

// Fetch progress stats
const fetchProgressStats = async (token: string | null, language?: string): Promise<ProgressStats> => {
  const params = new URLSearchParams()
  if (language) params.set('lang', language)
  const url = params.toString()
    ? `${LOCAL_API_BASE}/progress/stats?${params.toString()}`
    : `${LOCAL_API_BASE}/progress/stats`

  const response = await fetch(url, { headers: buildAuthHeaders(token) })
  if (!response.ok) {
    throw buildHttpError('Failed to fetch progress stats', response.status)
  }
  return response.json()
}

// Fetch achievements
const fetchAchievements = async (token: string | null): Promise<Achievement[]> => {
  const response = await fetch(`${LOCAL_API_BASE}/progress/achievements`, {
    headers: buildAuthHeaders(token),
  })
  if (!response.ok) {
    throw buildHttpError('Failed to fetch achievements', response.status)
  }
  const data = await response.json()
  return data.achievements
}

export function useProgress(userId: string | undefined, token: string | null, language?: string) {
  // Progress stats query
  const statsQuery = useQuery({
    queryKey: ['progress', 'stats', userId, language],
    queryFn: () => fetchProgressStats(token, language),
    enabled: !!userId,
    staleTime: 120_000, // 2 minutes - progress data changes less frequently
    gcTime: 600_000, // 10 minutes cache
    retry: (failureCount, error) => {
      const status = (error as HttpError)?.status
      if (status && status >= 400 && status < 500) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
  })

  // Achievements query
  const achievementsQuery = useQuery({
    queryKey: ['progress', 'achievements', userId],
    queryFn: () => fetchAchievements(token),
    enabled: !!userId,
    staleTime: 300_000, // 5 minutes - achievements change even less
    gcTime: 600_000,
    retry: (failureCount, error) => {
      const status = (error as HttpError)?.status
      if (status && status >= 400 && status < 500) return false
      return failureCount < 1
    },
    refetchOnWindowFocus: false,
  })

  return {
    stats: statsQuery.data,
    achievements: achievementsQuery.data ?? [],
    isLoading: statsQuery.isLoading || achievementsQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    isLoadingAchievements: achievementsQuery.isLoading,
    error: statsQuery.error || achievementsQuery.error,
    refetch: () => {
      statsQuery.refetch()
      achievementsQuery.refetch()
    }
  }
}
