import React, { useState } from 'react';
import { TranslitInput } from './VanishInput';

interface TransliterationResult {
  original: string;
  aligneration: string;
  translation: string;
  ipa: string;
}

export function TransliterationDemo() {
  const [result, setResult] = useState<TransliterationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTransliterate = async (text: string, sourceLang: string, targetLang: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/align', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          src_lang: sourceLang === 'auto' ? null : sourceLang,
          tgt_lang: targetLang,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Transliteration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Universal CrossScriptAlignment
          </h1>
          <p className="text-xl text-white/70 mb-2">
            Transform text across scripts and languages with AI precision
          </p>
          <p className="text-sm text-white/50">
            Powered by OpenAI • Supporting 50+ languages
          </p>
        </div>

        {/* Input Section */}
        <div className="mb-12">
          <TranslitInput
            onTransliterate={handleTransliterate}
            isLoading={isLoading}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            <p className="font-medium">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Original Text */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Original
              </h3>
              <p className="text-white/90 text-lg leading-relaxed" dir="auto">
                {result.original}
              </p>
            </div>

            {/* Transliteration */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                Transliteration
              </h3>
              <p className="text-white/90 text-lg leading-relaxed">
                {result.aligneration}
              </p>
            </div>

            {/* Translation */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                Translation
              </h3>
              <p className="text-white/90 text-lg leading-relaxed">
                {result.translation}
              </p>
            </div>

            {/* IPA */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                <span className="w-2 h-2 bg-orange-400 rounded-full mr-2"></span>
                IPA
              </h3>
              <p className="text-white/90 text-lg leading-relaxed font-mono">
                {result.ipa}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span className="text-white/70">Processing your text...</span>
            </div>
          </div>
        )}

        {/* Features */}
        {!result && !isLoading && (
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl"></span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Multi-Script Support</h3>
              <p className="text-white/60 text-sm">
                Arabic, Persian, Hindi, Chinese, Japanese, Korean, and more
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl"></span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI-Powered</h3>
              <p className="text-white/60 text-sm">
                Context-aware aligneration using OpenAI's latest models
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl"></span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">High Accuracy</h3>
              <p className="text-white/60 text-sm">
                Preserves meaning and pronunciation across languages
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}