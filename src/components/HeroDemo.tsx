"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ArrowRight, ArrowUp, Copy, FileImage, FileText, Paperclip, Plus, Sparkles, Square } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/Logo";
import { TokenAnnotation } from "@/components/TokenTooltip";
import { useTheme } from "@/hooks/useTheme";

const AlignmentViewer = dynamic(() => import("@/components/AlignmentViewer"), {
  loading: () => <div className="w-full h-40 bg-[#2A2A28] animate-pulse rounded-xl" />,
  ssr: false,
});

const PlayTTS = dynamic(() => import("@/components/PlayTTS"), {
  ssr: false,
});

const API_BASE = "/api/backend";
const LETTER_SPACING = -0.012;

const SOURCE_LANGUAGE_OPTIONS = [
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
];

const TARGET_LANGUAGE_OPTIONS = [
  { label: "🇺🇸 English", value: "en" },
];

const LANDING_EXAMPLES = [
  {
    label: "Persian News",
    sourceLang: "fa",
    targetLang: "en",
    text: "امروز صبح زود بیدار شدم و قبل از شروع کار قهوه خوردم. بعد از ظهر با دوستم درباره پروژه جدید صحبت کردیم و چند ایده را روی کاغذ نوشتیم. شب هم گزارش کوتاهی برای تیم فرستادم تا فردا سریع‌تر شروع کنیم.",
  },
  {
    label: "Arabic",
    sourceLang: "ar",
    targetLang: "en",
    text: "ذهبت إلى المكتبة صباحًا لقراءة كتاب جديد عن تطوير المنتجات. بعد الظهر جلست في المقهى وراجعت الأفكار التي سجلتها خلال الأسبوع. في المساء كتبت ملخصًا واضحًا وشاركته مع زملائي قبل الاجتماع.",
  },
  {
    label: "Hindi",
    sourceLang: "hi",
    targetLang: "en",
    text: "मैं आज जल्दी उठा और एक घंटे तक पढ़ाई की, फिर काम की तैयारी की। दोपहर में मैंने अपनी नोटबुक में नए शब्द और उनके उदाहरण लिखे। शाम को मैंने अपने दोस्त के साथ नई योजना पर विस्तार से चर्चा की।",
  },
  {
    label: "Japanese",
    sourceLang: "ja",
    targetLang: "en",
    text: "今日は朝早く起きて、駅まで歩きながら一日の予定を考えました。昼は同僚と新しい企画について意見を出し合い、必要なタスクを整理しました。夜は家でニュースを読み、気になった内容をメモにまとめました。",
  },
  {
    label: "Chinese",
    sourceLang: "zh",
    targetLang: "en",
    text: "今天早上我先复习了笔记，然后去了公司开会，讨论了下个月的计划。下午我把会议内容整理成要点，并补充了需要跟进的任务。晚上回家后，我又把重点内容汇总成清单，方便明天直接执行。",
  },
  {
    label: "Hebrew",
    sourceLang: "he",
    targetLang: "en",
    text: "הבוקר קראתי מאמר ארוך על טכנולוגיה חדשה ורשמתי לעצמי נקודות מעניינות. אחר הצהריים ישבתי עם הצוות כדי לבדוק איך אפשר ליישם חלק מהרעיונות במוצר שלנו. בערב דיברתי עם חברים על המסקנות והחלטנו להמשיך את הדיון מחר.",
  },
];

const LANDING_PLACEHOLDER_EXAMPLES = [
  "سلام، امروز بعد از کلاس زبان، چند جمله جدید تمرین کردم و تلفظم بهتر شد.",
  "مرحبًا، اليوم كتبت ملاحظات طويلة عن الدرس الجديد ثم راجعتها قبل النوم.",
  "मैं आज नई भाषा के लंबे वाक्य पढ़ रहा हूँ और हर शब्द का उच्चारण ध्यान से कर रहा हूँ।",
  "今日は新しい単語だけでなく、少し長い文章も声に出して練習しています。",
  "今天我在练习更长的句子，还把重要的表达整理成了一个小清单。",
  "היום אני מתרגל משפטים ארוכים יותר ורושם לעצמי מילים חשובות לחזרה בערב.",
];

type SentenceResult = {
  original: string;
  aligneration: string;
  translation: string;
  ipa?: string;
};

type WordMapping = {
  originalIndex: number;
  alignIndex: number;
  translationIndex: number[];
};

type PhraseAlignment = {
  source: string;
  target: string;
  sourceSpan: { start: number; end: number };
  targetSpan: { start: number; end: number };
  confidence?: number;
  refined?: boolean;
};

type WordAlignment = {
  source: string;
  target: string;
  confidence?: number;
  refined?: boolean;
};

type TranslitResponse = {
  original: string;
  aligneration: string;
  translation: string;
  ipa: string;
  original_tokens?: string[];
  align_tokens?: string[];
  translation_tokens?: string[];
  sentences?: SentenceResult[];
  result_json?: any;
};

type LegacyAlignmentResponse = {
  alignments: WordMapping[];
};

type SentenceAlignmentResponse = {
  sentence_alignments: Array<{ mappings: WordMapping[] }>;
};

type LLMAlignmentResponse = {
  alignments?: Array<{
    source: string;
    target: string;
    confidence?: number;
    refined?: boolean;
  }>;
  word_alignments?: Array<{
    source: string;
    target: string;
    confidence?: number;
    refined?: boolean;
  }>;
};

type AlignmentResult = {
  alignment: WordMapping[];
  sentenceAlignments: WordMapping[][];
};

type ResultState = {
  id: string;
  request: {
    sourceLang: string;
    targetLang: string;
  };
  response: TranslitResponse;
  alignment: WordMapping[];
  sentenceAlignments: WordMapping[][];
  phraseAlignments: PhraseAlignment[];
  wordAlignments: WordAlignment[];
  isAligning: boolean;
  createdAt: Date;
};

const normalizeTokenText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\u200c\u200e\u200f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();

const tokenizeSentenceText = (text: string, lang?: string): string[] => {
  const input = (text || "").trim();
  if (!input) return [];

  const hasWhitespace = /\s/.test(input);
  const normalizedLang = (lang || "").toLowerCase();

  if (!hasWhitespace) {
    if (normalizedLang.startsWith("zh")) {
      return input.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+|[^\s]/g) || [input];
    }
    if (normalizedLang.startsWith("ja")) {
      return input.match(/[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]|[A-Za-z0-9]+|[^\s]/g) || [input];
    }
    if (normalizedLang.startsWith("th")) {
      return input.match(/[\u0E00-\u0E7F]|[A-Za-z0-9]+|[^\s]/g) || [input];
    }
  }

  return input.split(/\s+/).filter((t) => t.length > 0);
};

const isLikelyPunctuation = (token?: TokenAnnotation): boolean => {
  if (!token) return false;
  if (token.pos === "PUNCT") return true;
  return normalizeTokenText(token.text || "").length === 0;
};

const charSimilarity = (a: string, b: string): number => {
  if (!a || !b) return 0;
  const bChars = new Set(b.split(""));
  let overlap = 0;
  for (const char of a) {
    if (bChars.has(char)) overlap += 1;
  }
  return overlap / Math.max(a.length, b.length);
};

const findBestSourceTokenIndex = (
  sentenceToken: string,
  sourceTokens: TokenAnnotation[],
  startIndex: number,
  lookahead = 8
): number => {
  if (startIndex >= sourceTokens.length) return -1;

  const targetNorm = normalizeTokenText(sentenceToken);
  const endIndex = Math.min(sourceTokens.length, startIndex + lookahead + 1);

  if (!targetNorm) {
    for (let idx = startIndex; idx < endIndex; idx += 1) {
      if (isLikelyPunctuation(sourceTokens[idx])) return idx;
    }
    return startIndex;
  }

  for (let idx = startIndex; idx < endIndex; idx += 1) {
    const candidate = sourceTokens[idx];
    if (!candidate) continue;
    const candidateNorm = normalizeTokenText(candidate.text || "");
    if (!candidateNorm) continue;
    if (candidateNorm === targetNorm) {
      return idx;
    }
    const minLen = Math.min(candidateNorm.length, targetNorm.length);
    if (
      minLen >= 3 &&
      (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm))
    ) {
      return idx;
    }
  }

  let bestIndex = -1;
  let bestScore = 0;
  for (let idx = startIndex; idx < endIndex; idx += 1) {
    const candidate = sourceTokens[idx];
    if (!candidate) continue;
    const candidateNorm = normalizeTokenText(candidate.text || "");
    if (!candidateNorm) continue;
    const score = charSimilarity(targetNorm, candidateNorm);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  if (bestIndex >= 0 && bestScore >= 0.6) {
    return bestIndex;
  }

  for (let idx = startIndex; idx < sourceTokens.length; idx += 1) {
    if (!isLikelyPunctuation(sourceTokens[idx])) return idx;
  }

  return startIndex;
};

const copyTextWithFallback = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

const buildFullOutputText = (response: TranslitResponse): string => {
  const translationLine = hasMeaningfulTranslation(response.original, response.translation)
    ? response.translation?.trim()
    : "No meaningful translation available for this input.";

  const sections = [
    response.original?.trim() ? `Original\n${response.original.trim()}` : "",
    response.aligneration?.trim() ? `Transliteration\n${response.aligneration.trim()}` : "",
    translationLine ? `Translation\n${translationLine}` : "",
    response.ipa?.trim() ? `IPA\n${response.ipa.trim()}` : "",
  ].filter(Boolean);

  return sections.join("\n\n");
};

const theme = {
  light: {
    bg: "#FAF9F5",
    text: "#0E0E0D",
    accent: "#2DD4BF",
    border: "#e8e8e6",
    card: "#ffffff",
    codeBg: "#f5f5f4",
  },
  dark: {
    bg: "#262624",
    text: "#FAF9F5",
    accent: "#2DD4BF",
    border: "#404040",
    card: "#2D2D2D",
    codeBg: "#0D0D0D",
  },
};

const normalizeMeaningfulText = (value: string): string =>
  (value || "")
    .normalize("NFKC")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
    .toLowerCase();

const hasMeaningfulTranslation = (original: string, translation: string): boolean => {
  const originalNorm = normalizeMeaningfulText(original);
  const translationNorm = normalizeMeaningfulText(translation);
  if (!translationNorm) return false;
  if (!originalNorm) return true;
  return translationNorm !== originalNorm;
};

const fontStack = {
  family: '"Georgia", "Iowan Old Style", "Times New Roman", serif',
  size: "17px",
  lineHeight: "1.6",
};

export default function HeroDemo() {
  const isDarkMode = useTheme();
  const currentTheme = isDarkMode ? theme.dark : theme.light;
  const modalMutedText = isDarkMode ? "rgba(250, 249, 245, 0.72)" : "rgba(29, 29, 27, 0.7)";
  const [inputText, setInputText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [isDeletingPlaceholder, setIsDeletingPlaceholder] = useState(false);
  const [isPlaceholderPaused, setIsPlaceholderPaused] = useState(false);
  const [isPlaceholderLocked, setIsPlaceholderLocked] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [result, setResult] = useState<ResultState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSignupModalOpen, setFileSignupModalOpen] = useState(false);
  const [fileSignupModalKind, setFileSignupModalKind] = useState<"image" | "pdf">("image");
  const [copied, setCopied] = useState(false);
  const copyFeedbackTimeoutRef = useRef<number | null>(null);
  const placeholderTimerRef = useRef<number | null>(null);
  const alignerateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (alignerateAbortRef.current) {
        alignerateAbortRef.current.abort();
      }
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      if (placeholderTimerRef.current) {
        window.clearTimeout(placeholderTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (placeholderTimerRef.current) {
      window.clearTimeout(placeholderTimerRef.current);
      placeholderTimerRef.current = null;
    }

    if (isPlaceholderPaused || isPlaceholderLocked) {
      return;
    }

    const fullText = LANDING_PLACEHOLDER_EXAMPLES[placeholderIndex] || "";
    if (!fullText) return;

    const finishedTyping = !isDeletingPlaceholder && placeholderText === fullText;
    const finishedDeleting = isDeletingPlaceholder && placeholderText.length === 0;

    let delay = isDeletingPlaceholder ? 24 : 42;
    if (finishedTyping) delay = 1200;
    if (finishedDeleting) delay = 260;

    placeholderTimerRef.current = window.setTimeout(() => {
      if (finishedTyping) {
        setIsDeletingPlaceholder(true);
        return;
      }

      if (finishedDeleting) {
        setIsDeletingPlaceholder(false);
        setPlaceholderIndex((prev) => (prev + 1) % LANDING_PLACEHOLDER_EXAMPLES.length);
        return;
      }

      const nextText = isDeletingPlaceholder
        ? fullText.slice(0, Math.max(0, placeholderText.length - 1))
        : fullText.slice(0, placeholderText.length + 1);

      setPlaceholderText(nextText);
      setInputText(nextText);
    }, delay);

    return () => {
      if (placeholderTimerRef.current) {
        window.clearTimeout(placeholderTimerRef.current);
        placeholderTimerRef.current = null;
      }
    };
  }, [placeholderIndex, placeholderText, isDeletingPlaceholder, isPlaceholderPaused, isPlaceholderLocked]);

  const fetchAlignment = async (
    originalTokens: string[],
    alignTokens: string[],
    translationTokens: string[],
    originalText: string,
    translationText: string,
    sentences: SentenceResult[]
  ): Promise<AlignmentResult> => {
    const validSentences = Array.isArray(sentences)
      ? sentences.filter((sentence) =>
          Boolean(
            sentence?.original?.trim() ||
            sentence?.aligneration?.trim() ||
            sentence?.translation?.trim()
          )
        )
      : [];

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
        });

        if (!response.ok) {
          throw new Error(`Sentence alignment request failed: ${response.status}`);
        }

        const data: SentenceAlignmentResponse = await response.json();
        const sentenceAlignments = (data.sentence_alignments || []).map((entry) =>
          Array.isArray(entry?.mappings) ? entry.mappings : []
        );

        return { alignment: [], sentenceAlignments };
      } catch {
        // fallback below
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
          k: 3,
        }),
      });

      if (!response.ok) {
        throw new Error(`Alignment request failed: ${response.status}`);
      }

      const data: LegacyAlignmentResponse = await response.json();
      return {
        alignment: data.alignments || [],
        sentenceAlignments: [],
      };
    } catch {
      return {
        alignment: [],
        sentenceAlignments: [],
      };
    }
  };

  const fetchLLMAlignments = async (originalText: string, translationText: string) => {
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
      });

      if (!response.ok) {
        return { phrases: [], words: [] };
      }

      const data: LLMAlignmentResponse = await response.json();
      const phraseAlignments: PhraseAlignment[] = (data.alignments || []).map((alignment) => ({
        source: alignment.source,
        target: alignment.target,
        sourceSpan: { start: 0, end: 0 },
        targetSpan: { start: 0, end: 0 },
        confidence: alignment.confidence || 0.9,
        refined: alignment.refined || false,
      }));

      const wordAlignments: WordAlignment[] = (data.word_alignments || []).map((alignment) => ({
        source: alignment.source,
        target: alignment.target,
        confidence: alignment.confidence || 0.8,
        refined: alignment.refined || false,
      }));

      return { phrases: phraseAlignments, words: wordAlignments };
    } catch {
      return { phrases: [], words: [] };
    }
  };

  const handleTransliterate = async (textToTranslate?: string) => {
    const text = (textToTranslate || inputText).trim();
    if (!text) return;

    setIsLoading(true);
    setError(null);
    setCopied(false);
    setResult(null);
    const abortController = new AbortController();
    alignerateAbortRef.current = abortController;

    try {
      const payload = {
        text,
        source_lang: sourceLanguage === "auto" ? "" : sourceLanguage,
        target_lang: targetLanguage,
        persist: false,
      };

      const response = await fetch(`${API_BASE}/align`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed: ${response.status}`);
      }

      const data: TranslitResponse = await response.json();
      const sentences = Array.isArray(data.sentences) ? data.sentences : [];
      const originalTokens = data.original_tokens || data.original.split(/\s+/).filter((t) => t.length > 0);
      const alignTokens = data.align_tokens || data.aligneration.split(/\s+/).filter((t) => t.length > 0);
      const translationTokens = data.translation_tokens || data.translation.split(/\s+/).filter((t) => t.length > 0);

      const resultId = `landing-result-${Date.now()}`;
      setResult({
        id: resultId,
        request: {
          sourceLang: sourceLanguage,
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
      });

      const [alignmentResult, llmAlignments] = await Promise.all([
        fetchAlignment(
          originalTokens,
          alignTokens,
          translationTokens,
          data.original,
          data.translation,
          sentences
        ),
        fetchLLMAlignments(data.original, data.translation),
      ]);

      setResult((prev) => {
        if (!prev || prev.id !== resultId) return prev;
        return {
          ...prev,
          alignment: alignmentResult.alignment,
          sentenceAlignments: alignmentResult.sentenceAlignments,
          phraseAlignments: llmAlignments.phrases,
          wordAlignments: llmAlignments.words,
          isAligning: false,
        };
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Translation stopped.");
        setResult(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      if (alignerateAbortRef.current === abortController) {
        alignerateAbortRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const stopActiveTranslation = () => {
    if (alignerateAbortRef.current) {
      alignerateAbortRef.current.abort();
      alignerateAbortRef.current = null;
      setIsLoading(false);
      setError("Translation stopped.");
    }
  };

  const ttsSourceLang = useMemo(() => {
    const detectedLang = result?.response.result_json?.meta?.sourceLangGuess;
    if (!result) return sourceLanguage === "auto" ? "fa" : sourceLanguage;
    if (result.request.sourceLang === "auto") {
      return detectedLang || "fa";
    }
    return result.request.sourceLang;
  }, [result, sourceLanguage]);

  const tokensForAlignment: TokenAnnotation[] = useMemo(() => {
    if (!result) return [];
    const originalTokenList =
      result.response.original_tokens ||
      result.response.original.split(/\s+/).filter((t) => t.length > 0);
    const fallbackTokens: TokenAnnotation[] = originalTokenList.map((token, tokenIndex) => ({
      id: `fallback-${result.id}-${tokenIndex}`,
      text: token,
      start: 0,
      end: 0,
    }));
    const rawAlignmentTokens = result.response.result_json?.tokens || fallbackTokens;
    if (!Array.isArray(rawAlignmentTokens)) return fallbackTokens;
    return rawAlignmentTokens.map((rawToken: any, tokenIndex: number) => ({
      id: String(rawToken?.id || `raw-${result.id}-${tokenIndex}`),
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
    }));
  }, [result]);

  const sentenceBlocks = useMemo(() => {
    if (!result) return [];
    const sentenceList = result.response.sentences || [];
    if (sentenceList.length === 0) return [];

    let tokenCursor = 0;
    return sentenceList.map((sentence, sentenceIndex) => {
      const sentenceOriginalTokens = tokenizeSentenceText(sentence.original, ttsSourceLang);
      const sentenceTranslitTokens = sentence.aligneration.split(/\s+/).filter((t) => t.length > 0);
      const sentenceIpaTokens = (sentence.ipa || "")
        .replace(/\//g, "")
        .split(/\s+/)
        .filter((t) => t.length > 0);

      const tokenAnnotations: TokenAnnotation[] = sentenceOriginalTokens.map((tokenText, tokenIndex) => {
        const sourceTokenIndex = findBestSourceTokenIndex(tokenText, tokensForAlignment, tokenCursor);
        const sourceToken = sourceTokenIndex >= 0 ? tokensForAlignment[sourceTokenIndex] : undefined;
        tokenCursor = sourceTokenIndex >= 0 ? sourceTokenIndex + 1 : tokenCursor + 1;
        return {
          id: `${result.id}-s${sentenceIndex}-t${tokenIndex}-${sourceToken?.id || "generated"}`,
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
        };
      });

      return {
        ...sentence,
        mappings: result.sentenceAlignments?.[sentenceIndex] || [],
        tokenAnnotations,
      };
    });
  }, [result, tokensForAlignment, ttsSourceLang]);

  const applyExample = (example: (typeof LANDING_EXAMPLES)[number]) => {
    setIsPlaceholderPaused(true);
    setIsPlaceholderLocked(true);
    setIsDeletingPlaceholder(false);
    setPlaceholderText(example.text);
    setInputText(example.text);
    setSourceLanguage(example.sourceLang);
    setTargetLanguage(example.targetLang);
  };

  const lockPlaceholderSentence = () => {
    const fullText = LANDING_PLACEHOLDER_EXAMPLES[placeholderIndex] || placeholderText;
    setIsPlaceholderPaused(true);
    setIsPlaceholderLocked(true);
    setIsDeletingPlaceholder(false);
    setPlaceholderText(fullText);
    setInputText(fullText);
  };

  const handleCopyOutput = async () => {
    if (!result) return;
    const textToCopy = buildFullOutputText(result.response);
    if (!textToCopy) return;

    try {
      await copyTextWithFallback(textToCopy);
      setCopied(true);
      if (copyFeedbackTimeoutRef.current) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const isRtlInput = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/.test(
    inputText
  );

  return (
    <div
      className="w-full min-w-0 max-w-3xl space-y-6"
      style={{
        color: currentTheme.text,
        fontFamily: fontStack.family,
        fontSize: fontStack.size,
        lineHeight: fontStack.lineHeight,
        letterSpacing: `${LETTER_SPACING}em`,
      }}
    >
      <div className="relative">
        <div
          className="rounded-2xl border transition-colors relative"
          style={{
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
            borderWidth: "0.5px",
          }}
        >
          <Label htmlFor="landing-aligneration-textarea" className="sr-only">
            Text to alignerate
          </Label>
          <textarea
            id="landing-aligneration-textarea"
            value={inputText}
            readOnly
            onMouseEnter={() => {
              setIsPlaceholderPaused(true);
            }}
            onMouseLeave={() => {
              if (!isPlaceholderLocked) {
                setIsPlaceholderPaused(false);
              }
            }}
            onMouseDown={() => {
              lockPlaceholderSentence();
            }}
            onFocus={() => {
              lockPlaceholderSentence();
            }}
            className="w-full bg-transparent text-lg leading-relaxed p-4 pr-4 pb-24 sm:pb-16 resize-none focus:outline-none min-h-[140px] max-h-[300px]"
            style={{
              color: currentTheme.text,
              WebkitTextFillColor: currentTheme.text,
              caretColor: "transparent",
              direction: isRtlInput ? "rtl" : "ltr",
              textAlign: isRtlInput ? "right" : "left",
            }}
          />

          <div className="absolute bottom-3 left-3 right-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 w-full items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-10 w-10 shrink-0 rounded-lg hover:opacity-80 transition-all flex items-center justify-center"
                    style={{
                      backgroundColor: currentTheme.codeBg,
                      color: currentTheme.text,
                    }}
                    aria-label="Open input actions"
                  >
                    <Plus size={18} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => document.getElementById("landing-file-upload-input")?.click()}>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Add files or photos
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      applyExample(LANDING_EXAMPLES[Math.floor(Math.random() * LANDING_EXAMPLES.length)])
                    }
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Try example
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
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
                    {SOURCE_LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ArrowRight className="h-4 w-4 text-[#9CA3AF]" />

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

            <button
              type="button"
              onClick={() => {
                if (isLoading) {
                  stopActiveTranslation();
                  return;
                }
                handleTransliterate();
              }}
              disabled={!isLoading && !inputText.trim()}
              className="flex self-end shrink-0 items-center justify-center rounded-lg p-2.5 transition-all sm:self-auto"
              style={{
                backgroundColor: currentTheme.accent,
                color: "#0E0E0D",
                opacity: !isLoading && !inputText.trim() ? 0.3 : 1,
              }}
              aria-label="Transliterate input"
            >
              {isLoading ? <Square size={14} /> : <ArrowUp size={18} />}
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

        <input
          id="landing-file-upload-input"
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const lowerName = file.name.toLowerCase();
            const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
            setFileSignupModalKind(isPdf ? "pdf" : "image");
            setFileSignupModalOpen(true);
            setError(null);

            e.target.value = "";
          }}
        />
      </div>

      <Dialog open={fileSignupModalOpen} onOpenChange={setFileSignupModalOpen}>
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-md rounded-2xl border-[0.5px] p-0 overflow-hidden [&>button]:text-current [&>button]:opacity-70 [&>button:hover]:opacity-100 [&>button:focus-visible]:ring-[#2DD4BF]"
          style={{
            backgroundColor: currentTheme.card,
            borderColor: currentTheme.border,
            color: currentTheme.text,
          }}
        >
          <div className="space-y-5 p-5 sm:p-6">
            <DialogHeader className="space-y-2 text-left">
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                style={{
                  borderColor: `${currentTheme.accent}55`,
                  backgroundColor: `${currentTheme.accent}1a`,
                  color: currentTheme.accent,
                }}
              >
                {fileSignupModalKind === "pdf" ? <FileText className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
              </div>
              <DialogTitle className="text-left text-xl font-semibold tracking-tight">
                Sign up to alignerate images or PDFs
              </DialogTitle>
              <DialogDescription className="text-left" style={{ color: modalMutedText }}>
                File aligneration is available for signed-in accounts. Create a free account to upload images and PDFs.
              </DialogDescription>
            </DialogHeader>

            <div
              className="rounded-xl border px-3 py-3 text-sm"
              style={{
                borderColor: currentTheme.border,
                backgroundColor: currentTheme.bg,
                color: modalMutedText,
              }}
            >
              OCR extraction, full aligneration history, and reusable study lists are unlocked after signup.
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFileSignupModalOpen(false)}
                className="h-10 w-full sm:w-auto"
                style={{
                  borderColor: currentTheme.border,
                  backgroundColor: currentTheme.codeBg,
                  color: currentTheme.text,
                }}
              >
                Continue with text
              </Button>
              <Button
                asChild
                className="h-10 w-full sm:w-auto"
                style={{
                  backgroundColor: currentTheme.accent,
                  color: "#0E0E0D",
                }}
              >
                <Link href="/login">Sign up free</Link>
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {error && (
        <p className="text-sm text-center" style={{ color: "#FCA5A5" }}>
          {error}
        </p>
      )}

      {result && (
        <div
          className="min-w-0 space-y-6 py-2"
          style={{
            fontFamily: fontStack.family,
            fontSize: fontStack.size,
            lineHeight: fontStack.lineHeight,
            letterSpacing: `${LETTER_SPACING}em`,
            color: currentTheme.text,
          }}
        >
          {!hasMeaningfulTranslation(result.response.original, result.response.translation) && (
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className="rounded-lg px-2 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: currentTheme.codeBg,
                  border: `1px solid ${currentTheme.border}`,
                }}
              >
                {result.request.sourceLang === "auto" ? "Auto" : result.request.sourceLang}
              </span>
              <PlayTTS text={result.response.original} lang={ttsSourceLang} size="sm" />
              <span className="rounded-lg px-2 py-1 text-xs font-semibold text-white" style={{ backgroundColor: currentTheme.accent }}>
                → {result.request.targetLang}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyOutput}
                aria-label="Copy full output"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {copied && (
                <span className="text-[10px] font-medium" style={{ color: currentTheme.accent, opacity: 0.9 }}>
                  Copied
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {result.isAligning && (
              <div className="flex items-center">
                <span
                  className="rounded-full animate-pulse"
                  style={{
                    width: "2rem",
                    height: "2rem",
                    backgroundColor: "#2DD4BF",
                  }}
                />
              </div>
            )}

            <div className="min-w-0 overflow-x-auto">
              <AlignmentViewer
                original={
                  result.response.original_tokens ||
                  result.response.original.split(/\s+/).filter((t) => t.length > 0)
                }
                align={
                  result.response.align_tokens ||
                  result.response.aligneration.split(/\s+/).filter((t) => t.length > 0)
                }
                translation={
                  result.response.translation_tokens ||
                  result.response.translation.split(/\s+/).filter((t) => t.length > 0)
                }
                tokens={tokensForAlignment}
                lang={ttsSourceLang}
                mappings={result.alignment}
                sentences={sentenceBlocks}
                phraseAlignments={result.phraseAlignments}
                wordAlignments={result.wordAlignments}
                ipa={result.response.ipa}
                showDualLevel={true}
                blendWithPageBackground
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
