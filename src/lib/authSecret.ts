import { randomBytes } from "crypto"

const explicitAuthSecret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.SUPABASE_JWT_SECRET

const fallbackServerSecret =
  process.env.STRIPE_SECRET_KEY ??
  process.env.STRIPE_API_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

const generatedFallbackSecret = randomBytes(32).toString("hex")

export const AUTH_SECRET = (() => {
  if (explicitAuthSecret?.trim()) return explicitAuthSecret.trim()

  if (fallbackServerSecret?.trim()) {
    console.warn(
      "[auth] AUTH_SECRET is not configured; using a server-only fallback secret. Set AUTH_SECRET explicitly in production."
    )
    return fallbackServerSecret.trim()
  }

  console.warn(
    "[auth] No auth secret env vars found; using an ephemeral fallback secret for this process. Set AUTH_SECRET in production."
  )

  return generatedFallbackSecret
})()
