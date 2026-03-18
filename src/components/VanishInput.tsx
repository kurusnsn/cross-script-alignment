"use client"

import React, { useState, useRef, useEffect } from 'react';
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
  const [typedText, setTypedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (isFocused || inputValue || placeholders.length === 0) {
      setTypedText("");
      setIsDeleting(false);
      return;
    }

    const currentText = placeholders[currentPlaceholder] || "";
    const typingSpeed = 55;
    const deletingSpeed = 32;
    const pauseAfterTyped = 1200;
    const pauseAfterDeleted = 250;

    if (!isDeleting && typedText === currentText) {
      const timeout = setTimeout(() => setIsDeleting(true), pauseAfterTyped);
      return () => clearTimeout(timeout);
    }

    if (isDeleting && typedText === "") {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setCurrentPlaceholder((prev) => (prev + 1) % placeholders.length);
      }, pauseAfterDeleted);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      const nextText = isDeleting
        ? currentText.slice(0, typedText.length - 1)
        : currentText.slice(0, typedText.length + 1);
      setTypedText(nextText);
    }, isDeleting ? deletingSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [currentPlaceholder, inputValue, isDeleting, isFocused, placeholders, typedText]);

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
        vanish-input-container relative bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-800/50
        backdrop-blur-sm rounded-2xl border-2 transition-all duration-300 shadow-sm
        ${isFocused ? 'focused border-blue-500/50 shadow-lg shadow-blue-500/10' : 'border-slate-200 dark:border-slate-700'}
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
                <span className="vanish-placeholder text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                  {typedText}
                  <span className="inline-block ml-0.5 w-[2px] h-5 align-middle bg-slate-400/70 dark:bg-slate-500/70 animate-pulse" />
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
              vanish-input-textarea w-full bg-transparent text-slate-900 dark:text-slate-100 text-lg leading-relaxed p-4
              resize-none focus:outline-none placeholder-transparent
              min-h-[120px] max-h-[200px] transition-all duration-200
              ${inputValue ? 'min-h-[140px]' : 'min-h-[120px]'}
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
                className="absolute bottom-4 right-4 text-slate-400 dark:text-slate-500 text-sm font-medium"
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
              <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                {inputValue.length} characters
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
