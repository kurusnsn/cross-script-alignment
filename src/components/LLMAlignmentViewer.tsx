"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface LLMAlignment {
  source: string;
  target: string;
  confidence?: number;
  refined?: boolean;
}

interface LLMAlignmentResult {
  phrase_alignments: LLMAlignment[];
  word_alignments: LLMAlignment[];
  timing?: {
    total: number;
  };
  raw_response?: string;
}

interface LLMAlignmentViewerProps {
  sourceText: string;
  targetText: string;
  alignmentResult: LLMAlignmentResult;
  sourceLanguage?: string;
  targetLanguage?: string;
}

const sanitizeMarkup = (html: string): string => {
  if (typeof window === "undefined") {
    return html;
  }

  try {
    // DOMPurify exports differ across toolchains; normalize at runtime.
    const moduleValue = require("dompurify");
    const purifier = moduleValue?.default ?? moduleValue;
    if (typeof purifier?.sanitize === "function") {
      return purifier.sanitize(html, {
        ALLOWED_TAGS: ["span"],
        ALLOWED_ATTR: ["class", "data-alignment-index"],
      });
    }
  } catch {
    // Fall through and return unsanitized html for this local viewer.
  }

  return html;
};

export default function LLMAlignmentViewer({
  sourceText,
  targetText,
  alignmentResult,
  sourceLanguage = "Source",
  targetLanguage = "Target",
}: LLMAlignmentViewerProps) {
  const [activeLevel, setActiveLevel] = useState<"phrase" | "word">("phrase");
  const [hoveredAlignment, setHoveredAlignment] = useState<number | null>(null);

  const currentAlignments = activeLevel === "phrase"
    ? alignmentResult.phrase_alignments
    : alignmentResult.word_alignments;

  const getConfidenceColor = (confidence: number, refined: boolean = false) => {
    if (refined) {
      return "border-orange-400 bg-orange-50 text-orange-800";
    }
    if (confidence > 0.8) {
      return "border-green-400 bg-green-50 text-green-800";
    }
    if (confidence > 0.6) {
      return "border-blue-400 bg-blue-50 text-blue-800";
    }
    return "border-yellow-400 bg-yellow-50 text-yellow-800";
  };

  const highlightTextMatches = (text: string, alignments: LLMAlignment[], isSource: boolean) => {
    let highlightedText = text;
    const matches: Array<{start: number, end: number, index: number}> = [];

    alignments.forEach((alignment, index) => {
      const searchText = isSource ? alignment.source : alignment.target;
      const startIndex = text.indexOf(searchText);
      if (startIndex !== -1) {
        matches.push({
          start: startIndex,
          end: startIndex + searchText.length,
          index
        });
      }
    });

    // Sort matches by start position (reverse order for replacement)
    matches.sort((a, b) => b.start - a.start);

    matches.forEach((match) => {
      const alignment = alignments[match.index];
      const confidence = alignment.confidence || 0.8;
      const isHovered = hoveredAlignment === match.index;
      const isRefined = alignment.refined || false;

      const baseClass = "px-1 py-0.5 rounded transition-all duration-200 cursor-pointer";
      const hoverClass = isHovered ? "ring-2 ring-blue-300 shadow-sm" : "";
      const confidenceClass = getConfidenceColor(confidence, isRefined);
      const refinedStyle = isRefined ? "border-dashed" : "border-solid";

      const className = `${baseClass} ${confidenceClass} ${hoverClass} border ${refinedStyle}`;

      const before = highlightedText.substring(0, match.start);
      const after = highlightedText.substring(match.end);
      const matchedText = highlightedText.substring(match.start, match.end);

      highlightedText = `${before}<span class="${className}" data-alignment-index="${match.index}">${matchedText}</span>${after}`;
    });

    return sanitizeMarkup(highlightedText);
  };

  return (
    <div className="space-y-6">
      {/* Level Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">LLM Alignment Visualization</CardTitle>
              <CardDescription>
                Dual-level alignment showing both semantic phrases and word-level mappings
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeLevel === "phrase" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveLevel("phrase")}
              >
                Phrase Level ({alignmentResult.phrase_alignments.length})
              </Button>
              <Button
                variant={activeLevel === "word" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveLevel("word")}
              >
                Word Level ({alignmentResult.word_alignments.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alignmentResult.timing && (
            <div className="mb-4 text-sm text-[#9CA3AF]">
              Processing time: {alignmentResult.timing.total.toFixed(2)}s
            </div>
          )}

          {/* Text Display with Highlights */}
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{sourceLanguage} Text:</Label>
              <div
                role="button"
                tabIndex={0}
                aria-label={`${sourceLanguage} text with alignments. Use arrow keys to navigate.`}
                className="p-4 bg-[#2A2A28]/30 rounded-lg text-lg leading-relaxed focus-visible:ring-1 focus-visible:ring-[#2DD4BF]/50 outline-none"
                dir="rtl"
                dangerouslySetInnerHTML={{
                  __html: highlightTextMatches(sourceText, currentAlignments, true)
                }}
                onMouseOver={(e) => {
                  const target = e.target as HTMLElement;
                  const index = target.getAttribute('data-alignment-index');
                  if (index !== null) {
                    setHoveredAlignment(parseInt(index));
                  }
                }}
                onFocus={(e) => {
                  const target = e.target as HTMLElement;
                  const index = target.getAttribute('data-alignment-index');
                  if (index !== null) {
                    setHoveredAlignment(parseInt(index));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    // Optional: handle selection logic here if needed
                  }
                }}
                onBlur={() => setHoveredAlignment(null)}
                onMouseOut={() => setHoveredAlignment(null)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{targetLanguage} Text:</Label>
              <div
                role="button"
                tabIndex={0}
                aria-label={`${targetLanguage} text with alignments. Use arrow keys to navigate.`}
                className="p-4 bg-[#2A2A28]/30 rounded-lg text-lg leading-relaxed focus-visible:ring-1 focus-visible:ring-[#2DD4BF]/50 outline-none"
                dangerouslySetInnerHTML={{
                  __html: highlightTextMatches(targetText, currentAlignments, false)
                }}
                onMouseOver={(e) => {
                  const target = e.target as HTMLElement;
                  const index = target.getAttribute('data-alignment-index');
                  if (index !== null) {
                    setHoveredAlignment(parseInt(index));
                  }
                }}
                onFocus={(e) => {
                  const target = e.target as HTMLElement;
                  const index = target.getAttribute('data-alignment-index');
                  if (index !== null) {
                    setHoveredAlignment(parseInt(index));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                  }
                }}
                onBlur={() => setHoveredAlignment(null)}
                onMouseOut={() => setHoveredAlignment(null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alignment List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {activeLevel === "phrase" ? "Phrase Alignments" : "Word Alignments"}
          </CardTitle>
          <CardDescription>
            {activeLevel === "phrase"
              ? "Semantic phrase-level mappings for natural language understanding"
              : "Word-level dictionary-style mappings for detailed analysis"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentAlignments.map((alignment, index) => {
              const confidence = alignment.confidence || 0.8;
              const isRefined = alignment.refined || false;
              const isHovered = hoveredAlignment === index;

              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  className={`flex items-center gap-4 p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                    isHovered ? "bg-[#2A2A28]/50 border-blue-300 shadow-sm" : "border-muted hover:bg-[#2A2A28]/30"
                  }`}
                  onMouseEnter={() => setHoveredAlignment(index)}
                  onMouseLeave={() => setHoveredAlignment(null)}
                  onFocus={() => setHoveredAlignment(index)}
                  onBlur={() => setHoveredAlignment(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      // Toggling behavior for results
                      setHoveredAlignment(isHovered ? null : index);
                    }
                  }}
                >
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="text-right" dir="rtl">
                      <span className="font-mono text-sm bg-[#2A2A28] px-2 py-1 rounded">
                        {alignment.source}
                      </span>
                    </div>

                    <div className="flex justify-center">
                      <span className="text-[#9CA3AF]">→</span>
                    </div>

                    <div>
                      <span className="font-mono text-sm bg-[#2A2A28] px-2 py-1 rounded">
                        {alignment.target}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRefined && (
                      <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                        LLM
                      </Badge>
                    )}
                    <Badge
                      variant={confidence > 0.7 ? "default" : "secondary"}
                      className={getConfidenceColor(confidence, isRefined)}
                    >
                      {Math.round(confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              );
            })}

            {currentAlignments.length === 0 && (
              <div className="text-center py-8 text-[#9CA3AF]">
                No {activeLevel} alignments available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      {alignmentResult.raw_response && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Debug: Raw LLM Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-[#2A2A28] p-3 rounded overflow-x-auto max-h-32">
              {alignmentResult.raw_response}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
