"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { Copy, ArrowRight, ArrowUp, Star, Eye, Languages, Moon, Sun, SlidersHorizontal, Type, Sparkles, Plus, Paperclip, Image as ImageIcon, Square } from "lucide-react"
import { useTheme } from "@/hooks/useTheme"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import dynamic from "next/dynamic"
import { VanishInput } from "@/components/VanishInput"

const AlignmentViewer = dynamic(() => import("@/components/AlignmentViewer"), {
  loading: () => <div className="w-full h-40 bg-[#2A2A28] animate-pulse rounded-xl" />,
  ssr: false
});

const PlayTTS = dynamic(() => import("@/components/PlayTTS"), {
  ssr: false
});
import FileUploadZone from "@/components/FileUploadZone"
import ExportButton from "@/components/ExportButton"
import AuthModal from "@/components/AuthModal"
import { TokenizedText } from "@/components/TokenizedText"
import { TokenAnnotation } from "@/components/TokenTooltip"
import { Logo } from "@/components/Logo"


const API_BASE = "/api/backend"

const LANGUAGE_OPTIONS = [
  { label: " Auto detect", value: "auto" },
  { label: "🇮🇷 Persian (فارسی)", value: "fa" },
  { label: "🇸🇦 Arabic (العربية)", value: "ar" },
  { label: "🇵🇰 Urdu (اردو)", value: "ur" },
  { label: "🇮🇳 Hindi (हिन्दी)", value: "hi" },
  { label: "🇷🇺 Russian (Русский)", value: "ru" },
  { label: "🇯🇵 Japanese (日本語)", value: "ja" },
  { label: "🇰🇷 Korean (한국어)", value: "ko" },
  { label: "🇨🇳 Chinese (中文)", value: "zh" },
  { label: "🇹🇭 Thai (ไทย)", value: "th" },
  { label: "🇮🇱 Hebrew (עברית)", value: "he" },
  { label: "🇧🇩 Bengali (বাংলা)", value: "bn" },
  { label: "🇪🇸 Spanish (Español)", value: "es" },
  { label: "🇫🇷 French (Français)", value: "fr" },
  { label: "🇺🇸 English", value: "en" },
]

const VANISH_PLACEHOLDERS = [
  "سلام دنیا - Hello World in Persian",
  "مرحبا بالعالم - Hello World in Arabic",
  "ہیلو ورلڈ - Hello World in Urdu",
  "नमस्ते दुनिया - Hello World in Hindi",
  "Привет мир - Hello World in Russian",
  "こんにちは世界 - Hello World in Japanese",
  "안녕하세요 세계 - Hello World in Korean",
  "你好世界 - Hello World in Chinese",
  "สวัสดีโลก - Hello World in Thai",
  "שלום עולם - Hello World in Hebrew",
  "হ্যালো বিশ্ব - Hello World in Bengali",
  "Try typing in any language...",
  "Enter text to see aligneration magic ",
]

const TARGET_LANGUAGE_OPTIONS = [
  { label: "🇺🇸 English", value: "en" },
]

const DEFAULT_TARGET_LANG = "en"

type TranslitResponse = {
  original: string
  aligneration: string
  translation: string
  ipa: string
  original_tokens?: string[]
  align_tokens?: string[]
  translation_tokens?: string[]
  sentences?: SentenceResult[]
  result_json?: any
}

type SentenceResult = {
  original: string
  aligneration: string
  translation: string
  ipa?: string
}

type WordMapping = {
  originalIndex: number
  alignIndex: number
  translationIndex: number[]
}

type LegacyAlignmentResponse = {
  alignments: WordMapping[]
}

type SentenceAlignmentResponse = {
  sentence_alignments: Array<{ mappings: WordMapping[] }>
}

type AlignmentResult = {
  alignment: WordMapping[]
  sentenceAlignments: WordMapping[][]
}

type PhraseAlignment = {
  source: string
  target: string
  sourceSpan: { start: number; end: number }
  targetSpan: { start: number; end: number }
  confidence?: number
  refined?: boolean
}

type WordAlignment = {
  source: string
  target: string
  confidence?: number
  refined?: boolean
}

type LLMAlignmentResponse = {
  original: string
  translation: string
  alignments: PhraseAlignment[]
  phrase_alignments?: PhraseAlignment[]
  word_alignments?: WordAlignment[]
  timing: {
    llm_processing: number
    total: number
  }
  raw_response?: string
}

type ResultItem = {
  id: string
  translationId?: number
  isFavorite?: boolean
  request: {
    text: string
    sourceLang: string
    targetLang: string
  }
  response: TranslitResponse
  alignment?: WordMapping[]
  sentenceAlignments?: WordMapping[][]
  phraseAlignments?: PhraseAlignment[]
  wordAlignments?: WordAlignment[]
  isAligning?: boolean
  createdAt: Date
  folderId?: string
  resultJson?: any
}

const normalizeTokenText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\u200c\u200e\u200f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase()

const tokenizeSentenceText = (text: string, lang?: string): string[] => {
  const input = (text || "").trim()
  if (!input) return []

  const hasWhitespace = /\s/.test(input)
  const normalizedLang = (lang || "").toLowerCase()

  if (!hasWhitespace) {
    if (normalizedLang.startsWith("zh")) {
      return input.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+|[^\s]/g) || [input]
    }
    if (normalizedLang.startsWith("ja")) {
      return input.match(/[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]|[A-Za-z0-9]+|[^\s]/g) || [input]
    }
    if (normalizedLang.startsWith("th")) {
      return input.match(/[\u0E00-\u0E7F]|[A-Za-z0-9]+|[^\s]/g) || [input]
    }
  }

  return input.split(/\s+/).filter((t) => t.length > 0)
}

const normalizeMeaningfulText = (value: string): string =>
  (value || "")
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLowerCase()

const hasMeaningfulTranslation = (original: string, translation: string): boolean => {
  const originalNorm = normalizeMeaningfulText(original)
  const translationNorm = normalizeMeaningfulText(translation)

  if (!translationNorm) return false
  if (!originalNorm) return true
  return translationNorm !== originalNorm
}

const normalizeHistoryMatchText = (value: string): string =>
  (value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

const shouldPersistResultToHistory = (response: TranslitResponse): boolean => {
  const original = response.original?.trim() || ""
  const aligneration = response.aligneration?.trim() || ""
  const translation = response.translation?.trim() || ""

  if (!original || !aligneration || !translation) return false
  return hasMeaningfulTranslation(original, translation)
}

const isLikelyPunctuation = (token?: TokenAnnotation): boolean => {
  if (!token) return false
  if (token.pos === "PUNCT") return true
  return normalizeTokenText(token.text || "").length === 0
}

const charSimilarity = (a: string, b: string): number => {
  if (!a || !b) return 0
  const bChars = new Set(b.split(""))
  let overlap = 0
  for (const char of a) {
    if (bChars.has(char)) overlap += 1
  }
  return overlap / Math.max(a.length, b.length)
}

const findBestSourceTokenIndex = (
  sentenceToken: string,
  sourceTokens: TokenAnnotation[],
  startIndex: number,
  lookahead = 8
): number => {
  if (startIndex >= sourceTokens.length) return -1

  const targetNorm = normalizeTokenText(sentenceToken)
  const endIndex = Math.min(sourceTokens.length, startIndex + lookahead + 1)

  if (!targetNorm) {
    for (let idx = startIndex; idx < endIndex; idx += 1) {
      if (isLikelyPunctuation(sourceTokens[idx])) return idx
    }
    return startIndex
  }

  for (let idx = startIndex; idx < endIndex; idx += 1) {
    const candidate = sourceTokens[idx]
    if (!candidate) continue
    const candidateNorm = normalizeTokenText(candidate.text || "")
    if (!candidateNorm) continue
    if (candidateNorm === targetNorm) {
      return idx
    }
    const minLen = Math.min(candidateNorm.length, targetNorm.length)
    if (
      minLen >= 3 &&
      (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm))
    ) {
      return idx
    }
  }

  let bestIndex = -1
  let bestScore = 0
  for (let idx = startIndex; idx < endIndex; idx += 1) {
    const candidate = sourceTokens[idx]
    if (!candidate) continue
    const candidateNorm = normalizeTokenText(candidate.text || "")
    if (!candidateNorm) continue
    const score = charSimilarity(targetNorm, candidateNorm)
    if (score > bestScore) {
      bestScore = score
      bestIndex = idx
    }
  }

  if (bestIndex >= 0 && bestScore >= 0.6) {
    return bestIndex
  }

  for (let idx = startIndex; idx < sourceTokens.length; idx += 1) {
    if (!isLikelyPunctuation(sourceTokens[idx])) return idx
  }

  return startIndex
}

import { useHistoryStore } from "@/store/useHistoryStore"
import { useHistory } from "@/hooks/useHistory"
import { useAuthStore } from "@/store/useAuthStore"

export default function TransliterationPage() {
  const token = useAuthStore((s) => s.token)
  const {
    selectedHistoryId,
    searchQuery,
    selectedFolderId,
    setSearchQuery,
    setSelectedFolderId
  } = useHistoryStore()

  const {
    folders,
    translations: history,
    refetchHistory,
  } = useHistory()

  // Helper for backward compatibility with existing code
  const getSelectedItem = () => history.find(item => String(item.id) === selectedHistoryId)
  const [inputText, setInputText] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState("auto")
  const [targetLanguage] = useState(DEFAULT_TARGET_LANG)
  const [results, setResults] = useState<ResultItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedResultId, setCopiedResultId] = useState<string | null>(null)
  const copyFeedbackTimeoutRef = useRef<number | null>(null)
  const alignerateAbortRef = useRef<AbortController | null>(null)
  
  // Claude-inspired theme controls
  const isDarkMode = useTheme()
  const [fontPreference] = useState<'serif' | 'sans'>('serif')
  const [letterSpacing, setLetterSpacing] = useState(-0.012)
  
  // Theme configuration
  const theme = {
    light: {
      bg: '#FAF9F5',
      text: '#0E0E0D',
      accent: '#2DD4BF',
      border: '#e8e8e6',
      card: '#ffffff',
      codeBg: '#f5f5f4'
    },
    dark: {
      bg: '#262624',
      text: '#FAF9F5',
      accent: '#2DD4BF',
      border: '#404040',
      card: '#2D2D2D',
      codeBg: '#0D0D0D'
    }
  }
  
  const currentTheme = isDarkMode ? theme.dark : theme.light
  
  const fontStacks = {
    serif: {
      family: '"Georgia", "Iowan Old Style", "Times New Roman", serif',
      size: '17px',
      lineHeight: '1.6'
    },
    sans: {
      family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      size: '17px',
      lineHeight: '1.6'
    }
  }

  const recentHistory = useMemo(() => results.slice(0, 5), [results])
  const mostRecent = useMemo(() => results.at(0), [results])
  const selectedItem = getSelectedItem()


  // When a history item is selected, add it to results for display
  useEffect(() => {
    if (selectedItem && !results.find(r => String(r.id) === String(selectedItem.id))) {
      const selectedAny = selectedItem as any
      const historySentences: SentenceResult[] = Array.isArray(selectedAny?.sentences)
        ? selectedAny.sentences
        : Array.isArray(selectedAny?.result_json?.sentences)
          ? selectedAny.result_json.sentences
          : []
      const historySentenceAlignments: WordMapping[][] = Array.isArray(selectedAny?.sentenceAlignments)
        ? selectedAny.sentenceAlignments
        : Array.isArray(selectedAny?.sentence_alignments)
          ? selectedAny.sentence_alignments.map((entry: any) =>
              Array.isArray(entry?.mappings) ? entry.mappings : Array.isArray(entry) ? entry : []
            )
          : []

      const resultItem: ResultItem = {
        id: String(selectedItem.id),
        translationId: Number(selectedItem.id),
        isFavorite: Boolean(selectedAny.is_favorite),
        request: {
          text: selectedItem.original_text,
          sourceLang: selectedItem.source_language,
          targetLang: selectedItem.target_language,
        },
        response: {
          original: selectedItem.original_text,
          aligneration: selectedItem.aligneration,
          translation: selectedItem.translated_text,
          ipa: "",
          sentences: historySentences,
        },
        alignment: selectedAny.alignment,
        sentenceAlignments: historySentenceAlignments,
        phraseAlignments: selectedAny.phraseAlignments,
        wordAlignments: selectedAny.wordAlignments,
        createdAt: selectedItem.created_at ? new Date(selectedItem.created_at) : new Date(),
        folderId: selectedAny.folder_id ? String(selectedAny.folder_id) : undefined,
        resultJson: selectedAny.result_json,
      }
      setResults([resultItem, ...results])
    }
  }, [selectedItem])

  const fetchAlignment = async (
    originalTokens: string[],
    alignTokens: string[],
    translationTokens: string[],
    originalText: string = "",
    translationText: string = "",
    sentences: SentenceResult[] = []
  ): Promise<AlignmentResult> => {
    const startTime = performance.now()

    const validSentences = Array.isArray(sentences)
      ? sentences.filter((sentence) =>
          Boolean(
            sentence?.original?.trim() ||
            sentence?.aligneration?.trim() ||
            sentence?.translation?.trim()
          )
        )
      : []

    if (validSentences.length > 0) {
      try {
        const response = await fetch(`${API_BASE}/align/align-sentences`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sentences: validSentences,
            k: 3,
          }),
        })

        if (!response.ok) {
          throw new Error(`Sentence alignment request failed: ${response.status}`)
        }

        const data: SentenceAlignmentResponse = await response.json()
        const sentenceAlignments = (data.sentence_alignments || []).map((entry) =>
          Array.isArray(entry?.mappings) ? entry.mappings : []
        )
        return {
          alignment: [],
          sentenceAlignments,
        }
      } catch (sentenceErr) {
        console.warn(" [ALIGNMENT] Sentence alignment failed, falling back to token alignment:", sentenceErr)
      }
    }

    try {
      const response = await fetch(`${API_BASE}/align/align`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          original_tokens: originalTokens,
          align_tokens: alignTokens,
          translation_tokens: translationTokens,
          original_text: originalText,
          translation_text: translationText,
          k: 3
        }),
      })

      if (!response.ok) {
        throw new Error(`Alignment request failed: ${response.status}`)
      }

      const data: LegacyAlignmentResponse = await response.json()

      return {
        alignment: data.alignments || [],
        sentenceAlignments: [],
      }
    } catch (err) {
      const errorTime = performance.now()
      console.error(` [ALIGNMENT] Failed after ${(errorTime - startTime).toFixed(2)}ms:`, err)
      return {
        alignment: [],
        sentenceAlignments: [],
      }
    }
  }

  const fetchLLMAlignments = async (originalText: string, translationText: string): Promise<{phrases: PhraseAlignment[], words: WordAlignment[]}> => {
    const startTime = performance.now()

    try {
      const response = await fetch(`${API_BASE}/align/llm-phrase-align`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_text: originalText,
          target_text: translationText,
        }),
      })

      if (!response.ok) {
        console.warn(` [LLM_ALIGNMENT] Request failed: ${response.status}`)
        return { phrases: [], words: [] }
      }

      const data: LLMAlignmentResponse = await response.json()

      // Convert phrase alignments from backend format to frontend format
      const phraseAlignments = data.alignments?.map((alignment: any) => ({
        source: alignment.source,
        target: alignment.target,
        sourceSpan: { start: 0, end: 0 }, // Will be calculated by AlignmentViewer
        targetSpan: { start: 0, end: 0 }, // Will be calculated by AlignmentViewer
        confidence: alignment.confidence || 0.9,
        refined: alignment.refined || false
      })) || []

      // Convert word alignments from backend format
      const wordAlignments = data.word_alignments?.map((alignment: any) => ({
        source: alignment.source,
        target: alignment.target,
        confidence: alignment.confidence || 0.8,
        refined: alignment.refined || false
      })) || []

      return { phrases: phraseAlignments, words: wordAlignments }
    } catch (err) {
      const errorTime = performance.now()
      console.warn(` [LLM_ALIGNMENT] Failed after ${(errorTime - startTime).toFixed(2)}ms:`, err)
      return { phrases: [], words: [] }
    }
  }

  const handleVanishInputSubmit = (text: string) => {
    setInputText(text);
    handleTransliterate(text);
  };

  const stopActiveTranslation = () => {
    if (alignerateAbortRef.current) {
      alignerateAbortRef.current.abort()
      alignerateAbortRef.current = null
      setIsLoading(false)
      setError("Translation stopped.")
    }
  }

  const persistResultToHistory = async (item: ResultItem): Promise<number | null> => {
    if (!shouldPersistResultToHistory(item.response)) return null

    const storeResponse = await fetch("/api/translations/store", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceLang: item.request.sourceLang || "auto",
        targetLang: item.request.targetLang || DEFAULT_TARGET_LANG,
        originalText: item.response.original,
        aligneration: item.response.aligneration,
        translatedText: item.response.translation,
        wordBreakdown: [],
      }),
    })

    if (storeResponse.status === 401) return null
    if (!storeResponse.ok) return null

    const storePayload = await storeResponse.json()
    const storedTranslationId = Number(storePayload?.translationId)
    if (!storedTranslationId || Number.isNaN(storedTranslationId)) return null
    return storedTranslationId
  }

  const handleFileUploadSuccess = async (uploadResult: any) => {
    // Create a result item from the upload response
    const result: ResultItem = {
      id: `result-${Date.now()}`,
      request: {
        text: uploadResult.extracted_text,
        sourceLang: uploadResult.source_language,
        targetLang: uploadResult.target_language,
      },
      response: {
        original: uploadResult.original,
        aligneration: uploadResult.aligneration,
        translation: uploadResult.translation,
        ipa: uploadResult.ipa,
        original_tokens: uploadResult.original.split(/\s+/).filter((t: string) => t.length > 0),
        align_tokens: uploadResult.aligneration.split(/\s+/).filter((t: string) => t.length > 0),
        translation_tokens: uploadResult.translation.split(/\s+/).filter((t: string) => t.length > 0),
        sentences: Array.isArray(uploadResult.sentences) ? uploadResult.sentences : [],
      },
      sentenceAlignments: [],
      createdAt: new Date(),
    };

    // Optionally fetch alignments for the uploaded file result
    const originalTokens = result.response.original_tokens || [];
    const alignTokens = result.response.align_tokens || [];
    const translationTokens = result.response.translation_tokens || [];

    // Fetch alignment data
    const alignmentResult = await fetchAlignment(
      originalTokens,
      alignTokens,
      translationTokens,
      result.response.original,
      result.response.translation,
      result.response.sentences || []
    );

    // Fetch LLM dual alignments
    const llmAlignments = await fetchLLMAlignments(result.response.original, result.response.translation);

    result.alignment = alignmentResult.alignment;
    result.sentenceAlignments = alignmentResult.sentenceAlignments;
    result.phraseAlignments = llmAlignments.phrases;
    result.wordAlignments = llmAlignments.words;

    // Add to results with a special badge for file uploads
    setResults((prev) => [result, ...prev].slice(0, 10));

    // History is now maintained by the backend
  };

  const handleTransliterate = async (textToTranslate?: string) => {
    const text = textToTranslate || inputText;
    if (!text.trim()) return

    setIsLoading(true)
    setError(null)
    const abortController = new AbortController()
    alignerateAbortRef.current = abortController

    try {
      const payload = {
        text: text,
        source_lang: sourceLanguage === "auto" ? "" : sourceLanguage,
        target_lang: targetLanguage,
        persist: false,
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE}/align`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Request failed: ${response.status}`)
      }

      const data: TranslitResponse = await response.json()
      const sentences = Array.isArray(data.sentences) ? data.sentences : []

      // Use backend tokens if available, otherwise simple tokenization (same as SimAlign)
      const originalTokens = data.original_tokens || data.original.split(/\s+/).filter(t => t.length > 0)
      const alignTokens = data.align_tokens || data.aligneration.split(/\s+/).filter(t => t.length > 0)
      const translationTokens = data.translation_tokens || data.translation.split(/\s+/).filter(t => t.length > 0)

      const resultId = `result-${Date.now()}`

      const result: ResultItem = {
        id: resultId,
        isFavorite: false,
        request: {
          text: text,
          sourceLang: sourceLanguage === "auto" ? "auto" : sourceLanguage,
          targetLang: targetLanguage,
        },
        response: {
          ...data,
          sentences,
        },
        alignment: [],
        sentenceAlignments: [],
        phraseAlignments: [],
        wordAlignments: [],
        isAligning: true,
        createdAt: new Date(),
      }

      setResults((prev) => [result, ...prev].slice(0, 10))

      setInputText("")
      setIsLoading(false)
      const persistPromise = persistResultToHistory(result)

      try {
        const [alignmentResult, llmAlignments, persistedTranslationId] = await Promise.all([
          fetchAlignment(originalTokens, alignTokens, translationTokens, data.original, data.translation, sentences),
          fetchLLMAlignments(data.original, data.translation),
          persistPromise,
        ])

        setResults((prev) =>
          prev.map((item) =>
            item.id === resultId
              ? {
                  ...item,
                  alignment: alignmentResult.alignment,
                  sentenceAlignments: alignmentResult.sentenceAlignments,
                  phraseAlignments: llmAlignments.phrases,
                  wordAlignments: llmAlignments.words,
                  translationId: persistedTranslationId ?? item.translationId,
                  isAligning: false,
                }
              : item
          )
        )

        if (persistedTranslationId) {
          void refetchHistory()
        }
      } catch (alignErr) {
        const persistedTranslationId = await persistPromise.catch(() => null)
        setResults((prev) =>
          prev.map((item) =>
            item.id === resultId
              ? {
                  ...item,
                  translationId: persistedTranslationId ?? item.translationId,
                  isAligning: false,
                }
              : item
          )
        )

        if (persistedTranslationId) {
          void refetchHistory()
        }
      }

    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Translation stopped.")
        return
      }
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      if (alignerateAbortRef.current === abortController) {
        alignerateAbortRef.current = null
      }
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (alignerateAbortRef.current) {
        alignerateAbortRef.current.abort()
      }
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current)
      }
    }
  }, [])

  const copyTextWithFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement("textarea")
    textarea.value = text
    textarea.setAttribute("readonly", "")
    textarea.style.position = "absolute"
    textarea.style.left = "-9999px"
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }

  const buildFullOutputText = (item: ResultItem): string => {
    const translationLine = hasMeaningfulTranslation(item.response.original, item.response.translation)
      ? item.response.translation?.trim()
      : "No meaningful translation available for this input."

    const sections = [
      item.response.original?.trim() ? `Original\n${item.response.original.trim()}` : "",
      item.response.aligneration?.trim() ? `Transliteration\n${item.response.aligneration.trim()}` : "",
      translationLine ? `Translation\n${translationLine}` : "",
      item.response.ipa?.trim() ? `IPA\n${item.response.ipa.trim()}` : "",
    ].filter(Boolean)

    return sections.join("\n\n")
  }

  const handleCopyOutput = async (item: ResultItem) => {
    const textToCopy = buildFullOutputText(item)
    if (!textToCopy) return

    try {
      await copyTextWithFallback(textToCopy)
      setCopiedResultId(item.id)
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current)
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopiedResultId((prev) => (prev === item.id ? null : prev))
      }, 1400)
    } catch (copyErr) {
      console.error("Failed to copy output:", copyErr)
    }
  }

  const findMatchingHistoryTranslationId = (
    historyItems: Array<{
      id: number | string
      original_text: string
      aligneration: string
      translated_text: string
      is_favorite?: boolean
    }>,
    item: ResultItem
  ): { id: number; isFavorite: boolean } | null => {
    const original = normalizeHistoryMatchText(item.response.original)
    const aligneration = normalizeHistoryMatchText(item.response.aligneration)
    const translation = normalizeHistoryMatchText(item.response.translation)

    const match = historyItems.find((historyItem) => {
      return (
        normalizeHistoryMatchText(historyItem.original_text) === original &&
        normalizeHistoryMatchText(historyItem.aligneration) === aligneration &&
        normalizeHistoryMatchText(historyItem.translated_text) === translation
      )
    })

    if (!match) return null
    return {
      id: Number(match.id),
      isFavorite: Boolean(match.is_favorite),
    }
  }

  const handleToggleFavorite = async (item: ResultItem) => {
    try {
      let translationId = item.translationId
      let isFavorite = item.isFavorite ?? false

      if (!translationId) {
        const refreshed = await refetchHistory()
        const refreshedHistory = Array.isArray((refreshed as any)?.data?.translations)
          ? (refreshed as any).data.translations
          : history

        const match = findMatchingHistoryTranslationId(refreshedHistory, item)
        if (match) {
          translationId = match.id
          isFavorite = match.isFavorite
        } else {
          if (!shouldPersistResultToHistory(item.response)) {
            setError("This output cannot be saved because no meaningful translation was generated.")
            return
          }

          // Fallback: persist this output through the app API so it can be starred immediately.
          const storeResponse = await fetch("/api/translations/store", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sourceLang: item.request.sourceLang || "auto",
              targetLang: item.request.targetLang || DEFAULT_TARGET_LANG,
              originalText: item.response.original,
              aligneration: item.response.aligneration,
              translatedText: item.response.translation,
              wordBreakdown: [],
            }),
          })

          if (storeResponse.status === 401) {
            setError("Sign in to star translations in history.")
            return
          }

          if (!storeResponse.ok) {
            const errorText = await storeResponse.text()
            throw new Error(errorText || `Failed to store translation (${storeResponse.status})`)
          }

          const storePayload = await storeResponse.json()
          const storedTranslationId = Number(storePayload?.translationId)

          if (!storedTranslationId || Number.isNaN(storedTranslationId)) {
            throw new Error("Translation was saved but did not return a valid ID")
          }

          translationId = storedTranslationId
          isFavorite = false
        }
      }

      const response = await fetch(`/api/translations/${translationId}/favorite`, {
        method: "POST",
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Failed to update favorite (${response.status})`)
      }

      const payload = await response.json()
      const nextFavorite = typeof payload?.isFavorite === "boolean" ? payload.isFavorite : !isFavorite

      setResults((prev) =>
        prev.map((resultItem) =>
          resultItem.id === item.id
            ? {
                ...resultItem,
                translationId,
                isFavorite: nextFavorite,
              }
            : resultItem
        )
      )

      refetchHistory()
    } catch (favoriteErr) {
      console.error("Failed to toggle favorite:", favoriteErr)
      setError("Could not star this translation right now.")
    }
  }

  return (
    <div className="space-y-6" style={{ 
      backgroundColor: currentTheme.bg, 
      color: currentTheme.text,
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: fontStacks[fontPreference].family,
      fontSize: fontStacks[fontPreference].size,
      lineHeight: fontStacks[fontPreference].lineHeight,
      letterSpacing: `${letterSpacing}em`
    }}>
      {/* Centered Greeting Section - Claude Style */}
      {results.length === 0 && (
        <div className="flex flex-col items-center justify-center pt-20 pb-12">
          <div className="flex items-center gap-4 mb-6">
            {/* TranslitAI Logo */}
            <Logo size={48} />

            {/* Greeting */}
            <h1 className="text-3xl font-medium" style={{ color: currentTheme.text }}>
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return "Good morning";
                if (hour < 18) return "Good afternoon";
                return "Good evening";
              })()}
            </h1>
          </div>
          <p className="text-lg" style={{ color: currentTheme.text, opacity: 0.5 }}>
            What would you like to alignerate today?
          </p>
          <div className="mt-8 flex justify-center">
            <AuthModal />
          </div>
        </div>
      )}

      {/* Input Section - Centered with Max Width */}
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Claude-Style Input Area */}
        <div className="relative">
          <div className="rounded-2xl border transition-colors relative" 
               style={{ 
                 backgroundColor: currentTheme.bg,
                 borderColor: currentTheme.border,
                 borderWidth: '0.5px'
               }}>
            {/* Textarea */}
            <Label htmlFor="main-aligneration-textarea" className="sr-only">Text to alignerate</Label>
            <textarea
              id="main-aligneration-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (isLoading) {
                    stopActiveTranslation()
                    return
                  }
                  if (inputText.trim()) {
                    handleVanishInputSubmit(inputText.trim())
                  }
                }
              }}
              placeholder="Enter text to see aligneration magic"
              className="subtle-scrollbar w-full bg-transparent text-lg leading-relaxed p-4 pr-4 pb-24 sm:pb-16 resize-none focus:outline-none min-h-[140px] max-h-[300px]"
              style={{
                color: currentTheme.text,
                direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(inputText) ? 'rtl' : 'ltr',
                textAlign: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(inputText) ? 'right' : 'left'
              }}
            />

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-3 left-3 right-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* Left side: + button and language selectors */}
              <div className="flex min-w-0 w-full items-center gap-2">
                {/* + Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="h-10 w-10 shrink-0 rounded-lg hover:opacity-80 transition-all flex items-center justify-center"
                      style={{ 
                        backgroundColor: currentTheme.codeBg,
                        color: currentTheme.text 
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuItem onClick={() => document.getElementById('file-upload-input')?.click()}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Add files or photos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const examples = ['سلام چطوری؟', 'مرحبا كيف حالك؟', 'नमस्ते कैसे हैं आप?', 'こんにちは、元気ですか？'];
                      setInputText(examples[Math.floor(Math.random() * examples.length)]);
                    }}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Try example
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  {/* From Language Selector */}
                  <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                    <SelectTrigger
                      className="h-10 w-full min-w-0 rounded-lg border-[0.5px] text-sm !shadow-none"
                      style={{
                        backgroundColor: currentTheme.codeBg,
                        borderColor: currentTheme.border,
                        color: currentTheme.text,
                      }}
                    >
                      <SelectValue placeholder="From" />
                    </SelectTrigger>
                    <SelectContent
                      className="border-[0.5px] !shadow-none"
                      style={{
                        backgroundColor: currentTheme.bg,
                        borderColor: currentTheme.border,
                        color: currentTheme.text,
                      }}
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Arrow Icon */}
                  <ArrowRight className="h-4 w-4 text-[#9CA3AF]" />

                  {/* Fixed Target Language */}
                  <div
                    className="flex h-10 w-full min-w-0 items-center rounded-lg border-[0.5px] px-3 text-sm shadow-none"
                    style={{
                      backgroundColor: currentTheme.codeBg,
                      borderColor: currentTheme.border,
                      color: currentTheme.text,
                    }}
                  >
                    {TARGET_LANGUAGE_OPTIONS[0].label}
                  </div>
                </div>
              </div>

              {/* Right side: Send Button */}
              <button
                onClick={() => {
                  if (isLoading) {
                    stopActiveTranslation()
                    return
                  }
                  if (inputText.trim()) {
                    handleVanishInputSubmit(inputText.trim())
                  }
                }}
                disabled={!isLoading && !inputText.trim()}
                className="flex self-end shrink-0 items-center justify-center rounded-lg p-2.5 transition-all sm:self-auto"
                style={{ 
                  backgroundColor: currentTheme.accent,
                  color: '#0E0E0D',
                  opacity: (!isLoading && !inputText.trim()) ? 0.3 : 1
                }}
              >
                {isLoading ? (
                  <Square size={14} />
                ) : (
                  <ArrowUp size={18} />
                )}
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="mt-2 flex items-center gap-2 pl-2">
              <Logo size={14} className="animate-pulse" />
              <span className="text-xs" style={{ color: currentTheme.text, opacity: 0.65 }}>
                Generating...
              </span>
            </div>
          )}
          
          {/* Hidden File Input */}
          <input
            id="file-upload-input"
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              
              const formData = new FormData()
              formData.append('file', file)
              formData.append('source_lang', sourceLanguage === "auto" ? "" : sourceLanguage)
              formData.append('target_lang', targetLanguage)
              
              try {
                const response = await fetch(`${API_BASE}/upload`, {
                  method: 'POST',
                  body: formData,
                })
                
                if (!response.ok) throw new Error('Upload failed')
                
                const result = await response.json()
                handleFileUploadSuccess(result)
              } catch (err) {
                console.error('Upload error:', err)
              }
              
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="flex w-full min-w-0 max-w-7xl mx-auto gap-8">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Results Section */}
          {results.length > 0 && (
            <div className="min-w-0 space-y-6">
              {results.map((item, index) => {
                const detectedLang =
                  item.resultJson?.meta?.sourceLangGuess ||
                  item.response.result_json?.meta?.sourceLangGuess;
                const resolvedSourceLang =
                  item.request.sourceLang === "auto"
                    ? (detectedLang || "auto")
                    : item.request.sourceLang;
                const ttsSourceLang = resolvedSourceLang === "auto" ? "fa" : resolvedSourceLang;

                const originalTokenList =
                  item.response.original_tokens ||
                  item.response.original.split(/\s+/).filter((t) => t.length > 0);
                const fallbackTokens: TokenAnnotation[] = originalTokenList.map((token, tokenIndex) => ({
                  id: `fallback-${item.id}-${tokenIndex}`,
                  text: token,
                  start: 0,
                  end: 0,
                }));
                const rawAlignmentTokens =
                  item.resultJson?.tokens ||
                  item.response.result_json?.tokens ||
                  fallbackTokens;
                const tokensForAlignment: TokenAnnotation[] = Array.isArray(rawAlignmentTokens)
                  ? rawAlignmentTokens.map((rawToken: any, tokenIndex: number) => ({
                      id: String(rawToken?.id || `raw-${item.id}-${tokenIndex}`),
                      text: String(rawToken?.text || ""),
                      start: typeof rawToken?.start === "number" ? rawToken.start : 0,
                      end: typeof rawToken?.end === "number" ? rawToken.end : 0,
                      align: typeof rawToken?.align === "string" ? rawToken.align : undefined,
                      reading: typeof rawToken?.reading === "string" ? rawToken.reading : undefined,
                      ipa: typeof rawToken?.ipa === "string" ? rawToken.ipa.replace(/^\/|\/$/g, "") : undefined,
                      pos: typeof rawToken?.pos === "string" ? rawToken.pos : undefined,
                      lemma: typeof rawToken?.lemma === "string" ? rawToken.lemma : undefined,
                      gloss: Array.isArray(rawToken?.gloss) ? rawToken.gloss : undefined,
                      morph: typeof rawToken?.morph === "string" ? rawToken.morph : undefined,
                    }))
                  : fallbackTokens
                const sentenceBlocks = (() => {
                  const sentenceList = item.response.sentences || []
                  if (sentenceList.length === 0) return []

                  let tokenCursor = 0
                  return sentenceList.map((sentence, sentenceIndex) => {
                    const sentenceOriginalTokens = tokenizeSentenceText(sentence.original, ttsSourceLang)
                    const sentenceTranslitTokens = sentence.aligneration.split(/\s+/).filter((t) => t.length > 0)
                    const sentenceIpaTokens = (sentence.ipa || "")
                      .replace(/\//g, "")
                      .split(/\s+/)
                      .filter((t) => t.length > 0)

                    const tokenAnnotations: TokenAnnotation[] = sentenceOriginalTokens.map((tokenText, tokenIndex) => {
                      const sourceTokenIndex = findBestSourceTokenIndex(tokenText, tokensForAlignment, tokenCursor)
                      const sourceToken = sourceTokenIndex >= 0 ? tokensForAlignment[sourceTokenIndex] : undefined
                      tokenCursor = sourceTokenIndex >= 0 ? sourceTokenIndex + 1 : tokenCursor + 1
                      return {
                        id: `${item.id}-s${sentenceIndex}-t${tokenIndex}-${sourceToken?.id || "generated"}`,
                        text: tokenText,
                        start: typeof sourceToken?.start === "number" ? sourceToken.start : 0,
                        end: typeof sourceToken?.end === "number" ? sourceToken.end : 0,
                        align: sourceToken?.align || sentenceTranslitTokens[tokenIndex],
                        reading: sourceToken?.reading,
                        ipa: sourceToken?.ipa || sentenceIpaTokens[tokenIndex],
                        pos: sourceToken?.pos,
                        lemma: sourceToken?.lemma,
                        gloss: Array.isArray(sourceToken?.gloss) ? sourceToken.gloss : undefined,
                        morph: sourceToken?.morph,
                      }
                    })

                    return {
                      ...sentence,
                      mappings: item.sentenceAlignments?.[sentenceIndex] || [],
                      tokenAnnotations,
                    }
                  })
                })()
                const translationIsMeaningful = hasMeaningfulTranslation(
                  item.response.original,
                  item.response.translation
                )

                return (
                <div
                  key={index}
                  id={`result-${item.id}`}
                  className="min-w-0 space-y-6 py-2"
                  style={{
                    fontFamily: fontStacks.serif.family,
                    fontSize: fontStacks.serif.size,
                    lineHeight: fontStacks.serif.lineHeight,
                    letterSpacing: `${letterSpacing}em`,
                  }}
                >
                    {/* Header with actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="rounded-lg px-2 py-1 text-xs font-semibold" 
                              style={{ 
                                backgroundColor: currentTheme.codeBg,
                                border: `1px solid ${currentTheme.border}`
                              }}>
                          {item.request.sourceLang === "auto" ? "Auto" : item.request.sourceLang}
                        </span>
                        <PlayTTS
                          text={item.response.original}
                          lang={ttsSourceLang}
                          size="sm"
                        />
                        <span className="rounded-lg px-2 py-1 text-xs font-semibold text-white" 
                              style={{ backgroundColor: currentTheme.accent }}>
                          → {item.request.targetLang}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ExportButton
                          data={{
                            original: item.response.original,
                            aligneration: item.response.aligneration,
                            translation: item.response.translation,
                            ipa: item.response.ipa,
                            timestamp: item.createdAt,
                          }}
                          filename={`translation-${item.createdAt.toISOString().slice(0, 10)}`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFavorite(item)}
                          aria-label={item.isFavorite ? "Unstar translation" : "Star translation"}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              item.isFavorite ? "fill-current text-[#2DD4BF]" : "text-[#9CA3AF] hover:text-[#2DD4BF]"
                            }`}
                          />
                        </Button>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyOutput(item)}
                            aria-label="Copy full output"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {copiedResultId === item.id && (
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: currentTheme.accent, opacity: 0.9 }}
                            >
                              Copied
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Main Unified Result Area */}
                    <div className="space-y-5">
                      {!translationIsMeaningful && (
                        <div
                          className="rounded-lg border px-3 py-2 text-xs"
                          style={{
                            borderColor: currentTheme.border,
                            backgroundColor: currentTheme.bg,
                            color: currentTheme.text,
                            opacity: 0.85,
                          }}
                        >
                          No meaningful translation was detected for this input. The model output appears to mirror the source text.
                        </div>
                      )}
                      {item.isAligning && (
                        <div className="flex items-center">
                          <span
                            className="rounded-full animate-pulse"
                            style={{
                              width: '2rem',
                              height: '2rem',
                              backgroundColor: '#2DD4BF'
                            }}
                          />
                        </div>
                      )}
                      {/* Integrated Alignment and Interactive Text */}
                      <div className="min-w-0 overflow-x-auto">
                        <AlignmentViewer
                          original={item.response.original_tokens || item.response.original.split(/\s+/).filter(t => t.length > 0)}
                          align={item.response.align_tokens || item.response.aligneration.split(/\s+/).filter(t => t.length > 0)}
                          translation={item.response.translation_tokens || item.response.translation.split(/\s+/).filter(t => t.length > 0)}
                          tokens={tokensForAlignment}
                          lang={ttsSourceLang}
                          mappings={item.alignment || []}
                          sentences={sentenceBlocks}
                          phraseAlignments={item.phraseAlignments || []}
                          wordAlignments={item.wordAlignments || []}
                          ipa={item.response.ipa}
                          showDualLevel={true}
                          blendWithPageBackground
                        />
                      </div>
                    </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
