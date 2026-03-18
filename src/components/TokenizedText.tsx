"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TokenAnnotation, TokenTooltip } from "./TokenTooltip";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TokenizedTextProps {
  original: string;
  tokens: TokenAnnotation[];
  lang?: string;
  className?: string;
  onSelectionChange?: (selectedText: string) => void;
}

export function TokenizedText({ 
  original, 
  tokens, 
  lang, 
  className,
  onSelectionChange 
}: TokenizedTextProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear selection on outside click or ESC
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

    return () => {
      controller.abort();
    };
  }, []);

  // Compute text parts (tokens + gaps)
  type Part = 
    | { type: "text"; content: string }
    | { type: "token"; content: string; token: TokenAnnotation };
  
  const parts = useMemo((): Part[] => {
    if (!tokens || tokens.length === 0) return [{ type: "text", content: original }];

    const result: Part[] = [];
    let lastIndex = 0;
    
    // Ensure tokens are sorted by start
    const sortedTokens = [...tokens].sort((a, b) => a.start - b.start);

    sortedTokens.forEach((token) => {
      // Add gap if any
      if (token.start > lastIndex) {
        result.push({ 
          type: "text", 
          content: original.slice(lastIndex, token.start) 
        });
      }
      
      // Add token
      result.push({ 
        type: "token", 
        token, 
        content: original.slice(token.start, token.end) 
      });
      
      lastIndex = token.end;
    });

    // Add remaining text
    if (lastIndex < original.length) {
      result.push({ 
        type: "text", 
        content: original.slice(lastIndex) 
      });
    }

    return result;
  }, [original, tokens]);

  // Report selection to parent
  useEffect(() => {
    if (onSelectionChange) {
      const selectedText = tokens
        .filter(t => selectedIds.includes(t.id))
        .map(t => t.text)
        .join(" ");
      onSelectionChange(selectedText);
    }
  }, [selectedIds, tokens, onSelectionChange]);

  const handleTokenClick = (e: React.MouseEvent, tokenId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchorRect(rect);

    if (e.shiftKey && selectedIds.length > 0) {
      // Range selection
      const allTokenIds = tokens.map(t => t.id);
      const startIdx = allTokenIds.indexOf(selectedIds[0]);
      const endIdx = allTokenIds.indexOf(tokenId);
      
      if (startIdx !== -1 && endIdx !== -1) {
        const range = allTokenIds.slice(
          Math.min(startIdx, endIdx),
          Math.max(startIdx, endIdx) + 1
        );
        setSelectedIds(range);
      }
    } else {
      // Toggle or single selection
      setSelectedIds(prev => prev.includes(tokenId) && prev.length === 1 ? [] : [tokenId]);
    }
  };

  const isRtl = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(original);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative inline-block leading-relaxed", 
        isRtl ? "rtl text-right" : "ltr text-left",
        className
      )}
    >
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-wrap items-baseline gap-y-1">
          {parts.map((part, i) => (
            part.type === "token" ? (
              <Tooltip key={part.token.id}>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Token: ${part.content}. Press to view details.`}
                    onClick={(e) => handleTokenClick(e, part.token.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setAnchorRect(rect);
                        if (e.shiftKey && selectedIds.length > 0) {
                          const allTokenIds = tokens.map(t => t.id);
                          const startIdx = allTokenIds.indexOf(selectedIds[0]);
                          const endIdx = allTokenIds.indexOf(part.token.id);

                          if (startIdx !== -1 && endIdx !== -1) {
                            const range = allTokenIds.slice(
                              Math.min(startIdx, endIdx),
                              Math.max(startIdx, endIdx) + 1
                            );
                            setSelectedIds(range);
                          }
                        } else {
                          setSelectedIds(prev => prev.includes(part.token.id) && prev.length === 1 ? [] : [part.token.id]);
                        }
                      }
                    }}
                    className={cn(
                      "cursor-pointer rounded-sm px-0.5 transition-all duration-200",
                      selectedIds.includes(part.token.id)
                        ? "bg-[#2DD4BF] text-black font-bold shadow-[0_0_10px_rgba(45,212,191,0.4)]"
                        : "hover:bg-[#2DD4BF]/20 hover:text-[#2DD4BF]"
                    )}
                  >
                    {part.content}
                  </span>
                </TooltipTrigger>
                {(part.token.align || part.token.reading) && (
                  <TooltipContent 
                    side="top" 
                    className="bg-[#1A1A19] border-[#2D2D2B] text-[#2DD4BF] text-[10px] font-mono py-1 px-2"
                  >
                    {part.token.align || part.token.reading}
                  </TooltipContent>
                )}
              </Tooltip>
            ) : (
              <span key={`gap-${i}`} className="whitespace-pre">
                {part.content}
              </span>
            )
          ))}
        </div>
      </TooltipProvider>

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
            {/* Arrow */}
            <div 
              className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1A1A19] border-r border-b border-[#2D2D2B] rotate-45"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
