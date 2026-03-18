"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { TokenAnnotation, TokenTooltip } from "./TokenTooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface WordMapping {
  originalIndex: number;
  alignIndex: number;
  translationIndex: number[];
}

interface PhraseAlignment {
  source: string;
  target: string;
  sourceSpan: { start: number; end: number };
  targetSpan: { start: number; end: number };
  confidence?: number;
  refined?: boolean;
}

interface WordAlignment {
  source: string;
  target: string;
  confidence?: number;
  refined?: boolean;
}

export interface SentenceData {
  original: string;
  aligneration: string;
  translation: string;
  ipa?: string;
  mappings?: WordMapping[];
  tokenAnnotations?: TokenAnnotation[];
}

interface AlignmentProps {
  original: string[];
  align: string[];
  translation: string[];
  tokens?: TokenAnnotation[];
  lang?: string;
  mappings?: WordMapping[];
  phraseAlignments?: PhraseAlignment[];
  wordAlignments?: WordAlignment[];
  ipa?: string;
  sentences?: SentenceData[];
  directions?: {
    original?: "ltr" | "rtl";
    align?: "ltr" | "rtl";
    translation?: "ltr" | "rtl";
  };
  showDualLevel?: boolean;
  blendWithPageBackground?: boolean;
  onSelectionChange?: (selectedText: string) => void;
}

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

// ── Per-sentence block with its own alignment lines ──

function SentenceBlock({
  sentence,
  sentenceIndex,
  dirSettings,
  focusMode,
  tokens,
  lang,
}: {
  sentence: SentenceData;
  sentenceIndex: number;
  dirSettings: { original: string; align: string; translation: string };
  focusMode: boolean;
  tokens?: TokenAnnotation[];
  lang?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const originalTokens = tokenizeSentenceText(sentence.original, lang);
  const alignTokens = tokenizeSentenceText(sentence.aligneration, "en");
  const translationTokens = tokenizeSentenceText(sentence.translation, "en");
  const safeMappings = sentence.mappings || [];
  const sentenceTokenAnnotations = sentence.tokenAnnotations || [];

  const wordRefs = {
    original: useRef<(HTMLSpanElement | null)[]>([]),
    align: useRef<(HTMLSpanElement | null)[]>([]),
    translation: useRef<(HTMLSpanElement | null)[]>([]),
  };

  const getWordPosition = useCallback((el: HTMLSpanElement | null) => {
    if (!el || !containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top,
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") {
          setSelectedIds([]);
        }
      },
      { signal: controller.signal }
    );
    window.addEventListener(
      "click",
      (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setSelectedIds([]);
        }
      },
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, []);

  const handleTokenClick = (e: React.MouseEvent, tokenId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchorRect(rect);
    setSelectedIds((prev) => (prev.includes(tokenId) ? [] : [tokenId]));
  };

  const drawLines = () => {
    if (!containerRef.current || safeMappings.length === 0) return null;

    const lines: React.ReactNode[] = [];
    const lineColor = "#2DD4BF";

    safeMappings.forEach((map, i) => {
      const srcIdx = map.originalIndex;
      const alignIdx = typeof map.alignIndex === "number" ? map.alignIndex : srcIdx;
      const tgtIndices = map.translationIndex;

      const fromOriginal = getWordPosition(wordRefs.original.current[srcIdx]);
      const fromTranslit = getWordPosition(wordRefs.align.current[alignIdx]);
      const isHovered = hoveredGroup === i;
      const show = focusMode || isHovered;

      if (fromOriginal && fromTranslit) {
        lines.push(
          <line
            key={`s${sentenceIndex}-map-ot-${i}`}
            x1={fromOriginal.x}
            y1={fromOriginal.y}
            x2={fromTranslit.x}
            y2={fromTranslit.y}
            stroke={show ? lineColor : "transparent"}
            strokeWidth={isHovered ? 2 : 1}
            opacity={show ? (isHovered ? 0.65 : 0.26) : 0}
            className="transition-all duration-200"
          />
        );
      }

      tgtIndices.forEach((tgtIdx, j) => {
        const toTranslation = getWordPosition(wordRefs.translation.current[tgtIdx]);

        if (fromTranslit && toTranslation) {
          lines.push(
            <line
              key={`s${sentenceIndex}-map-tt-${i}-${j}`}
              x1={fromTranslit.x}
              y1={fromTranslit.y}
              x2={toTranslation.x}
              y2={toTranslation.y}
              stroke={show ? lineColor : "transparent"}
              strokeWidth={isHovered ? 2.5 : 1}
              opacity={show ? (isHovered ? 0.7 : 0.3) : 0}
              className="transition-all duration-200"
            />
          );
        } else if (fromOriginal && toTranslation) {
          lines.push(
            <line
              key={`s${sentenceIndex}-map-fallback-${i}-${j}`}
              x1={fromOriginal.x}
              y1={fromOriginal.y}
              x2={toTranslation.x}
              y2={toTranslation.y}
              stroke={show ? lineColor : "transparent"}
              strokeWidth={isHovered ? 2.5 : 1}
              opacity={show ? (isHovered ? 0.7 : 0.3) : 0}
              className="transition-all duration-200"
            />
          );
        }
      });
    });

    return lines;
  };

  const renderTokenRow = (
    tokensArr: string[],
    row: "original" | "align" | "translation"
  ) => {
    const isTranslit = row === "align";
    const isOriginal = row === "original";

    return (
      <div
        className={`flex flex-wrap gap-2 justify-center py-2 ${
          dirSettings[row] === "rtl" ? "flex-row-reverse" : ""
        }`}
      >
        {tokensArr.map((token, index) => {
          const displayText = token.replace(/_/g, " ");

          // Hover logic
          let mappingIndex = -1;
          if (safeMappings.length > 0) {
            mappingIndex = safeMappings.findIndex((map) => {
              return (row === "original" && map.originalIndex === index) ||
                     (row === "align" && (typeof map.alignIndex === "number" ? map.alignIndex : map.originalIndex) === index) ||
                     (row === "translation" && map.translationIndex.includes(index));
            });
          }

          const isHoveredLine = mappingIndex !== -1 && hoveredGroup === mappingIndex;
          const tokenAnnotation = isOriginal ? sentenceTokenAnnotations[index] : null;
          const isSelected = Boolean(tokenAnnotation && selectedIds.includes(tokenAnnotation.id));

          let className = "px-2 py-1 rounded-md border transition-all duration-200 cursor-default select-none text-[17px] leading-[1.6] font-serif ";

          if (isTranslit) {
            className += "text-[#9CA3AF] border-transparent ";
          } else {
            className += "text-[#FAF9F5] bg-transparent border-transparent hover:border-[#2D2D2B] ";
          }

          if (mappingIndex !== -1 && (isHoveredLine || focusMode)) {
            className += "border-[#2DD4BF] ring-1 ring-[#2DD4BF]/30 shadow-[0_0_15px_rgba(45,212,191,0.25)] ";
            if (!isTranslit) {
              className += "bg-[#134E48]/70 ";
            }
          }

          if (isSelected) {
            className += " bg-[#2DD4BF] text-black font-bold border-[#2DD4BF] shadow-[0_0_10px_rgba(45,212,191,0.4)] ";
          }

          const coreElement = (
            <span
              key={`s${sentenceIndex}-${row}-${index}`}
              ref={(el) => { wordRefs[row].current[index] = el; }}
              onMouseEnter={() => { if (mappingIndex !== -1) setHoveredGroup(mappingIndex); }}
              onMouseLeave={() => setHoveredGroup(null)}
              role="button"
              tabIndex={mappingIndex !== -1 || tokenAnnotation ? 0 : -1}
              onClick={(e) => {
                if (tokenAnnotation) {
                  handleTokenClick(e, tokenAnnotation.id);
                }
              }}
              onKeyDown={(e) => {
                if (mappingIndex !== -1 && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setHoveredGroup(isHoveredLine ? null : mappingIndex);
                }
                if (tokenAnnotation && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setAnchorRect(rect);
                  setSelectedIds((prev) => (prev.includes(tokenAnnotation.id) ? [] : [tokenAnnotation.id]));
                }
              }}
              className={cn(className, tokenAnnotation && "cursor-pointer")}
            >
              {displayText}
            </span>
          );

          if (isOriginal) {
            const alignLabel = tokenAnnotation?.align || tokenAnnotation?.reading;
            const ipaLabel = tokenAnnotation?.ipa;
            return (
              <div key={`s${sentenceIndex}-${row}-${index}`} className="flex flex-col items-center group">
                {alignLabel ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{coreElement}</TooltipTrigger>
                    <TooltipContent side="top" className="bg-[#1A1A19] border-[#2D2D2B] text-[#2DD4BF] text-[10px] font-mono py-1 px-2">
                      {alignLabel}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  coreElement
                )}
                {ipaLabel && (
                  <span className="text-[9px] text-[#9CA3AF] mt-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    /{ipaLabel}/
                  </span>
                )}
              </div>
            );
          }

          return <div key={`s${sentenceIndex}-${row}-${index}`}>{coreElement}</div>;
        })}
      </div>
    );
  };

  return (
    <div className="relative rounded-lg border border-[#2D2D2B]/50 p-4" ref={containerRef}>
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        {drawLines()}
      </svg>
      <div className="relative z-10 space-y-1">
        {renderTokenRow(originalTokens, "original")}
        {alignTokens.length > 0 && renderTokenRow(alignTokens, "align")}
        {renderTokenRow(translationTokens, "translation")}
      </div>
      <AnimatePresence>
        {selectedIds.length > 0 && anchorRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            style={{
              position: "fixed",
              left: Math.max(20, Math.min(window.innerWidth - 300, anchorRect.left - 140 + anchorRect.width / 2)),
              top: anchorRect.top - 10,
              transform: "translateY(-100%)",
              pointerEvents: "auto",
            }}
            className="z-[100]"
          >
            <TokenTooltip
              tokens={sentenceTokenAnnotations}
              selectedIds={selectedIds}
              lang={lang}
              onClose={() => setSelectedIds([])}
            />
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1A1A19] border-r border-b border-[#2D2D2B] rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main AlignmentViewer ──

export default function AlignmentViewer({
  original = [],
  align = [],
  translation = [],
  tokens = [],
  lang,
  mappings = [],
  phraseAlignments = [],
  ipa = "",
  sentences = [],
  directions = {},
  blendWithPageBackground = false,
  onSelectionChange,
}: AlignmentProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setSelectedIds([]);
    }, { signal: controller.signal });
    window.addEventListener("click", (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedIds([]);
      }
    }, { signal: controller.signal });
    return () => { controller.abort(); };
  }, []);

  useEffect(() => {
    if (onSelectionChange) {
      const selectedText = tokens
        .filter(t => selectedIds.includes(t.id))
        .map(t => t.text)
        .join(" ");
      onSelectionChange(selectedText);
    }
  }, [selectedIds, tokens, onSelectionChange]);

  const safeOriginal = Array.isArray(original) ? original : [];
  const safeTranslit = Array.isArray(align) ? align : [];
  const safeTranslation = Array.isArray(translation) ? translation : [];
  const safeMappings = Array.isArray(mappings) ? mappings : [];
  const safePhraseAlignments = Array.isArray(phraseAlignments) ? phraseAlignments : [];
  const safeSentences = Array.isArray(sentences) ? sentences : [];

  const [focusMode, setFocusMode] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);

  const [dirSettings, setDirSettings] = useState({
    original: directions.original || "ltr",
    align: directions.align || "ltr",
    translation: directions.translation || "ltr",
  });

  useEffect(() => {
    setDirSettings({
      original: directions.original || "ltr",
      align: directions.align || "ltr",
      translation: directions.translation || "ltr",
    });
  }, [directions.original, directions.align, directions.translation]);

  const ipaTokens = ipa ? ipa.split(/\s+/).filter(t => t.length > 0) : [];

  const containerRef = useRef<HTMLDivElement>(null);

  const wordRefs = {
    original: useRef<(HTMLSpanElement | null)[]>([]),
    align: useRef<(HTMLSpanElement | null)[]>([]),
    translation: useRef<(HTMLSpanElement | null)[]>([]),
  };

  const getWordPosition = (el: HTMLSpanElement | null) => {
    if (!el || !containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top,
    };
  };

  const sourceTokens = safeOriginal;
  const targetTokens = safeTranslation;

  const selectToken = (tokenId: string, shiftKey: boolean) => {
    if (shiftKey && selectedIds.length > 0) {
      const allTokenIds = tokens.map(t => t.id);
      const startIdx = allTokenIds.indexOf(selectedIds[0]);
      const endIdx = allTokenIds.indexOf(tokenId);
      if (startIdx !== -1 && endIdx !== -1) {
        const range = allTokenIds.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
        setSelectedIds(range);
      }
      return;
    }
    setSelectedIds(prev => prev.includes(tokenId) && prev.length === 1 ? [] : [tokenId]);
  };

  const handleTokenClick = (e: React.MouseEvent, tokenId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchorRect(rect);
    selectToken(tokenId, e.shiftKey);
  };

  // ── Legacy flat drawLines (used when no sentences) ──
  const drawLines = () => {
    if (!containerRef.current) return null;
    const lines: React.ReactNode[] = [];
    const lineColor = "#2DD4BF";

    if (safeMappings && safeMappings.length > 0) {
      safeMappings.forEach((map, i) => {
        let srcIdx: number;
        let alignIdx: number;
        let tgtIndices: number[] = [];

        if (Array.isArray(map)) {
          srcIdx = map[0];
          alignIdx = map[0];
          tgtIndices = [map[1]];
        } else {
          srcIdx = map.originalIndex;
          alignIdx = typeof map.alignIndex === "number" ? map.alignIndex : srcIdx;
          tgtIndices = map.translationIndex;
        }

        const fromOriginal = getWordPosition(wordRefs.original.current[srcIdx]);
        const fromTranslit = getWordPosition(wordRefs.align.current[alignIdx]);
        const isHovered = hoveredGroup === i;
        const show = focusMode || isHovered;

        if (fromOriginal && fromTranslit) {
          lines.push(
            <line
              key={`map-orig-align-${i}`}
              x1={fromOriginal.x}
              y1={fromOriginal.y}
              x2={fromTranslit.x}
              y2={fromTranslit.y}
              stroke={show ? lineColor : "transparent"}
              strokeWidth={isHovered ? 1.8 : 1}
              opacity={show ? 0.45 : 0}
              className="transition-all duration-300"
            />
          );
        }

        tgtIndices.forEach((tgtIdx, j) => {
          const toTranslation = getWordPosition(wordRefs.translation.current[tgtIdx]);
          if (fromTranslit && toTranslation) {
            lines.push(
              <line
                key={`map-align-trans-${i}-${j}`}
                x1={fromTranslit.x}
                y1={fromTranslit.y}
                x2={toTranslation.x}
                y2={toTranslation.y}
                stroke={show ? lineColor : "transparent"}
                strokeWidth={isHovered ? 2 : 1.2}
                opacity={show ? 0.5 : 0}
                className="transition-all duration-300"
              />
            );
          } else if (fromOriginal && toTranslation) {
            lines.push(
              <line
                key={`map-orig-trans-fallback-${i}-${j}`}
                x1={fromOriginal.x}
                y1={fromOriginal.y}
                x2={toTranslation.x}
                y2={toTranslation.y}
                stroke={show ? lineColor : "transparent"}
                strokeWidth={isHovered ? 2 : 1.2}
                opacity={show ? 0.5 : 0}
                className="transition-all duration-300"
              />
            );
          }
        });
      });
    }

    if (safePhraseAlignments.length > 0 && (!safeMappings || safeMappings.length === 0)) {
      safePhraseAlignments.forEach((alignment, i) => {
        const srcIdx = sourceTokens.indexOf(alignment.source);
        const tgtIdx = targetTokens.indexOf(alignment.target);
        if (srcIdx === -1 || tgtIdx === -1) return;

        const fromOriginal = getWordPosition(wordRefs.original.current[srcIdx]);
        const toTranslation = getWordPosition(wordRefs.translation.current[tgtIdx]);
        const isHovered = hoveredGroup === i;
        const show = focusMode || isHovered;
        const confidence = alignment.confidence || 0.8;

        if (fromOriginal && toTranslation) {
          lines.push(
            <line
              key={`phrase-trans-${i}`}
              x1={fromOriginal.x}
              y1={fromOriginal.y}
              x2={toTranslation.x}
              y2={toTranslation.y}
              stroke={show ? lineColor : "transparent"}
              strokeWidth={isHovered ? 2.5 : 1.5}
              opacity={show ? Math.max(0.3, confidence * 0.6) : 0}
              className="transition-all duration-300"
              strokeDasharray={confidence < 0.6 ? "4,2" : "none"}
            />
          );
        }
      });
    }

    return lines;
  };

  // ── Legacy flat renderRow (used when no sentences) ──
  const renderRow = (
    tokensArr: string[],
    row: "original" | "align" | "translation"
  ) => {
    const isTranslit = row === "align";
    const isOriginal = row === "original";

    return (
      <div
        className={`flex flex-wrap gap-3 justify-center py-4 ${
          dirSettings[row] === "rtl" ? "flex-row-reverse" : ""
        }`}
      >
        {tokensArr.map((token, index) => {
          const isGrouped = token.includes("_");
          const displayText = token.replace(/_/g, " ");

          let mappingIndex = -1;
          if (safeMappings && safeMappings.length > 0) {
            mappingIndex = safeMappings.findIndex((map: WordMapping | [number, number]) => {
              if (Array.isArray(map)) {
                return (row === "original" && map[0] === index) ||
                       (row === "align" && map[0] === index) ||
                       (row === "translation" && map[1] === index);
              }
              return (row === "original" && map.originalIndex === index) ||
                     (row === "align" && (typeof map.alignIndex === "number" ? map.alignIndex : map.originalIndex) === index) ||
                     (row === "translation" && map.translationIndex.includes(index));
            });
          }

          if (mappingIndex === -1) {
            mappingIndex = safePhraseAlignments.findIndex(a =>
              row === "original" ? a.source === token :
              row === "translation" ? a.target === token : false
            );
          }

          const isHoveredLine = mappingIndex !== -1 && hoveredGroup === mappingIndex;
          const tokenAnnotation = (isOriginal && tokens && tokens.length > index) ? tokens[index] : null;

          let className = "px-3 py-1.5 rounded-md border transition-all duration-200 cursor-default select-none text-[17px] leading-[1.6] font-serif ";

          if (isTranslit) {
            className += "text-[#9CA3AF] border-transparent ";
          } else {
            className += "text-[#FAF9F5] ";
            if (isGrouped) {
              className += "bg-[#134E48]/40 border-[#134E48] hover:bg-[#134E48]/60 ";
            } else {
              className += "bg-transparent border-transparent hover:border-[#2D2D2B] ";
            }
          }

          const isSelected = isOriginal && tokenAnnotation && selectedIds.includes(tokenAnnotation.id);

          if (mappingIndex !== -1 && (isHoveredLine || focusMode)) {
            className += "border-[#2DD4BF] ring-1 ring-[#2DD4BF]/30 shadow-[0_0_15px_rgba(45,212,191,0.25)] ";
            if (!isTranslit) {
              className += "bg-[#134E48]/70 ";
            }
          }

          if (isSelected) {
            className = className.replace("background-color: transparent", "").replace("border-color: transparent", "");
            className += " bg-[#2DD4BF] text-black font-bold border-[#2DD4BF] shadow-[0_0_10px_rgba(45,212,191,0.4)] ";
          }

          const coreElement = (
            <span
              ref={(el) => { wordRefs[row].current[index] = el; }}
              role="button"
              tabIndex={mappingIndex !== -1 || (isOriginal && tokenAnnotation) ? 0 : -1}
              aria-label={displayText}
              onMouseEnter={() => { if (mappingIndex !== -1) setHoveredGroup(mappingIndex); }}
              onMouseLeave={() => setHoveredGroup(null)}
              onClick={(e) => {
                if (isOriginal && tokenAnnotation) handleTokenClick(e, tokenAnnotation.id);
              }}
              onKeyDown={(e) => {
                if (mappingIndex !== -1 && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setHoveredGroup(isHoveredLine ? null : mappingIndex);
                }
                if (isOriginal && tokenAnnotation && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setAnchorRect(rect);
                  selectToken(tokenAnnotation.id, e.shiftKey);
                }
              }}
              className={cn(className, (isOriginal && tokenAnnotation) && "cursor-pointer")}
            >
              {displayText}
            </span>
          );

          if (isOriginal && tokenAnnotation && (tokenAnnotation.align || tokenAnnotation.reading)) {
            return (
              <div key={`${row}-${index}`} className="flex flex-col items-center group">
                <Tooltip>
                  <TooltipTrigger asChild>{coreElement}</TooltipTrigger>
                  <TooltipContent side="top" className="bg-[#1A1A19] border-[#2D2D2B] text-[#2DD4BF] text-[10px] font-mono py-1 px-2">
                    {tokenAnnotation.align || tokenAnnotation.reading}
                  </TooltipContent>
                </Tooltip>
                {ipaTokens[index] && (
                  <span className="text-[9px] text-[#9CA3AF] mt-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    /{ipaTokens[index]}/
                  </span>
                )}
              </div>
            );
          }

          return (
            <div key={`${row}-${index}`} className="flex flex-col items-center group">
              {coreElement}
              {row === "original" && ipaTokens[index] && (
                <span className="text-[9px] text-[#9CA3AF] mt-1 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  /{ipaTokens[index]}/
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const toggleDir = (row: "original" | "align" | "translation") => {
    setDirSettings((prev) => ({
      ...prev,
      [row]: prev[row] === "rtl" ? "ltr" : "rtl",
    }));
  };

  // ── Decide rendering mode ──
  const useSentenceView = safeSentences.length > 0;

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl",
          blendWithPageBackground
            ? "border-0 bg-transparent p-0 shadow-none"
            : "border border-[#2D2D2B] bg-[#1A1A19] p-10 shadow-2xl"
        )}
        ref={containerRef}
      >
        {!blendWithPageBackground && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#262624]/20 to-transparent" />
        )}

        {/* SVG overlay only for legacy flat mode */}
        {!useSentenceView && (
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
            {drawLines()}
          </svg>
        )}

        <div className="relative z-10">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 gap-3">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setFocusMode(!focusMode)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setFocusMode(!focusMode);
                  }
                }}
                aria-pressed={focusMode}
                className={`w-fit shrink-0 rounded-lg border-[0.5px] px-3 py-2 text-xs font-medium transition-colors cursor-pointer select-none ${
                  focusMode
                    ? "bg-[#2DD4BF]/10 border-[#2DD4BF] text-[#2DD4BF]"
                    : "bg-[#2A2A28] border-[#2D2D2B]/70 text-[#9CA3AF] hover:border-[#2DD4BF] hover:text-[#2DD4BF]"
                }`}
              >
                {focusMode ? "Focus Mode: Active" : "Focus Mode: Off"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 md:justify-end">
              {(["original", "align", "translation"] as const).map((row) => (
                <div
                  key={row}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleDir(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleDir(row);
                    }
                  }}
                  className="text-[9px] font-mono text-[#9CA3AF] border border-[#2D2D2B] px-3 py-1.5 rounded-lg bg-[#2A2A28]/60 hover:bg-[#2A2A28] hover:text-[#FAF9F5] transition-all cursor-pointer"
                >
                  {row.toUpperCase()}: {dirSettings[row].toUpperCase()}
                </div>
              ))}
            </div>
          </div>

          {useSentenceView ? (
            /* ── Per-sentence stacked layout ── */
            <div className="space-y-4">
              {safeSentences.map((sentence, idx) => (
                <SentenceBlock
                  key={idx}
                  sentence={sentence}
                  sentenceIndex={idx}
                  dirSettings={dirSettings}
                  focusMode={focusMode}
                  tokens={tokens}
                  lang={lang}
                />
              ))}
            </div>
          ) : (
            /* ── Legacy flat layout ── */
            <div className="space-y-6">
              {renderRow(sourceTokens, "original")}
              {safeTranslit.length > 0 && (
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-[#2D2D2B]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span
                      className={cn(
                        "px-2 text-[9px] uppercase tracking-tighter text-[#9CA3AF]",
                        blendWithPageBackground ? "bg-transparent" : "bg-[#1A1A19]"
                      )}
                    >
                      Transliteration
                    </span>
                  </div>
                </div>
              )}
              {safeTranslit.length > 0 && renderRow(safeTranslit, "align")}
              {renderRow(targetTokens, "translation")}
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedIds.length > 0 && anchorRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                position: "fixed",
                left: Math.max(20, Math.min(window.innerWidth - 300, anchorRect.left - 140 + anchorRect.width / 2)),
                top: anchorRect.top - 10,
                transform: "translateY(-100%)",
                pointerEvents: "auto",
              }}
              className="z-[100]"
            >
              <TokenTooltip
                tokens={tokens}
                selectedIds={selectedIds}
                lang={lang}
                onClose={() => setSelectedIds([])}
              />
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1A1A19] border-r border-b border-[#2D2D2B] rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
