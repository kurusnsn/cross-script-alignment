"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Logo } from "@/components/Logo";
import { ThemeModeCycleButton } from "@/components/ThemeModeCycleButton";
import { useThemeMode } from "@/hooks/useThemeMode";
import { PRICING, TRIAL_DAYS } from "@/lib/stripe";
import { ArrowRightLeft, BrainCircuit, Languages, TrendingUp } from "lucide-react";

const HeroDemo = dynamic(() => import("@/components/HeroDemo"), {
  loading: () => <div className="w-full max-w-3xl h-[400px] bg-[#2D2D2D] animate-pulse rounded-2xl" />,
  ssr: false
});

export default function Home() {
  const { themeMode, resolvedThemeMode, cycleThemeMode } = useThemeMode();
  const isDarkMode = resolvedThemeMode === "dark";
  const theme = isDarkMode
    ? {
        page: "#262624",
        surface: "#2D2D2D",
        surfaceMuted: "#0D0D0D",
        border: "#404040",
        text: "#FAF9F5",
        textMuted: "rgba(250, 249, 245, 0.62)",
        textSoft: "rgba(250, 249, 245, 0.78)",
        footerMuted: "#9CA3AF",
        headerBg: "rgba(38, 38, 36, 0.82)",
      }
    : {
        page: "#F9F9F8",
        surface: "#FFFFFF",
        surfaceMuted: "#F0F0EE",
        border: "#D8D8D5",
        text: "#1D1D1B",
        textMuted: "rgba(29, 29, 27, 0.62)",
        textSoft: "rgba(29, 29, 27, 0.78)",
        footerMuted: "#6B6B68",
        headerBg: "rgba(249, 249, 248, 0.86)",
      };

  return (
    <div
      className="min-h-screen overflow-x-hidden transition-colors duration-300 selection:bg-[#2DD4BF] selection:text-black"
      style={{ fontFamily: "var(--font-sans)", backgroundColor: theme.page, color: theme.text }}
    >
      <header
        className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md px-6 lg:px-40 py-4"
        style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <h2 className="text-xl font-medium tracking-tight">TranslitAI</h2>
          </div>

          <nav className="flex items-center gap-4">
            <ThemeModeCycleButton
              themeMode={themeMode}
              resolvedThemeMode={resolvedThemeMode}
              onCycle={cycleThemeMode}
            />
            <div className="flex gap-4">
              <Link href="/login">
                <button className="px-5 py-2 bg-[#2DD4BF] text-black text-sm font-medium rounded-lg cursor-pointer">Sign In</button>
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="pt-40 pb-20 px-6 lg:px-40 relative overflow-hidden">
        <div className="absolute inset-0 grid-line opacity-20 pointer-events-none"></div>
        <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center relative z-10">
          <div className="inline-flex items-center gap-3 text-2xl font-medium tracking-tight mb-8" style={{ color: theme.text }}>
            <Logo size={30} />
            TranslitAI
          </div>
          <div className="mt-8 w-full flex justify-center" style={{ fontFamily: "var(--font-serif)" }}>
            <HeroDemo />
          </div>
        </div>
      </main>
      <section className="border-y py-32 px-6 lg:px-40" style={{ borderColor: theme.border, backgroundColor: theme.page }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h3 className="text-3xl font-medium mb-4" style={{ color: theme.text }}>Supported Languages</h3>
            <p className="text-lg" style={{ color: theme.textMuted }}>These are the language families currently available in the aligneration workflow.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-px border" style={{ borderColor: theme.border, backgroundColor: theme.border }}>
            {[
                { char: "A", name: "English" },
                { char: "س", name: "Persian" },
                { char: "ع", name: "Arabic" },
                { char: "ا", name: "Urdu" },
                { char: "अ", name: "Hindi" },
                { char: "Я", name: "Russian" },
                { char: "あ", name: "Japanese" },
                { char: "ㅎ", name: "Korean" },
                { char: "字", name: "Chinese" },
                { char: "ע", name: "Hebrew" },
            ].map((item, i) => (
                <div
                  key={i}
                  className="group p-8 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgba(45,212,191,0.3),0_10px_24px_rgba(45,212,191,0.12)]"
                  style={{ backgroundColor: theme.surface }}
                >
                  <span className="text-4xl font-light text-[#9CA3AF] group-hover:text-[#2DD4BF] transition-colors">{item.char}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-[#9CA3AF] group-hover:text-[#2DD4BF]">{item.name}</span>
                </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 px-6 lg:px-40" style={{ backgroundColor: theme.page }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] text-[10px] font-medium uppercase tracking-widest mb-6">
              Features
            </div>
            <h3 className="text-3xl md:text-4xl font-medium mb-4" style={{ color: theme.text }}>Your language toolkit, unified</h3>
            <p className="text-lg max-w-[680px] mx-auto" style={{ color: theme.textMuted }}>Translation, aligneration, quizzes, and progress tracking — designed to work together.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              className="md:col-span-2 md:row-span-2 rounded-2xl border p-8 flex flex-col gap-6 hover:border-[#2DD4BF]/40 transition-all"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <div className="size-11 rounded-lg border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF]">
                <Languages className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h4 className="text-2xl font-medium">Translation</h4>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.textMuted }}>Context-aware translation that preserves intent, tone, and domain-specific language.</p>
              </div>
              <div className="mt-auto text-xs font-mono" style={{ color: theme.footerMuted }}>Neural context mapping • 10 languages</div>
            </div>

            <div
              className="md:col-span-2 rounded-2xl border p-6 flex flex-col gap-5 hover:border-[#2DD4BF]/40 transition-all"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF]">
                  <ArrowRightLeft className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="text-xl font-medium">Transliteration</h4>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>Lossless script conversion with phonetic precision and language-aware rules.</p>
              <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest" style={{ color: theme.footerMuted }}>
                <span className="px-2 py-1 rounded-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/20">Bidirectional</span>
                <span className="px-2 py-1 rounded-full bg-[#2DD4BF]/10 border border-[#2DD4BF]/20">Custom rules</span>
              </div>
            </div>

            <div
              className="rounded-2xl border p-6 flex flex-col gap-5 hover:border-[#2DD4BF]/40 transition-all"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF]">
                  <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="text-xl font-medium">Quiz</h4>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>Adaptive drills that reinforce memory with spaced repetition.</p>
            </div>

            <div
              className="rounded-2xl border p-6 flex flex-col gap-5 hover:border-[#2DD4BF]/40 transition-all"
              style={{ borderColor: theme.border, backgroundColor: theme.surface }}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF]">
                  <TrendingUp className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="text-xl font-medium">Progress</h4>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>Track streaks, accuracy, and milestones across every script you learn.</p>
            </div>
          </div>
        </div>
      </section>
      <section id="pricing" className="border-y py-32 px-6 lg:px-40" style={{ borderColor: theme.border, backgroundColor: theme.page }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] text-[10px] font-medium uppercase tracking-widest mb-6">
              Pricing
            </div>
            <h3 className="text-3xl md:text-4xl font-medium mb-4" style={{ color: theme.text }}>Simple, transparent pricing</h3>
            <p className="text-lg max-w-[500px] mx-auto" style={{ color: theme.textMuted }}>Start with a {TRIAL_DAYS}-day free trial. No credit card required.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[800px] mx-auto">
            {[
              {
                name: "Monthly",
                price: `$${PRICING.monthly.toFixed(2)}`,
                period: "per month",
                description: "Full access, billed monthly",
                features: ["Unlimited alignerations", "All languages supported", `${TRIAL_DAYS}-day free trial`],
                highlight: false,
              },
              {
                name: "Annual",
                price: `$${PRICING.annualMonthly.toFixed(2)}`,
                period: "per month",
                description: `$${PRICING.annual.toFixed(2)} billed yearly — save 20%`,
                features: ["Everything in Monthly", "Priority support", `${TRIAL_DAYS}-day free trial`],
                highlight: true,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300"
                style={{
                  borderColor: plan.highlight ? "rgba(45,212,191,0.6)" : theme.border,
                  backgroundColor: theme.surface,
                }}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-[10px] font-medium uppercase tracking-widest text-black bg-[#2DD4BF]">
                    Best Value
                  </div>
                )}
                <div>
                  <h4 className="text-xl font-medium">{plan.name}</h4>
                  <p className="mt-3 text-sm" style={{ color: theme.textSoft }}>{plan.description}</p>
                  <div className="mt-6">
                    <div className="text-4xl font-medium" style={{ color: theme.text }}>{plan.price}</div>
                    <div className="text-xs mt-1" style={{ color: theme.footerMuted }}>{plan.period}</div>
                  </div>
                  <ul className="mt-6 space-y-3 text-sm" style={{ color: theme.textSoft }}>
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="inline-flex size-4 rounded-full bg-[#2DD4BF]/20 text-[#2DD4BF] items-center justify-center text-[10px]">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link href="/login">
                  <button
                    className={`mt-8 w-full h-11 rounded-lg font-medium transition-all cursor-pointer ${
                      plan.highlight
                        ? "bg-[#2DD4BF] text-black"
                        : ""
                    }`}
                    style={
                      plan.highlight
                        ? undefined
                        : {
                            border: `1px solid ${theme.border}`,
                            backgroundColor: isDarkMode ? theme.surfaceMuted : theme.surface,
                            color: theme.text,
                          }
                    }
                  >
                    Start Free Trial
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t py-16 px-6 lg:px-40" style={{ borderColor: theme.border, backgroundColor: theme.page }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-bold tracking-tight" style={{ color: theme.text }}>TranslitAI</span>
            </div>

            <p className="text-xs max-w-[200px]" style={{ color: theme.footerMuted }}>All rights reserved.</p>
          </div>
          <div className="flex flex-col gap-3 text-[10px] font-medium uppercase tracking-widest md:items-end">
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/privacy">Privacy</Link>
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/privacy#cookies">Cookie Policy</Link>
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
