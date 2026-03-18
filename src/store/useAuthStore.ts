"use client"

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from '@/lib/devAuth'

export type User = {
  id: string
  email?: string
  name?: string
  avatarUrl?: string
  subscriptionStatus?: 'trial' | 'pro' | 'expired'
}

interface AuthState {
  token: string | null
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Actions
  setSession: (session: unknown) => void
  setAuthData: (data: { user: User; token?: string | null }) => void
  clearAuth: () => void
  logout: () => Promise<void>
  setLoading: (isLoading: boolean) => void
  loginAsDevUser: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoading: true,
      isAuthenticated: false,

      setLoading: (isLoading: boolean) => set({ isLoading }),

      setAuthData: ({ user, token = null }) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      clearAuth: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      setSession: (_session: unknown) => {
        // Deprecated path kept for compatibility during migration.
        // NextAuth is now the source of truth and syncs via AuthStoreSync.
      },

      logout: async () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      loginAsDevUser: () => {
        if (!DEV_MOCK_AUTH_ENABLED) return
        set({
          token: DEV_MOCK_USER.accessToken,
          user: {
            id: DEV_MOCK_USER.id,
            email: DEV_MOCK_USER.email,
            name: DEV_MOCK_USER.name,
            subscriptionStatus: 'pro',
          },
          isAuthenticated: true,
          isLoading: false,
        })
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setLoading(false)
        }
      }
    }
  )
)
