"use client"

import * as React from "react"
import { Search, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useHistoryStore } from "@/store/useHistoryStore"
import { useHistory } from "@/hooks/useHistory"
import { cn } from "@/lib/utils"

interface HistorySearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistorySearchModal({ open, onOpenChange }: HistorySearchModalProps) {
  const { 
    selectHistoryItem, 
    searchQuery,
    setSearchQuery,
  } = useHistoryStore()

  const { translations: history } = useHistory()
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const itemRefs = React.useRef<Array<HTMLDivElement | null>>([])

  const filteredHistory = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return history
    return history.filter((item) => {
      return (
        item.original_text.toLowerCase().includes(query) ||
        item.aligneration.toLowerCase().includes(query) ||
        item.translated_text.toLowerCase().includes(query)
      )
    })
  }, [history, searchQuery])

  React.useEffect(() => {
    setSelectedIndex(-1)
  }, [searchQuery, filteredHistory.length])

  React.useEffect(() => {
    if (selectedIndex < 0) return
    const el = itemRefs.current[selectedIndex]
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  const handleItemClick = (itemId: string) => {
    selectHistoryItem(itemId)
    onOpenChange(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredHistory.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (prev < 0) return 0
        return Math.min(prev + 1, filteredHistory.length - 1)
      })
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedIndex((prev) => {
        if (prev < 0) return filteredHistory.length - 1
        return Math.max(prev - 1, 0)
      })
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < filteredHistory.length) {
        handleItemClick(String(filteredHistory[selectedIndex].id))
      }
    }

    if (event.key === "Escape") {
      event.preventDefault()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 gap-0 bg-[#0F0F0D] border-[#2D2D2B] shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Search History</DialogTitle>
        
        {/* Search Header Area */}
        <div className="relative border-b border-[#2D2D2B] bg-gradient-to-b from-[#1A1A18] to-[#0F0F0D]">
          <div className="px-6 pt-6 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[#2DD4BF]/10 text-[#2DD4BF]">
                <Search size={14} />
              </div>
              <h2 className="text-sm font-semibold text-[#FAF9F5]/90 tracking-tight uppercase">Search</h2>
            </div>
            <div />
          </div>

          <div className="px-6 pb-4 pt-2">
            <div className="relative">
              <Label htmlFor="deep-search-input" className="sr-only">Search History</Label>
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-[#2DD4BF] opacity-50" />
              <Input 
                id="deep-search-input"
                placeholder="Search keywords, origin, or translation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-14 pl-8 bg-transparent border-none text-xl text-white placeholder:text-[#FAF9F5]/20 rounded-none focus-visible:ring-0 transition-all font-light"
                autoFocus
                aria-activedescendant={
                  selectedIndex >= 0 && filteredHistory[selectedIndex]
                    ? `history-item-${filteredHistory[selectedIndex].id}`
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        {/* Results Area */}
        <ScrollArea className="h-[450px]">
          <div className="p-2 space-y-1" role="listbox">
            {!searchQuery && history.length > 0 && (
              <div className="px-4 py-3 flex items-center gap-2 text-[#9CA3AF]/40">
                <Clock size={12} />
                <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Recent History</span>
              </div>
            )}
            
            <div className="grid gap-1">
              {filteredHistory.map((item, index) => (
                <div
                  key={item.id}
                  id={`history-item-${item.id}`}
                  role="option"
                  tabIndex={0}
                  aria-selected={selectedIndex === index}
                  ref={(el) => {
                    itemRefs.current[index] = el
                  }}
                  onClick={() => handleItemClick(String(item.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(String(item.id));
                    }
                  }}
                  className={cn(
                    "group min-w-0 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 flex items-start gap-4 border",
                    selectedIndex === index
                      ? "bg-[#1A1A19] border-[#2DD4BF]/40"
                      : "border-transparent hover:bg-[#1A1A19] hover:border-[#2D2D2B]"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg bg-[#1A1A19] border border-[#2D2D2B] flex items-center justify-center text-[#9CA3AF] transition-all shrink-0",
                    "group-hover:text-[#2DD4BF] group-hover:border-[#2DD4BF]/30 transition-all",
                    selectedIndex === index && "text-[#2DD4BF] border-[#2DD4BF]/30"
                  )}>
                    <Clock size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-base text-[#FAF9F5] leading-snug break-words whitespace-normal">
                        {item.original_text}
                      </p>
                    </div>
                    <p className="text-sm text-[#9CA3AF] leading-snug mt-2 break-words whitespace-normal opacity-60 group-hover:opacity-100 transition-opacity">
                      {item.translated_text}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <span className="text-[10px] text-[#9CA3AF]/40 font-mono whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                    <div className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 bg-[#2DD4BF]/10 text-[#2DD4BF] transition-all">
                      <Search size={10} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-3xl bg-[#1A1A19] border border-[#2D2D2B] flex items-center justify-center mb-6 text-[#2DD4BF]/20">
                  <Search size={32} />
                </div>
                <h3 className="text-[#FAF9F5] font-semibold text-lg">
                  {searchQuery ? "No results found" : "No history found"}
                </h3>
                <p className="text-[#9CA3AF] text-sm mt-1 max-w-[250px] mx-auto opacity-60">
                  {searchQuery ? "Try searching for something else or check your spelling" : "Transliterate some text to see it appear here"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer Area */}
        <div className="px-6 py-3 bg-[#0F0F0D] border-t border-[#2D2D2B] flex items-center justify-start text-[10px] text-[#9CA3AF]/40 font-mono tracking-wider uppercase">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="text-[#9CA3AF]/60">↑↓</span> to navigate</span>
            <span className="flex items-center gap-1.5"><span className="text-[#9CA3AF]/60">↵</span> to select</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
