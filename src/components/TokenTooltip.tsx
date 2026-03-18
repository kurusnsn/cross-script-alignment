"use client";

import React from "react";
import { Volume2, Copy, Loader2, Sparkles, Bookmark, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTtsPlayer } from "@/hooks/useTtsPlayer";
import { useAuthStore } from "@/store/useAuthStore";
import { saveVocabularyItem } from "@/services/vocabulary";
import { cn } from "@/lib/utils";

export type TokenAnnotation = {
  id: string;
  text: string;
  start: number;
  end: number;
  align?: string;
  reading?: string;
  ipa?: string;
  pos?: string;
  lemma?: string;
  gloss?: string[];
  morph?: string;
};

interface TokenTooltipProps {
  tokens: TokenAnnotation[];
  selectedIds: string[];
  lang?: string;
  onClose?: () => void;
}

export function TokenTooltip({ tokens, selectedIds, lang, onClose }: TokenTooltipProps) {
  // ... inside TokenTooltip component
  const { play, isPlaying, isLoading } = useTtsPlayer();
  const { token, isAuthenticated } = useAuthStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  
  const selectedTokens = tokens.filter(t => selectedIds.includes(t.id));
  if (selectedTokens.length === 0) return null;

  const isMulti = selectedTokens.length > 1;
  const combinedText = selectedTokens.map(t => t.text).join(" ");
  
  const handlePlay = () => {
    play({ text: combinedText, langHint: lang });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(combinedText);
  };

  const handleSave = async () => {
    if (!token || !isAuthenticated) return;
    
    setIsSaving(true);
    try {
      const aligneration = selectedTokens.map(t => t.align || t.reading || "").filter(Boolean).join(" ");
      const translation = selectedTokens.flatMap(t => t.gloss || []).join(", ");
      const ipa = selectedTokens.map(t => t.ipa).filter(Boolean).join(" ");
      const pos = isMulti ? "PHRASE" : selectedTokens[0].pos;

      await saveVocabularyItem({
        word: combinedText,
        aligneration: aligneration || combinedText, // Fallback
        translation: translation || "No translation", // Fallback
        ipa: ipa,
        pos: pos,
      }, token);

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save word:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      role="presentation"
      className="bg-[#1A1A19] border border-[#2D2D2B] rounded-xl shadow-2xl p-4 w-72 animate-in fade-in zoom-in duration-200 z-[100] text-[#FAF9F5]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-4">
        {/* Header: Selected Text & Actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold truncate leading-none mb-1">
              {isMulti ? "Phrase Selection" : selectedTokens[0].text}
            </h4>
            {isMulti && (
              <p className="text-[10px] text-[#9CA3AF] truncate opacity-70 italic">
                &ldquo;{combinedText}&rdquo;
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAuthenticated && (
              <Button 
                variant="ghost" 
                size="icon" 
                className={cn(
                  "h-8 w-8 hover:bg-white/10 transition-colors",
                  isSaved ? "text-green-500 hover:text-green-400" : "text-[#2DD4BF] hover:text-[#2DD4BF]/80"
                )}
                onClick={handleSave}
                disabled={isSaving || isSaved}
                title="Save to Word List"
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isSaved ? (
                  <Check size={14} />
                ) : (
                  <Bookmark size={14} />
                )}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-white/10 text-[#2DD4BF]" 
              onClick={handlePlay}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} className={cn(isPlaying && "animate-pulse")} />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-white/10 text-[#9CA3AF] hover:text-white" 
              onClick={handleCopy}
            >
              <Copy size={14} />
            </Button>
          </div>
        </div>

        {/* Linguistic Info */}
        <div className="space-y-3">
          {!isMulti ? (
            // Single Token Details
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedTokens[0].reading && (
                  <Badge variant="outline" className="text-[10px] py-0 bg-white/5 border-none font-mono">
                    {selectedTokens[0].reading}
                  </Badge>
                )}
                {selectedTokens[0].align && (
                  <Badge variant="outline" className="text-[10px] py-0 bg-[#2DD4BF]/10 text-[#2DD4BF] border-none font-medium">
                    {selectedTokens[0].align}
                  </Badge>
                )}
                <button
                  onClick={() => play({ text: selectedTokens[0].text, langHint: lang })}
                  disabled={isLoading}
                  className="ml-auto p-1 rounded hover:bg-white/10 text-[#9CA3AF] hover:text-[#2DD4BF] transition-colors"
                  title="Play word audio"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Volume2 size={12} className={cn(isPlaying && "text-[#2DD4BF] animate-pulse")} />}
                </button>
              </div>

              <div className="space-y-1">
                {selectedTokens[0].ipa && (
                  <p className="text-[10px] font-mono text-[#9CA3AF]">
                    IPA: <span className="text-white/80">/{selectedTokens[0].ipa}/</span>
                  </p>
                )}
                {selectedTokens[0].pos && (
                  <p className="text-[10px] uppercase font-bold tracking-tighter text-[#2DD4BF]/80">
                    {selectedTokens[0].pos} {selectedTokens[0].lemma && `• ${selectedTokens[0].lemma}`}
                  </p>
                )}
              </div>

              {selectedTokens[0].gloss && selectedTokens[0].gloss.length > 0 && (
                <div className="bg-black/20 rounded-lg p-2.5 space-y-1 border border-white/5">
                  {selectedTokens[0].gloss.slice(0, 3).map((g, i) => (
                    <div key={i} className="flex gap-2 text-xs leading-snug">
                      <span className="text-[#9CA3AF] shrink-0">{i + 1}.</span>
                      <span className="font-medium text-[#FAF9F5]">{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Phrase Details
            <div className="bg-black/20 rounded-lg p-3 border border-white/5">
              <div className="flex items-center gap-2 mb-2 text-[#9CA3AF] opacity-60">
                <Sparkles size={10} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Phrase breakdown</span>
              </div>
              <div className="space-y-2">
                {selectedTokens.map((t, i) => (
                  <div key={t.id} className="flex items-start gap-2 text-[11px]">
                    <span className="text-[#9CA3AF] font-mono shrink-0 opacity-40">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
                        <span className="font-bold text-white/90">{t.text}</span>
                        {t.align && (
                          <span className="text-[10px] text-[#2DD4BF]/70 font-mono">{t.align}</span>
                        )}
                        {t.gloss && t.gloss[0] && (
                          <span className="text-[#9CA3AF] italic">&mdash; {t.gloss[0]}</span>
                        )}
                        <button
                          onClick={() => play({ text: t.text, langHint: lang })}
                          className="ml-auto p-0.5 rounded hover:bg-white/10 text-[#9CA3AF] hover:text-[#2DD4BF] transition-colors shrink-0"
                          title={`Play "${t.text}"`}
                        >
                          <Volume2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {selectedTokens[0]?.morph && (
            <p className="text-[9px] text-[#9CA3AF] opacity-50 italic">
              Note: {selectedTokens[0].morph}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
