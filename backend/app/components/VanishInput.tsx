import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VanishInputProps {
  placeholders: string[];
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  className?: string;
  value?: string;
}

export function VanishInput({
  placeholders,
  onChange,
  onSubmit,
  className = "",
  value = ""
}: VanishInputProps) {
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startAnimation = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
    }, 3000);
  }, [placeholders.length]);

  const stopAnimation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isFocused && !inputValue) {
      startAnimation();
    } else {
      stopAnimation();
    }

    return () => stopAnimation();
  }, [isFocused, inputValue, startAnimation, stopAnimation]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim()) {
        onSubmit(inputValue.trim());
      }
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className={`
        relative bg-white/10 backdrop-blur-sm rounded-2xl border transition-all duration-300
        ${isFocused ? 'border-blue-400/50 shadow-lg shadow-blue-500/20' : 'border-white/20'}
      `}>
        <div className="relative">
          {/* Animated Placeholder */}
          <AnimatePresence mode="wait">
            {!inputValue && !isFocused && (
              <motion.div
                key={currentPlaceholder}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{
                  duration: 0.5,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 flex items-start justify-start p-4 pointer-events-none z-10"
              >
                <span className="text-white/50 text-lg leading-relaxed">
                  {placeholders[currentPlaceholder]}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expandable Textarea */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`
              w-full bg-transparent text-white text-lg leading-relaxed p-4
              resize-none focus:outline-none placeholder-transparent
              min-h-[80px] max-h-[200px] transition-all duration-200
              ${inputValue ? 'min-h-[120px]' : 'min-h-[80px]'}
            `}
            style={{
              direction: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(inputValue) ? 'rtl' : 'ltr',
              textAlign: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(inputValue) ? 'right' : 'left'
            }}
          />

          {/* Submit Indicator */}
          <AnimatePresence>
            {inputValue.trim() && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute bottom-4 right-4 text-white/40 text-sm"
              >
                Press Enter ↵
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Character Counter */}
        <AnimatePresence>
          {inputValue && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-2 overflow-hidden"
            >
              <div className="text-right text-xs text-white/40">
                {inputValue.length} characters
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Usage component with language selection
interface TranslitInputProps {
  onTransliterate: (text: string, sourceLang: string, targetLang: string) => void;
  isLoading?: boolean;
}

export function TranslitInput({ onTransliterate, isLoading = false }: TranslitInputProps) {
  const [text, setText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');

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

  const languages = [
    { code: 'auto', name: 'Auto-detect', flag: '' },
    { code: 'fa', name: 'Persian', flag: '🇮🇷' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  ];

  const targetLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
  ];

  const handleSubmit = (value: string) => {
    onTransliterate(value, sourceLang, targetLang);
  };

  const selectedSource = languages.find(l => l.code === sourceLang) || languages[0];
  const selectedTarget = targetLanguages.find(l => l.code === targetLang) || targetLanguages[0];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Language Selection */}
      <div className="flex items-center justify-center space-x-4">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400/50"
        >
          {languages.map(lang => (
            <option key={lang.code} value={lang.code} className="bg-gray-900">
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>

        <div className="text-white/60">→</div>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400/50"
        >
          {targetLanguages.map(lang => (
            <option key={lang.code} value={lang.code} className="bg-gray-900">
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Input */}
      <VanishInput
        placeholders={placeholders}
        onChange={setText}
        onSubmit={handleSubmit}
        value={text}
        className="w-full"
      />

      {/* Quick Actions */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex space-x-3">
          <button
            onClick={() => setText('')}
            className="text-white/60 hover:text-white transition-colors"
          >
            Clear
          </button>
          <button
            onClick={() => {
              const examples = ['سلام چطوری؟', 'مرحبا كيف حالك؟', 'नमस्ते कैसे हैं आप?'];
              setText(examples[Math.floor(Math.random() * examples.length)]);
            }}
            className="text-white/60 hover:text-white transition-colors"
          >
            Try Example
          </button>
        </div>

        <div className="text-white/40 text-xs">
          {isLoading ? 'Processing...' : 'Enter to translate • Shift+Enter for new line'}
        </div>
      </div>
    </div>
  );
}