"use client";

import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";

interface PlayTTSProps {
  text: string;
  lang?: string;
  voice?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function PlayTTS({
  text,
  lang = "en-US",
  voice,
  variant = "ghost",
  size = "icon",
  className = "",
}: PlayTTSProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authToken = useAuthStore((s) => s.token);

  const play = async () => {
    if (!text || text.trim() === "") {
      setError("No text to play");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedLang = lang && lang !== "auto" ? lang : undefined;
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
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate speech");
      }

      const data = await res.json();

      if (data.audio_b64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);

        audio.onerror = (e) => {
          console.error("❌ Audio element error:", e);
          setError("Failed to load audio");
          setLoading(false);
        };

        audio.onended = () => {
          setLoading(false);
        };

        try {
          await audio.play();
        } catch (err: any) {
          console.error("❌ Audio playback error:", err);
          setError(`Playback failed: ${err.message}`);
          setLoading(false);
        }
      } else {
        throw new Error("No audio data received");
      }
    } catch (err: any) {
      console.error("❌ TTS error:", err);
      setError(err.message || "Failed to generate speech");
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={play}
        disabled={loading || !text}
        className={className}
        title={error || "Play audio"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>
      {error && (
        <span className="text-xs text-destructive" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}
