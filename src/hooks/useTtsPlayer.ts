"use client";

import { useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";

interface TtsOptions {
  text: string;
  langHint?: string;
  voice?: string;
}

export function useTtsPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authToken = useAuthStore((s) => s.token);
  
  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map()); // text|lang -> b64

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(async ({ text, langHint, voice }: TtsOptions) => {
    if (!text.trim()) return;

    // Stop currently playing
    stop();
    setIsLoading(true);
    setError(null);

    const normalizedLang = langHint && langHint !== "auto" ? langHint : undefined;
    const cacheKey = `${text}|${normalizedLang || "auto"}|${voice || "auto"}`;
    
    try {
      let audioB64 = cacheRef.current.get(cacheKey);

      if (!audioB64) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) {
          headers.Authorization = `Bearer ${authToken}`;
        }

        const res = await fetch("/api/tts", {
          method: "POST",
          headers,
          body: JSON.stringify({ text, lang: normalizedLang, voice }),
        });

        if (!res.ok) {
          throw new Error("Failed to generate speech");
        }

        const data = await res.json();
        audioB64 = data.audio_b64;
        
        if (audioB64) {
          cacheRef.current.set(cacheKey, audioB64);
        }
      }

      if (audioB64) {
        const audio = new Audio(`data:audio/mp3;base64,${audioB64}`);
        audioRef.current = audio;

        audio.onplay = () => setIsPlaying(true);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => {
          setError("Playback error");
          setIsPlaying(false);
        };

        await audio.play();
      } else {
        throw new Error("No audio data received");
      }
    } catch (err: any) {
      setError(err.message || "TTS failed");
    } finally {
      setIsLoading(false);
    }
  }, [authToken, stop]);

  return { play, stop, isPlaying, isLoading, error };
}
