import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon, GlobeAltIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface Language {
  code: string;
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: 'auto', name: 'Detect Language', flag: '' },
  { code: 'fa', name: 'Persian (فارسی)', flag: '🇮🇷' },
  { code: 'ar', name: 'Arabic (العربية)', flag: '🇸🇦' },
  { code: 'ur', name: 'Urdu (اردو)', flag: '🇵🇰' },
  { code: 'hi', name: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese (日本語)', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean (한국어)', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese (中文)', flag: '🇨🇳' },
  { code: 'th', name: 'Thai (ไทย)', flag: '🇹🇭' },
  { code: 'he', name: 'Hebrew (עברית)', flag: '🇮🇱' },
  { code: 'bn', name: 'Bengali (বাংলা)', flag: '🇧🇩' },
  { code: 'ta', name: 'Tamil (தமிழ்)', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu (తెలుగు)', flag: '🇮🇳' },
];

const targetLanguages: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fr', name: 'French (Français)', flag: '🇫🇷' },
  { code: 'de', name: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'it', name: 'Italian (Italiano)', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese (Português)', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian (Русский)', flag: '🇷🇺' },
];

const placeholders = [
  "سلام دنیا - Hello World in Persian",
  "مرحبا بالعالم - Hello World in Arabic",
  "ہیلو ورلڈ - Hello World in Urdu",
  "नमस्ते दुनिया - Hello World in Hindi",
  "Привет мир - Hello World in Russian",
  "こんにちは世界 - Hello World in Japanese",
  "안녕하세요 세계 - Hello World in Korean",
  "你好世界 - Hello World in Chinese",
  "שלום עולם - Hello World in Hebrew",
  "হ্যালো বিশ্ব - Hello World in Bengali",
];

interface TransliterationInputProps {
  onSubmit: (text: string, sourceLang: string, targetLang: string) => void;
  isLoading?: boolean;
}

export function TransliterationInput({ onSubmit, isLoading = false }: TransliterationInputProps) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onSubmit(text.trim(), sourceLang, targetLang);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const selectedSourceLang = languages.find(lang => lang.code === sourceLang) || languages[0];
  const selectedTargetLang = targetLanguages.find(lang => lang.code === targetLang) || targetLanguages[0];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Language Selection Bar */}
      <div className="flex items-center justify-between mb-4 bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
        <div className="flex items-center space-x-4">
          {/* Source Language Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSourceDropdown(!showSourceDropdown)}
              aria-haspopup="listbox"
              aria-expanded={showSourceDropdown}
              aria-label={`Source language: ${selectedSourceLang.name}`}
              className="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all duration-200"
            >
              <span className="text-lg" aria-hidden="true">{selectedSourceLang.flag}</span>
              <span className="text-sm font-medium text-white">{selectedSourceLang.name}</span>
              <ChevronDownIcon className="w-4 h-4 text-white/60" aria-hidden="true" />
            </button>

            <AnimatePresence>
              {showSourceDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-60 overflow-y-auto"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setSourceLang(lang.code);
                        setShowSourceDropdown(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{lang.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ArrowRightIcon className="w-5 h-5 text-white/60" />

          {/* Target Language Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTargetDropdown(!showTargetDropdown)}
              aria-haspopup="listbox"
              aria-expanded={showTargetDropdown}
              aria-label={`Target language: ${selectedTargetLang.name}`}
              className="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition-all duration-200"
            >
              <span className="text-lg" aria-hidden="true">{selectedTargetLang.flag}</span>
              <span className="text-sm font-medium text-white">{selectedTargetLang.name}</span>
              <ChevronDownIcon className="w-4 h-4 text-white/60" aria-hidden="true" />
            </button>

            <AnimatePresence>
              {showTargetDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-60 overflow-y-auto"
                >
                  {targetLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setTargetLang(lang.code);
                        setShowTargetDropdown(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{lang.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-white/60">
          <GlobeAltIcon className="w-4 h-4" />
          <span className="text-xs">Powered by OpenAI</span>
        </div>
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className={`relative bg-white/10 backdrop-blur-sm rounded-2xl border transition-all duration-300 ${
          isFocused ? 'border-blue-400/50 shadow-lg shadow-blue-500/20' : 'border-white/20'
        }`}>
          <div className="relative">
            {/* Animated Placeholder */}
            <AnimatePresence mode="wait">
              {!text && !isFocused && (
                <motion.div
                  key={currentPlaceholder}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex items-start justify-start p-4 pointer-events-none z-10"
                >
                  <span className="text-white/50 text-lg leading-relaxed">
                    {placeholders[currentPlaceholder]}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <Label htmlFor="aligneration-textarea" className="sr-only">Text to alignerate</Label>
            <textarea
              id="aligneration-textarea"
              ref={textareaRef}
              value={text}
              onChange={handleTextareaChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full bg-transparent text-white text-lg leading-relaxed p-4 pr-16 resize-none focus:outline-none placeholder-transparent min-h-[120px] max-h-[200px]"
              style={{
                direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text) ? 'rtl' : 'ltr',
                textAlign: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text) ? 'right' : 'left'
              }}
            />

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={!text.trim() || isLoading}
              className="absolute bottom-4 right-4 p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowRightIcon className="w-5 h-5" />
              )}
            </motion.button>
          </div>

          {/* Character Counter */}
          {text && (
            <div className="px-4 pb-2">
              <div className="text-right text-xs text-white/40">
                {text.length} characters
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setText('')}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Clear
            </button>
            <span className="text-white/30">•</span>
            <button
              type="button"
              onClick={() => {
                const examples = [
                  'سلام چطوری؟',
                  'مرحبا كيف حالك؟',
                  'नमस्ते कैसे हैं आप?',
                  'こんにちは、元気ですか？'
                ];
                setText(examples[Math.floor(Math.random() * examples.length)]);
              }}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Try Example
            </button>
          </div>

          <div className="text-xs text-white/40">
            Press Enter to translate • Shift+Enter for new line
          </div>
        </div>
      </form>

      {/* Click outside to close dropdowns */}
      {(showSourceDropdown || showTargetDropdown) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setShowSourceDropdown(false);
            setShowTargetDropdown(false);
          }}
        />
      )}
    </div>
  );
}