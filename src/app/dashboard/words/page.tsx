"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "@/hooks/useTheme"
import { Plus, Search, Trash2, Play, BookOpen, Languages, Folder, Sparkles } from "lucide-react"
import { UserWord } from "@/lib/database"
import { WordsExportButton } from "@/components/WordsExportButton"
import { useWords } from "@/hooks/useWords"
import { useAuthStore } from "@/store/useAuthStore"
import { Logo } from "@/components/Logo"


export default function WordsPage() {
  const { user, token } = useAuthStore()
  const userId = user?.id ? String(user.id) : ""
  
  const { words, isLoading, addWord, deleteWord, isAdding } = useWords(userId, token)
  
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all")
  const [selectedFolder, setSelectedFolder] = useState<string>("all")
  const [isAddingForm, setIsAddingForm] = useState(false)
  const [newWord, setNewWord] = useState({
    original: "",
    translation: "",
    aligneration: "",
    languageCode: "",
    folder: ""
  })

  const isDarkMode = useTheme()
  const theme = isDarkMode ? {
    bg: '#262624',
    text: '#FAF9F5',
    accent: '#2DD4BF',
    border: '#404040',
    card: '#2D2D2D',
    codeBg: '#0D0D0D',
    muted: 'rgba(250, 249, 245, 0.5)'
  } : {
    bg: '#F9F9F8',
    text: '#1D1D1B',
    accent: '#2DD4BF',
    border: '#D8D8D5',
    card: '#FFFFFF',
    codeBg: '#F0F0EE',
    muted: 'rgba(29, 29, 27, 0.5)'
  }

  // Get unique languages and folders from words
  const languages = useMemo(() => 
    Array.from(new Set(words.map(w => w.language_code).filter((l): l is string => Boolean(l)))),
    [words]
  )
  const folders = useMemo(() => 
    Array.from(new Set(words.map(w => w.folder).filter((f): f is string => Boolean(f)))),
    [words]
  )

  // Filter words based on search and filters
  const filteredWords = useMemo(() => {
    let filtered = words

    if (searchTerm) {
      filtered = filtered.filter(word =>
        word.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
        word.translation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (word.aligneration && word.aligneration.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (selectedLanguage !== "all") {
      filtered = filtered.filter(word => word.language_code === selectedLanguage)
    }

    if (selectedFolder !== "all") {
      filtered = filtered.filter(word => word.folder === selectedFolder)
    }

    return filtered
  }, [words, searchTerm, selectedLanguage, selectedFolder])

  // Add new word handler
  const handleAddWord = () => {
    if (!newWord.original || !newWord.translation || !newWord.languageCode) {
      return
    }

    addWord({
      original: newWord.original,
      translation: newWord.translation,
      aligneration: newWord.aligneration || undefined,
      language_code: newWord.languageCode,
      folder: newWord.folder || undefined
    })
    
    setNewWord({
      original: "",
      translation: "",
      aligneration: "",
      languageCode: "",
      folder: ""
    })
    setIsAddingForm(false)
  }

  // Delete word handler
  const handleDeleteWord = (wordId: number) => {
    deleteWord(wordId)
  }

  // Play audio
  const playAudio = (audioUrl?: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play().catch(console.error)
    }
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
      <header className="mb-8 pb-4 border-b" style={{ borderColor: theme.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={40} />

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">My Words</h1>
              <p className="text-sm" style={{ color: theme.muted }}>
                Manage your vocabulary collection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className="px-3 py-1"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              <BookOpen className="h-3 w-3 mr-1" />
              {words.length} words
            </Badge>
            <WordsExportButton words={filteredWords} />
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div 
        className="rounded-xl p-4"
        style={{ backgroundColor: theme.card }}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" 
                style={{ color: theme.muted }}
              />
              <Input
                placeholder="Search words..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-transparent border-0"
                style={{ 
                  backgroundColor: theme.codeBg,
                  color: theme.text,
                  borderRadius: '8px'
                }}
              />
            </div>
          </div>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger 
              className="border-0"
              style={{ backgroundColor: theme.codeBg, color: theme.text }}
            >
              <SelectValue placeholder="Language">
                <div className="flex items-center">
                  <Languages className="h-4 w-4 mr-2" style={{ color: theme.accent }} />
                  {selectedLanguage === "all" ? "All Languages" : selectedLanguage}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              {languages.map(lang => (
                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger 
              className="border-0"
              style={{ backgroundColor: theme.codeBg, color: theme.text }}
            >
              <SelectValue placeholder="Folder">
                <div className="flex items-center">
                  <Folder className="h-4 w-4 mr-2" style={{ color: theme.accent }} />
                  {selectedFolder === "all" ? "All Folders" : selectedFolder}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Folders</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder} value={folder}>{folder}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Add Word Form */}
      {isAddingForm && (
        <div 
          className="rounded-xl p-6 space-y-4"
          style={{ backgroundColor: theme.card }}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-5 w-5" style={{ color: theme.accent }} />
            Add New Word
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="original-word" className="text-sm font-medium mb-2 block" style={{ color: theme.muted }}>
                Original Word *
              </label>
              <Input
                id="original-word"
                value={newWord.original}
                onChange={(e) => setNewWord(prev => ({ ...prev, original: e.target.value }))}
                placeholder="Enter original word"
                className="border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              />
            </div>
            <div>
              <label htmlFor="translation" className="text-sm font-medium mb-2 block" style={{ color: theme.muted }}>
                Translation *
              </label>
              <Input
                id="translation"
                value={newWord.translation}
                onChange={(e) => setNewWord(prev => ({ ...prev, translation: e.target.value }))}
                placeholder="Enter translation"
                className="border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              />
            </div>
            <div>
              <label htmlFor="aligneration" className="text-sm font-medium mb-2 block" style={{ color: theme.muted }}>
                Transliteration
              </label>
              <Input
                id="aligneration"
                value={newWord.aligneration}
                onChange={(e) => setNewWord(prev => ({ ...prev, aligneration: e.target.value }))}
                placeholder="Optional"
                className="border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              />
            </div>
            <div>
              <label htmlFor="language-code" className="text-sm font-medium mb-2 block" style={{ color: theme.muted }}>
                Language Code *
              </label>
              <Input
                id="language-code"
                value={newWord.languageCode}
                onChange={(e) => setNewWord(prev => ({ ...prev, languageCode: e.target.value }))}
                placeholder="e.g., ar, ru, hi"
                className="border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              />
            </div>
            <div>
              <label htmlFor="folder" className="text-sm font-medium mb-2 block" style={{ color: theme.muted }}>
                Folder
              </label>
              <Input
                id="folder"
                value={newWord.folder}
                onChange={(e) => setNewWord(prev => ({ ...prev, folder: e.target.value }))}
                placeholder="Optional"
                className="border-0"
                style={{ backgroundColor: theme.codeBg, color: theme.text }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="ghost" 
              onClick={() => setIsAddingForm(false)}
              style={{ color: theme.muted }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddWord}
              style={{ backgroundColor: theme.accent, color: '#0E0E0D' }}
            >
              Add Word
            </Button>
          </div>
        </div>
      )}

      {/* Words List */}
      <div className="space-y-3">
        {isLoading ? (
          <div 
            className="rounded-xl p-12 text-center"
            style={{ backgroundColor: theme.card }}
          >
            <div className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: theme.accent }} />
              <span style={{ color: theme.muted }}>Loading words...</span>
            </div>
          </div>
        ) : filteredWords.length === 0 ? (
          <div 
            className="rounded-xl p-12 text-center"
            style={{ backgroundColor: theme.card }}
          >
            <BookOpen className="mx-auto h-12 w-12 mb-4" style={{ color: theme.muted }} />
            <p className="text-lg mb-2" style={{ color: theme.muted }}>
              {words.length === 0 ? "No words yet!" : "No words match your filters"}
            </p>
            <p className="text-sm" style={{ color: theme.muted }}>
              {words.length === 0
                ? "Star words from translations to build your vocabulary."
                : "Try adjusting your search or filters."
              }
            </p>
          </div>
        ) : (
          filteredWords.map((word) => (
            <div 
              key={word.id}
              className="rounded-xl p-5 transition-all hover:scale-[1.01]"
              style={{ backgroundColor: theme.card }}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-xl font-medium">{word.original}</div>
                      {word.aligneration && (
                        <div className="text-sm italic" style={{ color: theme.accent }}>
                          {word.aligneration}
                        </div>
                      )}
                    </div>
                    <div style={{ color: theme.muted }}>→</div>
                    <div className="text-lg">{word.translation}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span 
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{ backgroundColor: theme.codeBg, color: theme.accent }}
                    >
                      {word.language_code}
                    </span>
                    {word.folder && (
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1"
                        style={{ backgroundColor: theme.codeBg, color: theme.text }}
                      >
                        <Folder className="h-3 w-3" />
                        {word.folder}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: theme.muted }}>
                      Added {new Date(word.added_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {word.audio_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => playAudio(word.audio_url)}
                      className="hover:opacity-80"
                      style={{ color: theme.text }}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteWord(word.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleDeleteWord(word.id);
                      }
                    }}
                    className="hover:opacity-80 text-red-400 hover:text-red-300"
                    aria-label={`Delete word: ${word.original}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Summary */}
      {words.length > 0 && (
        <div 
          className="rounded-xl p-6"
          style={{ backgroundColor: theme.card }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: theme.accent }} />
            Collection Summary
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: theme.codeBg }}>
              <div className="text-3xl font-bold" style={{ color: theme.accent }}>{words.length}</div>
              <div className="text-sm" style={{ color: theme.muted }}>Total Words</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: theme.codeBg }}>
              <div className="text-3xl font-bold" style={{ color: theme.accent }}>{languages.length}</div>
              <div className="text-sm" style={{ color: theme.muted }}>Languages</div>
            </div>
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: theme.codeBg }}>
              <div className="text-3xl font-bold" style={{ color: theme.accent }}>{folders.length}</div>
              <div className="text-sm" style={{ color: theme.muted }}>Folders</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
