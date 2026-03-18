"use client"

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { ReactNode, useEffect } from 'react'

const CONSENT_COOKIE = "cookie_consent"
const CONSENT_ACCEPTED = "all"
let hasInitialized = false

const getClientCookie = (name: string) => {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export const initPostHog = () => {
  if (hasInitialized) return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com"

  if (!key) return

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false,
  })

  hasInitialized = true
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const consent = getClientCookie(CONSENT_COOKIE)
      if (consent === CONSENT_ACCEPTED) {
        initPostHog()
      }
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
