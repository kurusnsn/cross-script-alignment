"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";
import type { ResolvedThemeMode, ThemeMode } from "@/hooks/useThemeMode";

type ThemeModeCycleButtonProps = {
  themeMode: ThemeMode;
  resolvedThemeMode: ResolvedThemeMode;
  onCycle: () => void;
};

const modeMeta: Record<ThemeMode, { label: string; icon: ComponentType<{ className?: string }> }> = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Monitor },
};

export function ThemeModeCycleButton({ themeMode, resolvedThemeMode, onCycle }: ThemeModeCycleButtonProps) {
  const { icon: Icon, label } = modeMeta[themeMode];
  const isDarkMode = resolvedThemeMode === "dark";

  return (
    <button
      type="button"
      onClick={onCycle}
      className="h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2"
      style={{
        borderColor: isDarkMode ? "#404040" : "#D8D8D5",
        backgroundColor: isDarkMode ? "rgba(45, 45, 43, 0.75)" : "rgba(255, 255, 255, 0.9)",
        color: isDarkMode ? "#FAF9F5" : "#1D1D1B",
      }}
      aria-label={`Theme mode: ${label}. Click to cycle Light, Dark, and System.`}
      title={`Theme: ${label}`}
    >
      <Icon className="h-4 w-4 text-[#2DD4BF]" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
