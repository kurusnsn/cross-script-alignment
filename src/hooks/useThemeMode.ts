"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";

const resolveSystemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

const applyThemeMode = (mode: ThemeMode) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  if (mode === "system") {
    root.classList.toggle("dark", resolveSystemPrefersDark());
    localStorage.removeItem("theme");
    return;
  }

  root.classList.toggle("dark", mode === "dark");
  localStorage.setItem("theme", mode);
};

const nextThemeMode = (mode: ThemeMode): ThemeMode => {
  if (mode === "light") return "dark";
  if (mode === "dark") return "system";
  return "light";
};

export function useThemeMode(defaultMode: ThemeMode = "system") {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(defaultMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mediaQuery.matches);

    const stored = localStorage.getItem("theme");
    const initialMode: ThemeMode = stored === "light" || stored === "dark" ? stored : defaultMode;
    setThemeModeState(initialMode);
    applyThemeMode(initialMode);
  }, [defaultMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
      if (themeMode === "system") {
        applyThemeMode("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    applyThemeMode(mode);
  };

  const cycleThemeMode = () => {
    setThemeMode(nextThemeMode(themeMode));
  };

  const resolvedThemeMode: ResolvedThemeMode =
    themeMode === "system" ? (systemPrefersDark ? "dark" : "light") : themeMode;

  return {
    themeMode,
    resolvedThemeMode,
    setThemeMode,
    cycleThemeMode,
  };
}
