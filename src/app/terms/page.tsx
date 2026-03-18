"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeModeCycleButton } from "@/components/ThemeModeCycleButton";
import { useThemeMode } from "@/hooks/useThemeMode";

export default function TermsOfServicePage() {
  const { themeMode, resolvedThemeMode, cycleThemeMode } = useThemeMode();
  const isDarkMode = resolvedThemeMode === "dark";
  const theme = isDarkMode
    ? {
        page: "#050808",
        border: "rgba(40, 57, 57, 0.3)",
        headerBg: "rgba(5, 8, 8, 0.82)",
        text: "#FAF9F5",
        textSoft: "#CBD5E1",
        textMuted: "#94A3B8",
        textFaint: "#64748B",
      }
    : {
        page: "#F9F9F8",
        border: "#D8D8D5",
        headerBg: "rgba(249, 249, 248, 0.9)",
        text: "#1D1D1B",
        textSoft: "#334155",
        textMuted: "#6B6B68",
        textFaint: "#8A8A86",
      };

  return (
    <div
      className="min-h-screen font-display transition-colors duration-300 selection:bg-primary selection:text-black"
      style={{ backgroundColor: theme.page, color: theme.text }}
    >
      <header
        className="fixed top-0 w-full z-50 border-b backdrop-blur-md px-6 lg:px-40 py-4"
        style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={28} />
            <h2 className="text-xl font-bold tracking-tight">TranslitAI</h2>
          </Link>
          <nav className="flex items-center gap-4">
            <ThemeModeCycleButton
              themeMode={themeMode}
              resolvedThemeMode={resolvedThemeMode}
              onCycle={cycleThemeMode}
            />
            <Link className="hidden md:block text-sm font-medium hover:text-primary transition-colors" style={{ color: theme.textMuted }} href="#">Documentation</Link>
            <Link className="hidden md:block text-sm font-medium hover:text-primary transition-colors" style={{ color: theme.textMuted }} href="#">Scripts</Link>
            <Link href="/login" className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-lg glow-on-hover cursor-pointer">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="pt-40 pb-24 px-6 lg:px-40 relative overflow-hidden">
        <div className="absolute inset-0 grid-line opacity-20 pointer-events-none"></div>
        <div className="max-w-[900px] mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest mb-6">
            Terms of Service
          </div>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-[-0.04em]" style={{ color: theme.text }}>
            Terms of Service
          </h1>
          <p className="mt-4 text-sm" style={{ color: theme.textMuted }}>Effective date: February 10, 2026</p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed" style={{ color: theme.textSoft }}>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Agreement to Terms</h2>
              <p>
                By accessing or using TranslitAI, you agree to these Terms of Service. If you do not
                agree, do not use the service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Use of the Service</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>You must comply with applicable laws and regulations.</li>
                <li>You are responsible for activity under your account.</li>
                <li>You may not misuse or interfere with the service.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Subscriptions & Billing</h2>
              <p>
                Paid plans renew according to the billing cycle unless cancelled. Fees are non-refundable
                except as required by law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Intellectual Property</h2>
              <p>
                The service, software, and content are owned by TranslitAI and its licensors and are
                protected by intellectual property laws.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Termination</h2>
              <p>
                We may suspend or terminate access to the service if you violate these terms or for
                security reasons.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Disclaimer</h2>
              <p>
                The service is provided “as is” without warranties of any kind. We disclaim all implied
                warranties to the fullest extent permitted by law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, TranslitAI will not be liable for any indirect,
                incidental, special, or consequential damages.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold" style={{ color: theme.text }}>Contact</h2>
              <p>
                Questions? Email us at <span style={{ color: theme.text }}>support@alignai.com</span>.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t py-16 px-6 lg:px-40" style={{ borderColor: theme.border, backgroundColor: theme.page }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-bold tracking-tight" style={{ color: theme.text }}>TranslitAI</span>
            </div>
            <p className="text-xs max-w-[200px]" style={{ color: theme.textMuted }}>All rights reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-xs font-bold uppercase tracking-widest">
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/privacy">Privacy</Link>
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/terms">Terms</Link>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono" style={{ color: theme.textFaint }}>© 2026 TranslitAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
