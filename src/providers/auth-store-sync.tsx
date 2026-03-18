"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useAuthStore } from "@/store/useAuthStore"
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from "@/lib/devAuth"

export default function AuthStoreSync() {
  const { data: session, status } = useSession()
  const { setAuthData, clearAuth, setLoading } = useAuthStore()

  useEffect(() => {
    if (status === "loading") {
      setLoading(true)
      return
    }

    if (status === "authenticated" && session?.user) {
      const isDevMockUser =
        DEV_MOCK_AUTH_ENABLED &&
        session.user.email === DEV_MOCK_USER.email;

      setAuthData({
        user: {
          id: session.user.id,
          email: session.user.email ?? undefined,
          name: session.user.name ?? undefined,
          avatarUrl: session.user.image ?? undefined,
          subscriptionStatus: isDevMockUser ? "pro" : "trial",
        },
        token: session.accessToken ?? null,
      })
      return
    }

    clearAuth()
  }, [status, session, setAuthData, clearAuth, setLoading])

  return null
}
