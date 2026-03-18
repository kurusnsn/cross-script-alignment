"use client"

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const LOCAL_API_BASE = '/api'

// Types for quiz system
export interface QuizQuestion {
  question: string
  options?: string[] // For MCQ
  answer: string
  audio_url?: string
  word_id: number
  language_code: string
  type?: string
  // Fill-in-blank fields
  blanked_text?: string
  blanked_words?: string[]
  hint?: string
  // Matching fields
  left_column?: Array<{ id: number; text: string }>
  right_column?: Array<{ id: number; text: string }>
}

export interface QuizAnswer {
  user_id: string
  word_id: number
  correct: boolean
  selected_option?: string
}

export interface QuizStats {
  total_questions: number
  correct_answers: number
  accuracy: number
  recent_accuracy: number
  words_learned: number
}

// API functions
const fetchQuizQuestion = async (
  token: string,
  lang?: string,
  type: 'mcq' | 'fill' | 'match' = 'mcq',
  folder?: string
): Promise<QuizQuestion> => {
  const params = new URLSearchParams({
    type
  })

  if (lang) {
    params.append('lang', lang)
  }

  if (folder) {
    params.append('folder', folder)
  }

  const response = await fetch(`${LOCAL_API_BASE}/quiz/next?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.detail || 'Failed to fetch quiz question')
  }
  return response.json()
}

const submitQuizAnswer = async (answer: QuizAnswer, token: string): Promise<{ success: boolean; result_id: number; message: string }> => {
  const response = await fetch(`${LOCAL_API_BASE}/quiz/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(answer),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.detail || 'Failed to submit answer')
  }
  return response.json()
}

const fetchQuizStats = async (token: string): Promise<QuizStats> => {
  const response = await fetch(`${LOCAL_API_BASE}/quiz/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.detail || 'Failed to fetch quiz stats')
  }
  return response.json()
}

const syncWords = async (token: string): Promise<{ success: boolean; synced_count: number; message: string }> => {
  const response = await fetch(`${LOCAL_API_BASE}/quiz/sync-words`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({}),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.detail || 'Failed to sync words')
  }
  return response.json()
}

// Main quiz hook
export function useQuiz(
  userId: string,
  token: string | null,
  language?: string,
  type: 'mcq' | 'fill' | 'match' = 'mcq',
  folder?: string
) {
  const queryClient = useQueryClient()

  // Fetch next question - no caching, always fresh
  const questionQuery = useQuery({
    queryKey: ['quiz', 'question', userId, language, type, folder],
    queryFn: () => fetchQuizQuestion(token!, language, type, folder),
    enabled: !!userId && !!token,
    retry: false, // Don't retry if no words available
    staleTime: 0, // Always refetch
    gcTime: 60_000, // Keep in cache 1 min for back navigation
  })

  // Submit answer mutation
  const answerMutation = useMutation({
    mutationFn: (answer: QuizAnswer) => submitQuizAnswer(answer, token!),
    onSuccess: () => {
      // Keep question progression controlled by the UI (useQuizSession/page timeout).
      // Invalidating here can fetch the next question too early and cause skipped/stale state.
      queryClient.invalidateQueries({ queryKey: ['quiz', 'stats'] })
    },
  })

  // Sync words mutation
  const syncWordsMutation = useMutation({
    mutationFn: () => syncWords(token!),
    onSuccess: () => {
      // Refetch question after syncing words
      queryClient.invalidateQueries({ queryKey: ['quiz', 'question'] })
    },
  })

  // Stats query with caching
  const statsQuery = useQuery({
    queryKey: ['quiz', 'stats', userId],
    queryFn: () => fetchQuizStats(token!),
    enabled: !!userId && !!token,
    staleTime: 120_000, // 2 minutes - stats don't change rapidly
    gcTime: 300_000, // 5 minutes cache
  })

  // Helper function to get next question
  const getNextQuestion = useCallback(() => {
    questionQuery.refetch()
  }, [questionQuery])

  // Helper function to submit answer
  const submitAnswer = useCallback((wordId: number, selectedOption: string, correctAnswer: string) => {
    const correct = selectedOption === correctAnswer
    answerMutation.mutate({
      user_id: userId,
      word_id: wordId,
      correct,
      selected_option: selectedOption
    })
  }, [userId, answerMutation])

  return {
    // Current question data
    question: questionQuery.data,
    isLoadingQuestion: questionQuery.isLoading,
    questionError: questionQuery.error,

    // Answer submission
    submitAnswer,
    isSubmittingAnswer: answerMutation.isPending,
    answerResult: answerMutation.data,
    answerError: answerMutation.error,

    // Stats
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    statsError: statsQuery.error,

    // Word sync
    syncWords: () => syncWordsMutation.mutate(),
    isSyncingWords: syncWordsMutation.isPending,
    syncResult: syncWordsMutation.data,
    syncError: syncWordsMutation.error,

    // Actions
    getNextQuestion,
    refetchStats: statsQuery.refetch,

    // Combined loading state
    isLoading: questionQuery.isLoading || answerMutation.isPending,
  }
}

// Quiz session hook for managing quiz state
export function useQuizSession(
  userId: string,
  token: string | null,
  language?: string,
  type: 'mcq' | 'fill' | 'match' = 'mcq',
  folder?: string
) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Array<{ wordId: number; selected: string; correct: string; isCorrect: boolean }>>([])
  const [sessionStats, setSessionStats] = useState({ correct: 0, total: 0 })

  const quiz = useQuiz(userId, token, language, type, folder)

  const submitSessionAnswer = useCallback((selectedOption: string) => {
    if (!quiz.question) return

    const isCorrect = selectedOption === quiz.question.answer
    const newAnswer = {
      wordId: quiz.question.word_id,
      selected: selectedOption,
      correct: quiz.question.answer,
      isCorrect
    }

    setAnswers(prev => [...prev, newAnswer])
    setSessionStats(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))
    setCurrentQuestionIndex(prev => prev + 1)

    // Submit to backend
    quiz.submitAnswer(quiz.question.word_id, selectedOption, quiz.question.answer)
  }, [quiz])

  const resetSession = useCallback(() => {
    setCurrentQuestionIndex(0)
    setAnswers([])
    setSessionStats({ correct: 0, total: 0 })
    quiz.getNextQuestion()
  }, [quiz])

  return {
    ...quiz,
    currentQuestionIndex,
    answers,
    sessionStats,
    submitSessionAnswer,
    resetSession,
    accuracy: sessionStats.total > 0 ? (sessionStats.correct / sessionStats.total) * 100 : 0
  }
}
