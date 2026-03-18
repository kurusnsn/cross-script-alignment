"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { DEV_MOCK_AUTH_ENABLED, DEV_MOCK_USER } from "@/lib/devAuth";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // In dev mode, auto-login with credentials fallback account
  useEffect(() => {
    if (!DEV_MOCK_AUTH_ENABLED) return;
    if (status !== "unauthenticated") return;

    void signIn("credentials", {
      email: DEV_MOCK_USER.email,
      password: "dev",
      redirect: false,
      callbackUrl: "/dashboard",
    });
  }, [status]);

  // Redirect only after auth state is confirmed
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, router])

  // Safely read URL error param on the client only
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setUrlError(err);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadProviders = async () => {
      try {
        const providers = await getProviders();
        if (!mounted) return;
        setGoogleEnabled(Boolean(providers?.google));
      } catch {
        if (!mounted) return;
        setGoogleEnabled(false);
      }
    };

    void loadProviders();
    return () => {
      mounted = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (!googleEnabled) {
      setError("Google sign-in is not configured on this server.");
      return;
    }

    setIsGoogleLoading(true);
    setError(null);

    try {
      const result = await signIn("google", {
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.error) {
        setError("Google sign-in failed. Check OAuth redirect configuration.");
        setIsGoogleLoading(false);
        return;
      }

      if (result?.url) {
        window.location.href = result.url;
        return;
      }

      setError("Unable to start Google sign-in.");
      setIsGoogleLoading(false);
    } catch {
      setError("Unable to start Google sign-in.");
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
          callbackUrl: "/dashboard",
        });

        if (result?.error) {
          setError("Invalid email or password");
        } else {
          router.push("/dashboard");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) {
          setError(error.message);
        } else {
          setMessage("Check your email for a confirmation link.");
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050808] font-display text-white flex flex-col">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b border-[#2DD4BF]/20 bg-[#050808]/80 backdrop-blur-md px-6 lg:px-40 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={28} />
            <h2 className="text-xl font-bold tracking-tight">TranslitAI</h2>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-3">
              {isLogin ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-slate-400">
              {isLogin ? "Sign in to continue to TranslitAI" : "Get started with TranslitAI"}
            </p>
          </div>

          {(error || urlError) && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {error ||
                (urlError === "Configuration"
                  ? "Google sign-in is not configured on this server."
                  : "Authentication failed. Please try again.")}
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 text-[#2DD4BF] text-sm text-center">
              {message}
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || googleEnabled !== true}
            className="w-full flex items-center justify-center gap-3 h-14 border border-[#2DD4BF]/35 rounded-lg hover:bg-[#2DD4BF]/10 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed bg-[#0a0f0f]"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium">
              {isGoogleLoading
                ? "Redirecting..."
                : googleEnabled === false
                  ? "Google unavailable"
                  : "Continue with Google"}
            </span>
          </button>

          {/* Divider */}
          <div className="my-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#2DD4BF]/30"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#050808] text-slate-500">Or continue with email</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-[#0a0f0f] border border-[#2DD4BF]/30 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/50 focus:border-[#2DD4BF] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-[#0a0f0f] border border-[#2DD4BF]/30 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]/50 focus:border-[#2DD4BF] transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#2DD4BF] text-black font-bold rounded-lg glow-on-hover transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? "Loading..." : isLogin ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
                className="text-[#2DD4BF] hover:underline font-medium"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-[#2DD4BF] hover:underline">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-[#2DD4BF] hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2DD4BF]/20 py-6 px-6">
        <div className="max-w-[1200px] mx-auto flex justify-center">
          <p className="text-xs text-slate-600">© 2026 TranslitAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
