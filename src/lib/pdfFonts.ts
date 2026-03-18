import jsPDF from "jspdf"

type FontKey =
  | "arabic"
  | "hebrew"
  | "devanagari"
  | "bengali"
  | "thai"
  | "cyrillic"
  | "cjk_sc"
  | "cjk_jp"
  | "cjk_kr"

type FontDefinition = {
  family: string
  fileName: string
  url: string
  rtl?: boolean
}

const FONT_DEFINITIONS: Record<FontKey, FontDefinition> = {
  arabic: {
    family: "NotoNaskhArabic",
    fileName: "NotoNaskhArabic-Regular.ttf",
    url: "/fonts/NotoNaskhArabic-Regular.ttf",
    rtl: true,
  },
  hebrew: {
    family: "NotoSansHebrew",
    fileName: "NotoSansHebrew-Regular.ttf",
    url: "/fonts/NotoSansHebrew-Regular.ttf",
    rtl: true,
  },
  devanagari: {
    family: "NotoSansDevanagari",
    fileName: "NotoSansDevanagari-Regular.ttf",
    url: "/fonts/NotoSansDevanagari-Regular.ttf",
  },
  bengali: {
    family: "NotoSansBengali",
    fileName: "NotoSansBengali-Regular.ttf",
    url: "/fonts/NotoSansBengali-Regular.ttf",
  },
  thai: {
    family: "NotoSansThai",
    fileName: "NotoSansThai-Regular.ttf",
    url: "/fonts/NotoSansThai-Regular.ttf",
  },
  cyrillic: {
    family: "NotoSans",
    fileName: "NotoSans-Regular.ttf",
    url: "/fonts/NotoSans-Regular.ttf",
  },
  cjk_sc: {
    family: "NotoSansCJKsc",
    fileName: "NotoSansCJKsc-Regular.otf",
    url: "/fonts/NotoSansCJKsc-Regular.otf",
  },
  cjk_jp: {
    family: "NotoSansCJKjp",
    fileName: "NotoSansCJKjp-Regular.otf",
    url: "/fonts/NotoSansCJKjp-Regular.otf",
  },
  cjk_kr: {
    family: "NotoSansCJKkr",
    fileName: "NotoSansCJKkr-Regular.otf",
    url: "/fonts/NotoSansCJKkr-Regular.otf",
  },
}

const LANGUAGE_FONT_MAP: Record<string, FontKey> = {
  fa: "arabic",
  ar: "arabic",
  ur: "arabic",
  he: "hebrew",
  hi: "devanagari",
  bn: "bengali",
  th: "thai",
  ja: "cjk_jp",
  ko: "cjk_kr",
  zh: "cjk_sc",
  ru: "cyrillic",
  "zh-hans": "cjk_sc",
  "zh-cn": "cjk_sc",
  "zh-sg": "cjk_sc",
}

const SCRIPT_TESTS: Array<{ key: FontKey; regex: RegExp }> = [
  { key: "arabic", regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/ },
  { key: "hebrew", regex: /[\u0590-\u05FF]/ },
  { key: "devanagari", regex: /[\u0900-\u097F]/ },
  { key: "bengali", regex: /[\u0980-\u09FF]/ },
  { key: "thai", regex: /[\u0E00-\u0E7F]/ },
  { key: "cyrillic", regex: /[\u0400-\u04FF\u0500-\u052F]/ },
  { key: "cjk_kr", regex: /[\uAC00-\uD7AF]/ },
  { key: "cjk_jp", regex: /[\u3040-\u30FF\u31F0-\u31FF]/ },
  { key: "cjk_sc", regex: /[\u4E00-\u9FFF]/ },
]

const fontDataCache = new Map<string, string>()

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...Array.from(chunk))
  }
  return btoa(binary)
}

async function getFontData(url: string) {
  const cached = fontDataCache.get(url)
  if (cached) return cached

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load font: ${url}`)
  }
  const buffer = await res.arrayBuffer()
  const base64 = arrayBufferToBase64(buffer)
  fontDataCache.set(url, base64)
  return base64
}

function resolveFontKey(text: string, langCode?: string): FontKey | null {
  if (langCode) {
    const normalized = langCode.toLowerCase()
    const mapped = LANGUAGE_FONT_MAP[normalized]
    if (mapped) return mapped
  }

  for (const test of SCRIPT_TESTS) {
    if (test.regex.test(text)) {
      return test.key
    }
  }

  return null
}

async function ensureFont(pdf: jsPDF, key: FontKey) {
  const def = FONT_DEFINITIONS[key]
  const fontList = (pdf as any).getFontList?.() as Record<string, string[]> | undefined
  if (fontList && fontList[def.family]) {
    return
  }

  const base64 = await getFontData(def.url)
  pdf.addFileToVFS(def.fileName, base64)
  pdf.addFont(def.fileName, def.family, "normal")
}

export async function getPdfFontForText(
  pdf: jsPDF,
  text: string,
  langCode?: string
) {
  const fontKey = resolveFontKey(text, langCode)
  if (!fontKey) {
    return { family: "helvetica", rtl: false }
  }

  await ensureFont(pdf, fontKey)
  const def = FONT_DEFINITIONS[fontKey]
  return { family: def.family, rtl: def.rtl ?? false }
}
