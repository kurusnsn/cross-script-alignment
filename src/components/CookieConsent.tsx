"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { initPostHog } from "@/providers/posthog-provider"

const CONSENT_COOKIE = "cookie_consent"
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365

const getClientCookie = (name: string) => {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

const setClientCookie = (name: string, value: string, maxAgeSeconds: number) => {
  if (typeof document === "undefined") return
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

export default function CookieConsent() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const consent = getClientCookie(CONSENT_COOKIE)
    setIsOpen(!consent)
  }, [])

  const handleAcceptAll = () => {
    setClientCookie(CONSENT_COOKIE, "all", CONSENT_MAX_AGE)
    initPostHog()
    setIsOpen(false)
  }

  const handleNecessaryOnly = () => {
    setClientCookie(CONSENT_COOKIE, "necessary", CONSENT_MAX_AGE)
    setIsOpen(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#283939]/60 bg-[#0F0F0D]/95 p-5 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">We use cookies</p>
            <p className="text-xs text-slate-300">
              We use essential cookies to keep the site working. With your permission, we also use
              analytics cookies to understand usage and improve the product. Read our {" "}
              <Link href="#" className="underline underline-offset-4 text-slate-200 hover:text-white">
                Privacy Policy
              </Link>.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={handleNecessaryOnly}
            >
              Only necessary
            </Button>
            <Button className="bg-primary text-black hover:bg-primary/90" onClick={handleAcceptAll}>
              Accept all
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
