"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { PRICING, TRIAL_DAYS } from "@/lib/stripe";
import { useAuthStore } from "@/store/useAuthStore";

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState<"monthly" | "annual" | null>(null);

  const handleCheckout = async (plan: "monthly" | "annual") => {
    if (!user) {
      router.push("/login");
      return;
    }

    setIsLoading(plan);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          email: user.email,
          successUrl: `${window.location.origin}/dashboard/settings?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Stripe error:", data.error);
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    } finally {
      setIsLoading(null);
    }
  };

  const plans = [
    {
      id: "monthly" as const,
      name: "Monthly",
      price: `$${PRICING.monthly.toFixed(2)}`,
      period: "per month",
      description: "Full access, billed monthly",
      features: [
        "Unlimited alignerations",
        "All languages supported",
        `${TRIAL_DAYS}-day free trial`,
      ],
      cta: "Start Free Trial",
      highlight: false,
    },
    {
      id: "annual" as const,
      name: "Annual",
      price: `$${PRICING.annualMonthly.toFixed(2)}`,
      period: "per month",
      description: `$${PRICING.annual.toFixed(2)} billed yearly — save 20%`,
      features: [
        "Everything in Monthly",
        "Priority support",
        `${TRIAL_DAYS}-day free trial`,
      ],
      cta: "Start Free Trial",
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background-dark font-display text-white transition-colors duration-300 selection:bg-primary selection:text-black">
      <header className="fixed top-0 w-full z-50 border-b border-[#283939]/30 bg-background-dark/80 backdrop-blur-md px-6 lg:px-40 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={28} />
            <h2 className="text-xl font-bold tracking-tight">TranslitAI</h2>
          </Link>
          <nav className="flex items-center gap-8">
            <Link href="/login" className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-lg cursor-pointer">Sign In</Link>
          </nav>
        </div>
      </header>

      <main className="pt-40 pb-24 px-6 lg:px-40 relative overflow-hidden">
        <div className="absolute inset-0 grid-line opacity-20 pointer-events-none"></div>
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/20 text-[#2DD4BF] text-[10px] font-bold uppercase tracking-widest mb-6">
              Pricing
            </div>
            <h1 className="text-white text-4xl md:text-6xl font-bold leading-tight tracking-[-0.04em]">
              Simple, transparent pricing
            </h1>
            <p className="mt-6 text-slate-400 text-lg md:text-xl font-normal leading-relaxed max-w-[600px] mx-auto">
              Start with a {TRIAL_DAYS}-day free trial. No credit card required to explore.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[800px] mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 ${
                  plan.highlight
                    ? "border-primary/60 bg-[#0b1313]"
                    : "border-[#283939]/50 bg-[#0a0f0f]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-black bg-[#2DD4BF]">
                    Best Value
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                  </div>
                  <p className="mt-3 text-slate-400 text-sm">{plan.description}</p>

                  <div className="mt-6">
                    <div className="text-4xl font-bold text-white">{plan.price}</div>
                    <div className="text-xs text-slate-500 mt-1">{plan.period}</div>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-slate-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span className="inline-flex size-4 rounded-full bg-primary/20 text-primary items-center justify-center text-[10px]">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isLoading !== null}
                  className={`mt-8 w-full h-11 rounded-lg font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait ${
                    plan.highlight
                      ? "bg-primary text-black"
                      : "border border-[#3b5454] bg-[#1c2727]/30 hover:bg-[#1c2727]"
                  }`}
                >
                  {isLoading === plan.id ? "Redirecting…" : plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#283939]/30 py-16 px-6 lg:px-40 bg-background-dark">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Logo size={24} />
              <span className="font-bold tracking-tight text-slate-300">TranslitAI</span>
            </div>
            <p className="text-xs text-slate-600 max-w-[200px]">All rights reserved.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-4 text-xs font-bold uppercase tracking-widest">
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/privacy">Privacy</Link>
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/privacy#cookies">Cookie Policy</Link>
            <Link className="text-[#2DD4BF] hover:text-[#5EEAD4] transition-colors" href="/terms">Terms</Link>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-700 font-mono">© 2026 TranslitAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
