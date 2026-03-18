"use client"
import { useState, useEffect } from "react"

/**
 * Returns isDarkMode synced to the <html> .dark class and localStorage.
 * Updates immediately when the class changes (e.g. settings toggle).
 */
export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    // Read initial state from DOM (set by layout hydration script)
    setIsDarkMode(document.documentElement.classList.contains("dark"))

    // Watch for class changes so all pages update instantly
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  return isDarkMode
}
