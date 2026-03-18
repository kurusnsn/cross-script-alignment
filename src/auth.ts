import NextAuth, { type NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { createClient } from "@supabase/supabase-js"
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from "@/lib/devAuth"
import { AUTH_SECRET } from "@/lib/authSecret"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email and Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || "").trim()
      const password = String(credentials?.password || "")

      // Development fallback user
      if (DEV_MOCK_AUTH_ENABLED && email === DEV_MOCK_USER.email && password === "dev") {
        return {
          id: DEV_MOCK_USER.id,
          email: DEV_MOCK_USER.email,
          name: DEV_MOCK_USER.name,
          accessToken: DEV_MOCK_USER.accessToken,
        }
      }

      if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
        return null
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) return null

      return {
        id: data.user.id,
        email: data.user.email,
        name:
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          data.user.email?.split("@")[0],
        accessToken: data.session?.access_token,
      }
    },
  }),
]

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    })
  )
}

export const { handlers, auth } = NextAuth({
  trustHost: true,
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accessToken = (user as any).accessToken ?? token.accessToken
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id || "")
      }
      session.accessToken = token.accessToken as string | undefined
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: AUTH_SECRET,
})
