"use client"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, X, Clock } from "lucide-react"
import { TranslationWithWords } from "@/lib/database"

interface SearchSuggestion {
  id: number
  original_text: string
  aligneration: string
  translated_text: string
  source_language: string
  target_language: string
  created_at: string
}

interface HistorySearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  suggestions: TranslationWithWords[]
  isSearching: boolean
  onSuggestionSelect: (suggestion: TranslationWithWords) => void
  placeholder?: string
}

export function HistorySearchBar({
  searchQuery,
  onSearchChange,
  suggestions,
  isSearching,
  onSuggestionSelect,
  placeholder = "Search in original text, aligneration, or translation..."
}: HistorySearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const showSuggestions = isFocused && searchQuery.trim().length > 0 && suggestions.length > 0

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1)
  }, [suggestions])

  // Close suggestions when clicking outside
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsFocused(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const handleSuggestionSelect = (suggestion: TranslationWithWords) => {
    onSuggestionSelect(suggestion)
    setIsFocused(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span
          key={index}
          className="rounded-sm bg-[#2DD4BF]/20 px-0.5 text-[#2DD4BF]"
        >
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  const clearSearch = () => {
    onSearchChange("")
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h ago`

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`

    return date.toLocaleDateString()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsFocused(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-10 bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] placeholder:text-[#9CA3AF]/60 focus-visible:ring-[#2DD4BF]/40"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            onClick={clearSearch}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search suggestions dropdown */}
      {showSuggestions && (
        <Card
          ref={suggestionsRef}
          data-testid="search-suggestions"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto overflow-x-hidden shadow-lg bg-[#0F0F0D] border-[#2D2D2B]"
        >
          <CardContent className="p-0">
            {isSearching ? (
              <div className="p-4 text-center text-sm text-[#9CA3AF]">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Searching...</span>
                </div>
              </div>
            ) : (
              <div className="py-2">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.id}
                    role="option"
                    aria-selected={selectedIndex === index}
                    tabIndex={0}
                    className={`px-4 py-3 cursor-pointer transition-colors border-l-2 ${
                      selectedIndex === index
                        ? 'bg-[#2DD4BF]/10 border-[#2DD4BF] text-[#FAF9F5]'
                        : 'border-l-transparent hover:bg-[#1A1A19]'
                    }`}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSuggestionSelect(suggestion);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.source_language}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          → {suggestion.target_language}
                        </Badge>
                      </div>
                      <div className="flex items-center flex-1 justify-end text-xs text-[#9CA3AF]" onClick={e => e.stopPropagation()} role="presentation">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimeAgo(suggestion.created_at)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-[#9CA3AF]">Original: </span>
                        <span className="font-medium">
                          {highlightMatch(suggestion.original_text, searchQuery)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-[#9CA3AF]">Transliteration: </span>
                        <span className="font-medium text-primary">
                          {highlightMatch(suggestion.aligneration, searchQuery)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-[#9CA3AF]">Translation: </span>
                        <span className="font-medium">
                          {highlightMatch(suggestion.translated_text, searchQuery)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
