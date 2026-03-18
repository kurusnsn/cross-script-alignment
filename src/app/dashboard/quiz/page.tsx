"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTheme } from "@/hooks/useTheme"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Clock, Trophy, RefreshCw, Play, AlertCircle, Brain, Sparkles } from "lucide-react"
import { useQuizSession } from "@/hooks/useQuiz"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuthStore } from "@/store/useAuthStore"
import { Logo } from "@/components/Logo"


const quizTypes = [
  {
    id: "mcq",
    title: "Multiple Choice",
    description: "Choose the correct aligneration",
    icon: "🤔",
  },
  {
    id: "fill",
    title: "Fill in the Blanks",
    description: "Complete the missing parts",
    icon: "✏️",
  },
  {
    id: "match",
    title: "Matching",
    description: "Match original text with aligneration",
    icon: "🔗",
  },
]

const LANGUAGE_OPTIONS = [
  { label: "All Languages", value: "all" },
  { label: "🇮🇷 Persian (فارسی)", value: "fa" },
  { label: "🇸🇦 Arabic (العربية)", value: "ar" },
  { label: "🇵🇰 Urdu (اردو)", value: "ur" },
  { label: "🇮🇳 Hindi (हिन्दी)", value: "hi" },
  { label: "🇷🇺 Russian (Русский)", value: "ru" },
  { label: "🇯🇵 Japanese (日本語)", value: "ja" },
  { label: "🇰🇷 Korean (한국어)", value: "ko" },
  { label: "🇨🇳 Chinese (中文)", value: "zh" },
]

const LANGUAGE_LABELS = Object.fromEntries(
  LANGUAGE_OPTIONS.map(option => [option.value, option.label])
)

export default function QuizPage() {
  const { user, token, isAuthenticated } = useAuthStore()
  const [currentQuiz, setCurrentQuiz] = useState<'mcq' | 'fill' | 'match'>("mcq")
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all")
  const [selectedFolder, setSelectedFolder] = useState<string>("all")
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [resultMessage, setResultMessage] = useState("")
  const [fillAnswer, setFillAnswer] = useState("")
  const [showHint, setShowHint] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [matchConnections, setMatchConnections] = useState<Map<number, number>>(new Map())
  const [activeLeftId, setActiveLeftId] = useState<number | null>(null)
  const [activeRightId, setActiveRightId] = useState<number | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [availableFolders, setAvailableFolders] = useState<string[]>([])
  const [isLoadingLangs, setIsLoadingLangs] = useState(true)

  // Claude-inspired theme (matching aligneration page)
  const isDarkMode = useTheme()
  const theme = isDarkMode ? {
    bg: '#262624',
    text: '#FAF9F5',
    accent: '#2DD4BF',
    border: '#404040',
    card: '#2D2D2D',
    codeBg: '#0D0D0D',
    muted: 'rgba(250, 249, 245, 0.5)',
    success: '#22c55e',
    error: '#ef4444'
  } : {
    bg: '#F9F9F8',
    text: '#1D1D1B',
    accent: '#2DD4BF',
    border: '#D8D8D5',
    card: '#FFFFFF',
    codeBg: '#F0F0EE',
    muted: 'rgba(29, 29, 27, 0.5)',
    success: '#16a34a',
    error: '#dc2626'
  }

  // Fetch available languages from user's words
  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      if (!isAuthenticated) setIsLoadingLangs(false)
      return
    }

    void (async () => {
      try {
        const response = await fetch('/api/words', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (response.ok) {
          const words = await response.json()
          const langs = Array.from(new Set(words.map((w: any) => w.language_code))).filter(Boolean)
          const folders = Array.from(new Set(words.map((w: any) => w.folder))).filter(Boolean)
          setAvailableLanguages(langs as string[])
          setAvailableFolders(folders as string[])
        }
      } catch (error) {
        console.error('Failed to fetch languages:', error)
      } finally {
        setIsLoadingLangs(false)
      }
    })()
  }, [user, token, isAuthenticated])

  useEffect(() => {
    if (selectedLanguage !== "all" && !availableLanguages.includes(selectedLanguage)) {
      setSelectedLanguage("all")
    }
  }, [availableLanguages, selectedLanguage])

  useEffect(() => {
    if (selectedFolder !== "all" && !availableFolders.includes(selectedFolder)) {
      setSelectedFolder("all")
    }
  }, [availableFolders, selectedFolder])

  const languageOptions = useMemo(() => {
    const sorted = [...availableLanguages].sort()
    return [
      { label: "All Languages", value: "all" },
      ...sorted.map((code) => ({
        value: code,
        label: LANGUAGE_LABELS[code] ?? code.toUpperCase()
      }))
    ]
  }, [availableLanguages])

  const folderOptions = useMemo(() => {
    const sorted = [...availableFolders].sort()
    return [
      { label: "All Words", value: "all" },
      ...sorted.map((folder) => ({
        value: folder,
        label: folder
      }))
    ]
  }, [availableFolders])

  // Use the quiz session hook
  const {
    question,
    isLoadingQuestion,
    questionError,
    getNextQuestion,
    submitSessionAnswer,
    resetSession,
    sessionStats,
    accuracy,
    stats
  } = useQuizSession(
    user?.id?.toString() || "", 
    token, 
    selectedLanguage === "all" ? undefined : selectedLanguage, 
    currentQuiz,
    selectedFolder === "all" ? undefined : selectedFolder
  )

  useEffect(() => {
    setShowHint(false)
    setShowSolution(false)
    setMatchConnections(new Map())
    setActiveLeftId(null)
    setActiveRightId(null)
  }, [question, currentQuiz])

  const handleMCQAnswer = (selectedOption: string) => {
    if (showResult || isTransitioning || !question) return

    setSelectedAnswer(selectedOption)
    setShowResult(true)

    const isCorrect = selectedOption === question.answer
    setResultMessage(isCorrect ? "Correct! Well done!" : `Incorrect. The answer is: ${question.answer}`)

    // Submit the answer
    submitSessionAnswer(selectedOption)

    // Auto advance to next question after showing result
    setIsTransitioning(true)
    setTimeout(() => {
      setSelectedAnswer(null)
      setShowResult(false)
      setResultMessage("")
      getNextQuestion()
      // Brief cooldown to prevent stale click events from registering
      setTimeout(() => setIsTransitioning(false), 300)
    }, 2500)
  }

  const handleFillAnswer = () => {
    if (showResult || isTransitioning || !question) return

    setShowResult(true)
    const isCorrect = fillAnswer.trim().toLowerCase() === question.answer.toLowerCase()
    setResultMessage(isCorrect ? "Correct! Well done!" : `Incorrect. The answer is: ${question.answer}`)

    submitSessionAnswer(fillAnswer)

    setIsTransitioning(true)
    setTimeout(() => {
      setFillAnswer("")
      setShowHint(false)
      setShowSolution(false)
      setShowResult(false)
      setResultMessage("")
      getNextQuestion()
      setTimeout(() => setIsTransitioning(false), 300)
    }, 2500)
  }

  const setMatch = (leftId: number, rightId: number) => {
    setMatchConnections((prev) => {
      const next = new Map(prev)

      // A right-side item can only belong to one left-side item.
      for (const [existingLeftId, existingRightId] of next.entries()) {
        if (existingLeftId !== leftId && existingRightId === rightId) {
          next.delete(existingLeftId)
          break
        }
      }

      next.set(leftId, rightId)
      return next
    })
  }

  const handleMatchLeftClick = (leftId: number) => {
    if (showResult || isTransitioning) return

    if (activeRightId !== null) {
      setMatch(leftId, activeRightId)
      setActiveRightId(null)
      setActiveLeftId(null)
      return
    }

    setActiveLeftId((prev) => (prev === leftId ? null : leftId))
  }

  const handleMatchRightClick = (rightId: number) => {
    if (showResult || isTransitioning) return

    if (activeLeftId !== null) {
      setMatch(activeLeftId, rightId)
      setActiveLeftId(null)
      setActiveRightId(null)
      return
    }

    setActiveRightId((prev) => (prev === rightId ? null : rightId))
  }

  const clearMatches = () => {
    if (showResult || isTransitioning) return
    setMatchConnections(new Map())
    setActiveLeftId(null)
    setActiveRightId(null)
  }

  const handleMatchSubmit = () => {
    if (showResult || isTransitioning || !question || !question.left_column) return

    // Check if all connections are made
    if (matchConnections.size !== question.left_column.length) {
      alert('Please match all items before submitting!')
      return
    }

    // Check correctness
    let correct = 0
    matchConnections.forEach((rightId, leftId) => {
      if (leftId === rightId) correct++
    })

    const isCorrect = correct === question.left_column.length
    setShowResult(true)
    setResultMessage(isCorrect ? "Perfect! All matches correct!" : `You got ${correct}/${question.left_column.length} correct.`)

    submitSessionAnswer(isCorrect ? "correct" : "incorrect")

    setIsTransitioning(true)
    setTimeout(() => {
      setMatchConnections(new Map())
      setActiveLeftId(null)
      setActiveRightId(null)
      setShowResult(false)
      setResultMessage("")
      getNextQuestion()
      setTimeout(() => setIsTransitioning(false), 300)
    }, 3000)
  }

  const resetQuiz = () => {
    resetSession()
    setSelectedAnswer(null)
    setShowResult(false)
    setResultMessage("")
    setFillAnswer("")
    setShowHint(false)
    setShowSolution(false)
    setMatchConnections(new Map())
    setActiveLeftId(null)
    setActiveRightId(null)
    setIsTransitioning(false)
  }

  // Audio playback function (for data URIs from TTS cache)
  const playAudio = (audioUrl?: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play().catch(console.error)
    }
  }

  if (!isAuthenticated && !isLoadingLangs && process.env.NODE_ENV !== "development") {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Brain className="h-12 w-12 text-[#9CA3AF] opacity-20" />
        <h2 className="text-xl font-semibold">Ready to master a new language?</h2>
        <p className="text-[#9CA3AF] text-center max-w-sm">Sign in to start practicing with personalized quizzes based on your alignerations.</p>
      </div>
    )
  }

  // Helper to check if language is English
  const isEnglish = (langCode: string) => {
    return langCode?.toLowerCase().startsWith('en')
  }

  return (
    <div 
      className="min-h-screen p-8 space-y-6"
      style={{ 
        backgroundColor: theme.bg, 
        color: theme.text,
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '17px',
        lineHeight: '1.6',
        letterSpacing: '-0.012em'
      }}
    >
      {/* Page Header */}
      <div className="mb-8 pb-4 border-b" style={{ borderColor: theme.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Quiz</h1>
              <p className="text-sm" style={{ color: theme.muted }}>
                Test your aligneration knowledge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Filter */}
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger 
                className="w-[180px] border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              >
                <SelectValue placeholder="All Languages" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Folder Filter */}
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger
                className="w-[180px] border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              >
                <SelectValue placeholder="All Words" />
              </SelectTrigger>
              <SelectContent>
                {folderOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge 
              variant="outline" 
              className="px-3 py-1"
              style={{ borderColor: theme.accent, color: theme.accent }}
              data-testid="quiz-score"
            >
              <Trophy className="h-3 w-3 mr-1" />
              {sessionStats.correct}/{sessionStats.total}
            </Badge>
            
            {stats && (
              <Badge 
                variant="outline"
                className="px-3 py-1"
                style={{ borderColor: theme.border, color: theme.text }}
              >
                {stats.accuracy.toFixed(1)}%
              </Badge>
            )}
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetQuiz}
              style={{ color: theme.text }}
              data-testid="quiz-reset"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Quiz Selection Sidebar */}
        <div className="space-y-4">
          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: theme.card }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: theme.muted }}>Quiz Types</h3>
            <div className="space-y-2">
              {quizTypes.map((type) => (
                <button
                  key={type.id}
                  className="w-full text-left p-3 rounded-lg transition-all"
                  style={{ 
                    backgroundColor: currentQuiz === type.id ? theme.accent : theme.codeBg,
                    color: currentQuiz === type.id ? '#0E0E0D' : theme.text
                  }}
                  onClick={() => {
                    setCurrentQuiz(type.id as any)
                    resetQuiz()
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span className="font-medium">{type.title}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ opacity: 0.7 }}>
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: theme.card }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: theme.muted }}>Progress</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Session</span>
                <span>{sessionStats.total} answered</span>
              </div>
              <div 
                className="w-full rounded-full h-2"
                style={{ backgroundColor: theme.codeBg }}
              >
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ 
                    width: `${accuracy}%`,
                    backgroundColor: theme.accent 
                  }}
                />
              </div>
              <div className="text-xs text-center" style={{ color: theme.muted }}>
                Accuracy: {accuracy.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Error states */}
          {questionError && (
            <Alert 
              className="border-0"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: theme.error }}
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {questionError.message.toLowerCase().includes('folder') ? (
                  <div className="space-y-2">
                    <p>{questionError.message}</p>
                    <p className="text-xs" style={{ color: theme.muted }}>
                      Try another folder or add words to this folder.
                    </p>
                  </div>
                ) : questionError.message.includes('No words found') ? (
                  <div className="space-y-2">
                    <p>No words available for quiz. Please star some words first!</p>
                    <p className="text-xs" style={{ color: theme.muted }}>
                      Go to Words and star a few, then return to start a quiz.
                    </p>
                  </div>
                ) : (
                  questionError.message
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Loading state */}
          {isLoadingQuestion && (
            <div 
              className="rounded-xl p-12 text-center"
              style={{ backgroundColor: theme.card }}
            >
              <div className="flex items-center justify-center gap-2">
                <div 
                  className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: theme.accent }}
                />
                <span style={{ color: theme.muted }}>Loading question...</span>
              </div>
            </div>
          )}

          {/* MCQ Quiz */}
          {currentQuiz === 'mcq' && question && !isLoadingQuestion && question.options && (
            <div 
              className="rounded-xl p-6 space-y-4"
              style={{ backgroundColor: theme.card }}
            >
              <div className="flex items-center justify-between">
                <Badge 
                  style={{ backgroundColor: theme.codeBg, color: theme.accent }}
                >
                  {question.language_code}
                </Badge>
                <div className="flex items-center gap-2">
                  {question.audio_url && !isEnglish(question.language_code) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playAudio(question.audio_url)}
                      style={{ color: theme.text }}
                      data-testid="quiz-audio"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="flex items-center gap-1 text-sm" style={{ color: theme.muted }}>
                    <Clock className="h-4 w-4" />
                    <span>Question</span>
                  </div>
                </div>
              </div>
              
              <h2 className="text-xl font-semibold" data-testid="quiz-question">
                {question.question}
              </h2>

              <div className="space-y-3">
                {question.options.map((option: string, index: number) => (
                  <button
                    key={index}
                    className="w-full text-left p-4 rounded-lg transition-all flex items-center gap-3"
                    style={{
                      backgroundColor: showResult
                        ? option === question.answer
                          ? 'rgba(34, 197, 94, 0.2)'
                          : selectedAnswer === option
                          ? 'rgba(239, 68, 68, 0.2)'
                          : theme.codeBg
                        : selectedAnswer === option
                        ? theme.accent
                        : theme.codeBg,
                      color: showResult
                        ? option === question.answer
                          ? theme.success
                          : selectedAnswer === option
                          ? theme.error
                          : theme.text
                        : selectedAnswer === option
                        ? '#0E0E0D'
                        : theme.text,
                      borderWidth: '1px',
                      borderColor: showResult && option === question.answer ? theme.success : 'transparent'
                    }}
                    onClick={() => handleMCQAnswer(option)}
                    disabled={showResult}
                    data-testid="quiz-option"
                  >
                    <span className="font-mono text-sm" style={{ opacity: 0.5 }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {showResult && option === question.answer && (
                      <CheckCircle className="h-5 w-5" />
                    )}
                    {showResult && selectedAnswer === option && option !== question.answer && (
                      <XCircle className="h-5 w-5" />
                    )}
                  </button>
                ))}
              </div>

              {/* Feedback */}
              {showResult && (
                <div 
                  className="p-4 rounded-lg text-center font-medium"
                  style={{
                    backgroundColor: selectedAnswer === question.answer 
                      ? 'rgba(34, 197, 94, 0.1)' 
                      : 'rgba(239, 68, 68, 0.1)',
                    color: selectedAnswer === question.answer ? theme.success : theme.error
                  }}
                  data-testid="quiz-feedback"
                >
                  {resultMessage}
                </div>
              )}
            </div>
          )}

          {/* Fill in Blanks Quiz */}
          {currentQuiz === 'fill' && question && !isLoadingQuestion && (
            <div 
              className="rounded-xl p-6 space-y-4"
              style={{ backgroundColor: theme.card }}
            >
              <div className="flex items-center justify-between">
                <Badge style={{ backgroundColor: theme.codeBg, color: theme.accent }}>
                  {question.language_code}
                </Badge>
              </div>
              
              <h2 className="text-xl font-semibold">{question.question}</h2>

              <div className="flex flex-wrap gap-2">
                {question.hint && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHint((prev) => !prev)}
                    disabled={showResult}
                    style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.codeBg }}
                  >
                    {showHint ? "Hide Hint" : "Show Hint"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSolution((prev) => !prev)}
                  disabled={showResult}
                  style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.codeBg }}
                >
                  {showSolution ? "Hide Solution" : "Show Solution"}
                </Button>
              </div>

              {showHint && question.hint && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: theme.codeBg, color: theme.muted }}>
                  {question.hint}
                </div>
              )}

              {showSolution && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: 'rgba(45, 212, 191, 0.1)', color: theme.text }}>
                  <span style={{ color: theme.accent }}>Solution:</span>{" "}
                  <span className="font-mono">{question.answer}</span>
                </div>
              )}

              {/* Blanked text display */}
              <div 
                className="p-4 rounded-lg text-lg font-mono text-center"
                style={{ backgroundColor: theme.codeBg }}
              >
                {question.blanked_text}
              </div>

              {/* Input field */}
              <div className="space-y-2">
                <Label style={{ color: theme.muted }}>Your Answer:</Label>
                <Input
                  value={fillAnswer}
                  onChange={(e) => setFillAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !showResult && handleFillAnswer()}
                  placeholder="Type the complete aligneration..."
                  disabled={showResult}
                  className="text-lg border-0"
                  style={{ backgroundColor: theme.codeBg, color: theme.text }}
                />
              </div>

              <Button
                onClick={handleFillAnswer}
                disabled={showResult || !fillAnswer.trim()}
                className="w-full"
                style={{ 
                  backgroundColor: theme.accent, 
                  color: '#0E0E0D',
                  opacity: showResult || !fillAnswer.trim() ? 0.5 : 1
                }}
              >
                Submit Answer
              </Button>

              {/* Feedback */}
              {showResult && (
                <div 
                  className="p-4 rounded-lg text-center font-medium"
                  style={{
                    backgroundColor: fillAnswer.trim().toLowerCase() === question.answer.toLowerCase()
                      ? 'rgba(34, 197, 94, 0.1)' 
                      : 'rgba(239, 68, 68, 0.1)',
                    color: fillAnswer.trim().toLowerCase() === question.answer.toLowerCase() 
                      ? theme.success 
                      : theme.error
                  }}
                >
                  {resultMessage}
                </div>
              )}
            </div>
          )}

          {/* Matching Quiz */}
          {currentQuiz === 'match' && question && question.left_column && question.right_column && !isLoadingQuestion && (
            <div 
              className="rounded-xl p-6 space-y-4"
              style={{ backgroundColor: theme.card }}
            >
              <h2 className="text-xl font-semibold">{question.question}</h2>
              <p className="text-sm" style={{ color: theme.muted }}>
                Select either side first, then click its pair on the other side
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* Left column */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: theme.muted }}>Original</Label>
                  {question.left_column.map((item: { id: number; text: string }) => (
                    <button
                      key={item.id}
                      className="w-full text-left p-3 rounded-lg transition-all border"
                      style={{
                        backgroundColor: activeLeftId === item.id
                          ? 'rgba(45, 212, 191, 0.25)'
                          : matchConnections.has(item.id)
                          ? 'rgba(45, 212, 191, 0.12)'
                          : theme.codeBg,
                        color: theme.text,
                        borderColor: activeLeftId === item.id
                          ? theme.accent
                          : matchConnections.has(item.id)
                          ? 'rgba(45, 212, 191, 0.45)'
                          : 'transparent'
                      }}
                      onClick={() => handleMatchLeftClick(item.id)}
                      disabled={showResult || isTransitioning}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{item.text}</span>
                        {matchConnections.has(item.id) && (
                          <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: theme.accent, backgroundColor: 'rgba(45, 212, 191, 0.15)' }}>
                            matched
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right column */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold" style={{ color: theme.muted }}>Transliteration</Label>
                  {question.right_column.map((item: { id: number; text: string }) => (
                    <button
                      key={item.id}
                      className="w-full text-left p-3 rounded-lg transition-all border"
                      style={{
                        backgroundColor: activeRightId === item.id
                          ? 'rgba(45, 212, 191, 0.25)'
                          : Array.from(matchConnections.values()).includes(item.id)
                          ? 'rgba(45, 212, 191, 0.12)'
                          : theme.codeBg,
                        color: theme.text,
                        borderColor: activeRightId === item.id
                          ? theme.accent
                          : Array.from(matchConnections.values()).includes(item.id)
                          ? 'rgba(45, 212, 191, 0.45)'
                          : 'transparent'
                      }}
                      onClick={() => handleMatchRightClick(item.id)}
                      disabled={showResult || isTransitioning}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{item.text}</span>
                        {Array.from(matchConnections.values()).includes(item.id) && (
                          <span className="text-[11px] px-2 py-0.5 rounded" style={{ color: theme.accent, backgroundColor: 'rgba(45, 212, 191, 0.15)' }}>
                            matched
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-center" style={{ color: theme.muted }}>
                Matched: {matchConnections.size}/{question.left_column.length}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearMatches}
                  disabled={showResult || isTransitioning || matchConnections.size === 0}
                  style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.codeBg }}
                >
                  Clear Matches
                </Button>
                <Button
                  onClick={handleMatchSubmit}
                  disabled={showResult || isTransitioning || matchConnections.size !== question.left_column.length}
                  className="flex-1"
                  style={{ 
                    backgroundColor: theme.accent, 
                    color: '#0E0E0D',
                    opacity: showResult || isTransitioning || matchConnections.size !== question.left_column.length ? 0.5 : 1
                  }}
                >
                  Submit Matches
                </Button>
              </div>

              {/* Feedback */}
              {showResult && (
                <div 
                  className="p-4 rounded-lg text-center font-medium"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6'
                  }}
                >
                  {resultMessage}
                </div>
              )}
            </div>
          )}

          {/* Empty/No question state */}
          {!question && !isLoadingQuestion && !questionError && (
            <div 
              className="rounded-xl p-12 text-center"
              style={{ backgroundColor: theme.card }}
            >
              <Sparkles className="mx-auto h-12 w-12 mb-4" style={{ color: theme.accent }} />
              <p className="text-lg mb-2" style={{ color: theme.muted }}>
                Ready to test your knowledge?
              </p>
              <p className="text-sm" style={{ color: theme.muted }}>
                Select a quiz type and start learning!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
