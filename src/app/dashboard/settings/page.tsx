"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Moon,
  Sun,
  Monitor,
  Volume2,
  Lock,
  Palette,
  CreditCard,
  Check,
  Sparkles,
  Download,
  ExternalLink,
  Receipt,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  Loader2,
} from "lucide-react"
import { useAuthStore } from "@/store/useAuthStore"
import { Logo } from "@/components/Logo"
import { PRICING } from "@/lib/stripe"


// ─── Types ─────────────────────────────────────────────

interface SubscriptionData {
  plan: 'monthly' | 'annual' | 'none' | 'unknown'
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  stripeCustomerId: string | null
  subscriptionId?: string
}

interface Invoice {
  id: string
  date: string | null
  amount: number
  currency: string
  status: string
  description: string
  invoicePdf: string | null
  hostedUrl: string | null
}

type ThemeMode = 'light' | 'dark' | 'system'
const LOGO_TEAL = '#2DD4BF'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')

  const applyThemeMode = useCallback((mode: ThemeMode) => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const nextIsDark = mode === 'dark' || (mode === 'system' && prefersDark)

    document.documentElement.classList.toggle('dark', nextIsDark)
    setIsDarkMode(nextIsDark)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const initialMode: ThemeMode =
      saved === 'light' || saved === 'dark' || saved === 'system'
        ? saved
        : 'system'
    setThemeMode(initialMode)
    applyThemeMode(initialMode)
  }, [applyThemeMode])

  useEffect(() => {
    if (themeMode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = () => applyThemeMode('system')
    media.addEventListener('change', handleSystemThemeChange)
    return () => media.removeEventListener('change', handleSystemThemeChange)
  }, [themeMode, applyThemeMode])
  const [soundEffects, setSoundEffects] = useState(true)
  const [fontPreference, setFontPreference] = useState<'serif' | 'sans'>('sans')
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // ─── Subscription state (fetched from backend) ───────
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [subLoading, setSubLoading] = useState(true)

  // ─── Billing history ─────────────────────────────────
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)

  // ─── Action states ───────────────────────────────────
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState<'monthly' | 'annual' | null>(null)

  // Pricing
  const MONTHLY_PRICE = PRICING.monthly
  const ANNUAL_PRICE = PRICING.annual
  const ANNUAL_MONTHLY_EQUIVALENT = PRICING.annualMonthly

  // ─── Fetch subscription data ─────────────────────────
  const fetchSubscription = useCallback(async () => {
    setSubLoading(true)
    try {
      const res = await fetch('/api/stripe/subscription')
      if (!res.ok) throw new Error('Failed to fetch subscription')
      const data: SubscriptionData = await res.json()
      setSubscription(data)
    } catch {
      setSubscription({ plan: 'none', status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false, stripeCustomerId: null })
    } finally {
      setSubLoading(false)
    }
  }, [])

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    try {
      const res = await fetch('/api/stripe/billing-history')
      if (!res.ok) throw new Error('Failed to fetch invoices')
      const data = await res.json()
      setInvoices(data.invoices || [])
    } catch {
      setInvoices([])
    } finally {
      setInvoicesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscription()
    fetchInvoices()
  }, [fetchSubscription, fetchInvoices])

  // ─── Helpers ─────────────────────────────────────────

  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'
  const isTrial = subscription?.status === 'trialing' || subscription?.status === 'none' || subscription?.plan === 'none'
  const isCanceled = subscription?.cancelAtPeriodEnd === true

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'trialing': case 'paid': return LOGO_TEAL
      case 'past_due': case 'open': return '#f59e0b'
      case 'canceled': case 'void': case 'uncollectible': return '#ef4444'
      default: return '#94a3b8'
    }
  }

  const getStatusLabel = () => {
    if (!subscription) return 'Loading…'
    if (isCanceled) return 'Cancels at period end'
    switch (subscription.status) {
      case 'active': return subscription.plan === 'annual' ? 'Annual' : 'Monthly'
      case 'trialing': return 'Free Trial'
      case 'past_due': return 'Past Due'
      case 'canceled': return 'Cancelled'
      default: return 'No Plan'
    }
  }

  // ─── Theme ───────────────────────────────────────────
  const theme = {
    light: {
      bg: '#FAF9F5',
      text: '#0E0E0D',
      accent: LOGO_TEAL,
      border: '#e8e8e6',
      card: '#ffffff',
      codeBg: '#f5f5f4'
    },
    dark: {
      bg: '#262624',
      text: '#FAF9F5',
      accent: LOGO_TEAL,
      border: '#404040',
      card: '#2D2D2D',
      codeBg: '#0D0D0D'
    }
  }

  const currentTheme = isDarkMode ? theme.dark : theme.light

  const fontStacks = {
    serif: {
      family: '"Georgia", "Iowan Old Style", "Times New Roman", serif',
      size: '17px',
      lineHeight: '1.6'
    },
    sans: {
      family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      size: '17px',
      lineHeight: '1.6'
    }
  }

  // ─── Handlers ────────────────────────────────────────

  /** New subscriber: redirect to Stripe Checkout */
  const handleUpgrade = async (plan: 'monthly' | 'annual') => {
    setIsUpgrading(true)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          email: user?.email,
          successUrl: `${window.location.origin}/dashboard/settings?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/settings?canceled=true`,
        }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        console.error('Stripe error:', data.error)
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error)
    } finally {
      setIsUpgrading(false)
    }
  }

  /** Existing subscriber: switch plan in-place */
  const handleSwitchPlan = async (plan: 'monthly' | 'annual') => {
    setIsSwitching(true)
    try {
      const res = await fetch('/api/stripe/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) throw new Error('Failed to switch plan')
      setShowSwitchConfirm(null)
      await fetchSubscription()
      await fetchInvoices()
    } catch (error) {
      console.error('Failed to switch plan:', error)
    } finally {
      setIsSwitching(false)
    }
  }

  /** Cancel subscription (graceful: cancel at period end) */
  const handleCancelSubscription = async () => {
    if (!showCancelConfirm) {
      setShowCancelConfirm(true)
      return
    }
    setIsCancelling(true)
    try {
      const res = await fetch('/api/stripe/subscription', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to cancel subscription')
      setShowCancelConfirm(false)
      await fetchSubscription()
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
    } finally {
      setIsCancelling(false)
    }
  }

  /** Open Stripe customer portal for full management */
  const handleManageSubscription = async () => {
    if (!subscription?.stripeCustomerId) return
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: subscription.stripeCustomerId }),
      })
      const data = await response.json()
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error('Failed to open customer portal:', error)
    }
  }

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPasswordStatus(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Please fill in all password fields.' })
      return
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'New password must be at least 6 characters.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    if (currentPassword === newPassword) {
      setPasswordStatus({ type: 'error', message: 'New password must be different from your current password.' })
      return
    }

    setIsUpdatingPassword(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      })

      const data = await response.json().catch(() => ({} as Record<string, string>))

      if (!response.ok) {
        setPasswordStatus({
          type: 'error',
          message: data?.error || 'Failed to update password.',
        })
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' })
    } catch {
      setPasswordStatus({ type: 'error', message: 'Failed to update password.' })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div 
      className="min-h-screen p-8"
      style={{ 
        backgroundColor: currentTheme.bg, 
        color: currentTheme.text,
        fontFamily: fontStacks[fontPreference].family,
        fontSize: fontStacks[fontPreference].size,
        lineHeight: fontStacks[fontPreference].lineHeight,
        letterSpacing: '-0.012em'
      }}
    >
      {/* Page Header */}
      <div className="mb-8 pb-4 border-b max-w-3xl" style={{ borderColor: currentTheme.border }}>
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm" style={{ opacity: 0.6 }}>Customize your TranslitAI experience</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl space-y-8">
        
        {/* ════════════════ Billing Section ════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} style={{ color: currentTheme.accent }} />
            <h2 className="text-lg font-semibold">Billing & Subscription</h2>
          </div>
          
          <div 
            className="rounded-xl p-5 space-y-5"
            style={{ backgroundColor: currentTheme.card, border: `0.5px solid ${currentTheme.border}` }}
          >
            {/* ── Loading skeleton ── */}
            {subLoading ? (
              <div className="flex items-center gap-3 py-4">
                <Loader2 size={20} className="animate-spin" style={{ color: currentTheme.accent }} />
                <span className="text-sm" style={{ opacity: 0.6 }}>Loading subscription…</span>
              </div>
            ) : (
              <>
                {/* ── Current Plan Status ── */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-base font-medium">Current Plan</Label>
                      <Badge
                        variant={isTrial ? 'secondary' : 'default'}
                        style={{
                          backgroundColor: isActive && !isTrial ? currentTheme.accent : undefined,
                          color: isActive && !isTrial ? '#ffffff' : undefined,
                        }}
                      >
                        {getStatusLabel()}
                      </Badge>
                      {isCanceled && (
                        <Badge variant="outline" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
                          Ending soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm" style={{ opacity: 0.6 }}>
                      {isCanceled && subscription?.currentPeriodEnd && (
                        <>Access until {formatDate(subscription.currentPeriodEnd)}</>
                      )}
                      {!isCanceled && isActive && !isTrial && subscription?.currentPeriodEnd && (
                        <>Next billing: {formatDate(subscription.currentPeriodEnd)}</>
                      )}
                      {subscription?.status === 'trialing' && subscription?.currentPeriodEnd && (
                        <>Trial ends {formatDate(subscription.currentPeriodEnd)}</>
                      )}
                      {subscription?.status === 'past_due' && (
                        <span style={{ color: '#f59e0b' }}>
                          <AlertTriangle size={12} className="inline mr-1" />
                          Payment past due — please update your payment method
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {subscription?.stripeCustomerId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManageSubscription}
                        style={{
                          borderColor: currentTheme.border,
                          color: currentTheme.text,
                          backgroundColor: currentTheme.codeBg,
                        }}
                      >
                        <ExternalLink size={14} className="mr-1" />
                        Manage
                      </Button>
                    )}
                  </div>
                </div>

                <div className="h-px" style={{ backgroundColor: currentTheme.border }} />

                {/* ── Plan Options ── */}
                <div>
                  <Label className="text-base font-medium mb-4 block">
                    {isActive && !isTrial ? 'Switch Plan' : 'Choose Your Plan'}
                  </Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Monthly Plan Card */}
                    <button
                      onClick={() => {
                        if (isActive && !isTrial && subscription?.plan !== 'monthly') {
                          setShowSwitchConfirm('monthly')
                        } else if (isTrial || !isActive) {
                          handleUpgrade('monthly')
                        }
                      }}
                      disabled={isUpgrading || (isActive && subscription?.plan === 'monthly' && !isCanceled)}
                      className="relative p-4 rounded-xl text-left transition-all disabled:opacity-60"
                      style={{
                        border: `2px solid ${subscription?.plan === 'monthly' && isActive ? currentTheme.accent : currentTheme.border}`,
                        backgroundColor: subscription?.plan === 'monthly' && isActive ? `${currentTheme.accent}10` : 'transparent',
                      }}
                    >
                      {subscription?.plan === 'monthly' && isActive && (
                        <div className="absolute -top-2 -left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: currentTheme.accent, color: '#fff' }}>
                          Current
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold">Monthly</h3>
                          <p className="text-sm" style={{ opacity: 0.6 }}>Billed monthly</p>
                        </div>
                        {subscription?.plan === 'monthly' && isActive && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: currentTheme.accent }}>
                            <Check size={12} color="#fff" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">${MONTHLY_PRICE.toFixed(2)}</span>
                        <span className="text-sm" style={{ opacity: 0.6 }}>/month</span>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm" style={{ opacity: 0.8 }}>
                        <li className="flex items-center gap-2">
                          <Check size={14} style={{ color: currentTheme.accent }} />
                          Unlimited alignerations
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} style={{ color: currentTheme.accent }} />
                          All languages
                        </li>
                      </ul>
                      {isActive && !isTrial && subscription?.plan !== 'monthly' && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-1 text-xs font-medium"
                          style={{ borderColor: currentTheme.border, color: currentTheme.accent }}>
                          <ArrowRightLeft size={12} /> Switch to Monthly
                        </div>
                      )}
                    </button>

                    {/* Annual Plan Card */}
                    <button
                      onClick={() => {
                        if (isActive && !isTrial && subscription?.plan !== 'annual') {
                          setShowSwitchConfirm('annual')
                        } else if (isTrial || !isActive) {
                          handleUpgrade('annual')
                        }
                      }}
                      disabled={isUpgrading || (isActive && subscription?.plan === 'annual' && !isCanceled)}
                      className="relative p-4 rounded-xl text-left transition-all disabled:opacity-60"
                      style={{
                        border: `2px solid ${subscription?.plan === 'annual' && isActive ? currentTheme.accent : currentTheme.border}`,
                        backgroundColor: subscription?.plan === 'annual' && isActive ? `${currentTheme.accent}10` : 'transparent',
                      }}
                    >
                      {subscription?.plan === 'annual' && isActive ? (
                        <div className="absolute -top-2 -left-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: currentTheme.accent, color: '#fff' }}>
                          Current
                        </div>
                      ) : (
                        <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
                          style={{ backgroundColor: currentTheme.accent, color: '#0E0E0D' }}>
                          <Sparkles size={10} />
                          Save 20%
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold">Annual</h3>
                          <p className="text-sm" style={{ opacity: 0.6 }}>Billed yearly</p>
                        </div>
                        {subscription?.plan === 'annual' && isActive && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: currentTheme.accent }}>
                            <Check size={12} color="#fff" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">${ANNUAL_MONTHLY_EQUIVALENT.toFixed(2)}</span>
                        <span className="text-sm" style={{ opacity: 0.6 }}>/month</span>
                      </div>
                      <p className="text-xs mt-1" style={{ opacity: 0.6 }}>
                        ${ANNUAL_PRICE.toFixed(2)} billed annually
                      </p>
                      <ul className="mt-3 space-y-1 text-sm" style={{ opacity: 0.8 }}>
                        <li className="flex items-center gap-2">
                          <Check size={14} style={{ color: currentTheme.accent }} />
                          Everything in Monthly
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} style={{ color: currentTheme.accent }} />
                          Priority support
                        </li>
                        <li className="flex items-center gap-2">
                          <Check size={14} style={{ color: currentTheme.accent }} />
                          Early access features
                        </li>
                      </ul>
                      {isActive && !isTrial && subscription?.plan !== 'annual' && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-1 text-xs font-medium"
                          style={{ borderColor: currentTheme.border, color: currentTheme.accent }}>
                          <ArrowRightLeft size={12} /> Switch to Annual & Save
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* ── Switch Plan Confirmation ── */}
                {showSwitchConfirm && (
                  <>
                    <div className="h-px" style={{ backgroundColor: currentTheme.border }} />
                    <div
                      className="rounded-lg p-4 flex items-center justify-between"
                      style={{ backgroundColor: `${currentTheme.accent}10`, border: `1px solid ${currentTheme.accent}30` }}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          Switch to {showSwitchConfirm === 'annual' ? 'Annual' : 'Monthly'}?
                        </p>
                        <p className="text-xs mt-1" style={{ opacity: 0.6 }}>
                          {showSwitchConfirm === 'annual'
                            ? `You'll be charged $${ANNUAL_PRICE.toFixed(2)}/year (prorated). Save 20% vs monthly.`
                            : `You'll be charged $${MONTHLY_PRICE.toFixed(2)}/month starting next cycle.`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSwitchConfirm(null)}
                          style={{ borderColor: currentTheme.border }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSwitchPlan(showSwitchConfirm)}
                          disabled={isSwitching}
                          style={{ backgroundColor: currentTheme.accent, color: '#fff' }}
                        >
                          {isSwitching ? (
                            <><Loader2 size={14} className="animate-spin mr-1" /> Switching…</>
                          ) : (
                            'Confirm Switch'
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Upgrade CTA (trial / no plan) ── */}
                {(isTrial || !isActive) && !showSwitchConfirm && (
                  <>
                    <div className="h-px" style={{ backgroundColor: currentTheme.border }} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm" style={{ opacity: 0.6 }}>
                        Upgrade now to unlock all features
                      </p>
                      <Button
                        onClick={() => handleUpgrade('annual')}
                        disabled={isUpgrading}
                        style={{ backgroundColor: currentTheme.accent, color: '#fff' }}
                      >
                        {isUpgrading ? (
                          <><Loader2 size={14} className="animate-spin mr-1" /> Processing…</>
                        ) : (
                          'Upgrade Now'
                        )}
                      </Button>
                    </div>
                  </>
                )}

                {/* ── Cancel Subscription ── */}
                {isActive && !isTrial && !isCanceled && (
                  <>
                    <div className="h-px" style={{ backgroundColor: currentTheme.border }} />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Cancel Subscription</p>
                          <p className="text-xs" style={{ opacity: 0.6 }}>
                            {showCancelConfirm
                              ? "Are you sure? You'll keep access until the end of your billing period."
                              : "You can cancel anytime. Access continues until billing period ends."}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {showCancelConfirm && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowCancelConfirm(false)}
                              style={{ borderColor: currentTheme.border }}
                            >
                              Keep Plan
                            </Button>
                          )}
                          <Button
                            variant={showCancelConfirm ? "destructive" : "outline"}
                            size="sm"
                            onClick={handleCancelSubscription}
                            disabled={isCancelling}
                            style={!showCancelConfirm ? { borderColor: currentTheme.border, color: '#ef4444' } : {}}
                          >
                            {isCancelling ? (
                              <><Loader2 size={14} className="animate-spin mr-1" /> Cancelling…</>
                            ) : showCancelConfirm ? 'Confirm Cancel' : 'Cancel Plan'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── Cancelled — resubscribe ── */}
                {isCanceled && (
                  <>
                    <div className="h-px" style={{ backgroundColor: currentTheme.border }} />
                    <div
                      className="rounded-lg p-4 flex items-center justify-between"
                      style={{ backgroundColor: '#fef2f210', border: '1px solid #ef444430' }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#ef4444' }}>
                          Subscription ending
                        </p>
                        <p className="text-xs mt-1" style={{ opacity: 0.6 }}>
                          Your access will end on {subscription?.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : '—'}.
                          Resubscribe anytime to keep your plan.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleUpgrade(subscription?.plan === 'annual' ? 'annual' : 'monthly')}
                        style={{ backgroundColor: currentTheme.accent, color: '#fff' }}
                      >
                        <RefreshCw size={14} className="mr-1" /> Resubscribe
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>

        {/* ════════════════ Billing History ════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Receipt size={18} style={{ color: currentTheme.accent }} />
            <h2 className="text-lg font-semibold">Billing History</h2>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: currentTheme.card, border: `0.5px solid ${currentTheme.border}` }}
          >
            {invoicesLoading ? (
              <div className="flex items-center gap-3 py-4">
                <Loader2 size={20} className="animate-spin" style={{ color: currentTheme.accent }} />
                <span className="text-sm" style={{ opacity: 0.6 }}>Loading billing history…</span>
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ opacity: 0.5 }}>
                No billing history yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${currentTheme.border}` }}>
                      <th className="text-left py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ opacity: 0.5 }}>Date</th>
                      <th className="text-left py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ opacity: 0.5 }}>Description</th>
                      <th className="text-right py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ opacity: 0.5 }}>Amount</th>
                      <th className="text-center py-2 pr-4 font-medium text-xs uppercase tracking-wider" style={{ opacity: 0.5 }}>Status</th>
                      <th className="text-right py-2 font-medium text-xs uppercase tracking-wider" style={{ opacity: 0.5 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr
                        key={inv.id}
                        style={{ borderBottom: `1px solid ${currentTheme.border}` }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {inv.date ? formatDate(inv.date) : '—'}
                        </td>
                        <td className="py-3 pr-4" style={{ opacity: 0.8 }}>
                          {inv.description}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium whitespace-nowrap">
                          ${inv.amount.toFixed(2)} {inv.currency}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: `${getStatusColor(inv.status)}20`,
                              color: getStatusColor(inv.status),
                            }}
                          >
                            {inv.status === 'paid' ? 'Paid' :
                             inv.status === 'open' ? 'Pending' :
                             inv.status === 'void' ? 'Void' :
                             inv.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {inv.invoicePdf && (
                            <a
                              href={inv.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-70 transition-opacity"
                              style={{ color: currentTheme.accent }}
                            >
                              <Download size={12} /> PDF
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ════════════════ Appearance ════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette size={18} style={{ color: currentTheme.accent }} />
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>
          
          <div 
            className="rounded-xl p-5 space-y-5"
            style={{ backgroundColor: currentTheme.card, border: `0.5px solid ${currentTheme.border}` }}
          >
            {/* Theme Options */}
            <div>
              <Label className="text-base font-medium mb-3 block">Theme Options</Label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => { setThemeMode('light'); applyThemeMode('light'); }}
                  className="h-20 flex flex-col items-center justify-center gap-2 rounded-lg border transition-all"
                  style={{ 
                    borderColor: themeMode === 'light' ? currentTheme.accent : currentTheme.border,
                    backgroundColor: themeMode === 'light' ? `${currentTheme.accent}18` : currentTheme.codeBg
                  }}
                >
                  <Sun size={20} />
                  <span className="text-sm">Light</span>
                </button>
                <button 
                  onClick={() => { setThemeMode('dark'); applyThemeMode('dark'); }}
                  className="h-20 flex flex-col items-center justify-center gap-2 rounded-lg border transition-all"
                  style={{ 
                    borderColor: themeMode === 'dark' ? currentTheme.accent : currentTheme.border,
                    backgroundColor: themeMode === 'dark' ? `${currentTheme.accent}18` : currentTheme.codeBg
                  }}
                >
                  <Moon size={20} />
                  <span className="text-sm">Dark</span>
                </button>
                <button 
                  onClick={() => { setThemeMode('system'); applyThemeMode('system'); }}
                  className="h-20 flex flex-col items-center justify-center gap-2 rounded-lg border transition-all"
                  style={{
                    borderColor: themeMode === 'system' ? currentTheme.accent : currentTheme.border,
                    backgroundColor: themeMode === 'system' ? `${currentTheme.accent}18` : currentTheme.codeBg
                  }}
                >
                  <Monitor size={20} />
                  <span className="text-sm">System</span>
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ opacity: 0.6 }}>
                Active appearance: {isDarkMode ? 'Dark' : 'Light'}
              </p>
            </div>

            <div className="h-px" style={{ backgroundColor: currentTheme.border }} />

            {/* Font Preference */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Font Style</Label>
                <p className="text-sm" style={{ opacity: 0.6 }}>
                  Choose your preferred reading font
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFontPreference('sans')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: fontPreference === 'sans' ? currentTheme.accent : currentTheme.codeBg,
                    color: fontPreference === 'sans' ? '#ffffff' : currentTheme.text
                  }}
                >
                  Sans
                </button>
                <button
                  onClick={() => setFontPreference('serif')}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: fontPreference === 'serif' ? currentTheme.accent : currentTheme.codeBg,
                    color: fontPreference === 'serif' ? '#ffffff' : currentTheme.text
                  }}
                >
                  Serif
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════ Account Security ════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Lock size={18} style={{ color: currentTheme.accent }} />
            <h2 className="text-lg font-semibold">Account Security</h2>
          </div>

          <div
            className="rounded-xl p-5 space-y-5"
            style={{ backgroundColor: currentTheme.card, border: `0.5px solid ${currentTheme.border}` }}
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="current-password" className="text-sm font-medium">Current password</Label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#2DD4BF]/25"
                  style={{
                    backgroundColor: currentTheme.codeBg,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-sm font-medium">New password</Label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#2DD4BF]/25"
                  style={{
                    backgroundColor: currentTheme.codeBg,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm new password</Label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-[#2DD4BF]/25"
                  style={{
                    backgroundColor: currentTheme.codeBg,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                />
              </div>

              {passwordStatus && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{
                    border: `0.5px solid ${passwordStatus.type === 'success' ? `${currentTheme.accent}66` : '#ef444466'}`,
                    backgroundColor: passwordStatus.type === 'success' ? `${currentTheme.accent}12` : '#ef444412',
                    color: passwordStatus.type === 'success' ? currentTheme.accent : '#ef4444',
                  }}
                >
                  {passwordStatus.message}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ opacity: 0.6 }}>
                  Use at least 6 characters.
                </p>
                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  style={{ backgroundColor: currentTheme.accent, color: '#0E0E0D' }}
                >
                  {isUpdatingPassword ? (
                    <><Loader2 size={14} className="animate-spin mr-1" /> Updating…</>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </section>

        {/* ════════════════ Audio Settings ════════════════ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 size={18} style={{ color: currentTheme.accent }} />
            <h2 className="text-lg font-semibold">Audio & Voice</h2>
          </div>
          
          <div 
            className="rounded-xl p-5 space-y-5"
            style={{ backgroundColor: currentTheme.card, border: `0.5px solid ${currentTheme.border}` }}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Sound Effects</Label>
                <p className="text-sm" style={{ opacity: 0.6 }}>
                  Play sounds for interactions and feedback
                </p>
              </div>
              <Switch
                checked={soundEffects}
                onCheckedChange={setSoundEffects}
              />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="pt-4">
          <Button 
            className="px-8 py-2 rounded-lg font-medium transition-all cursor-pointer"
            style={{ 
              backgroundColor: currentTheme.accent,
              color: '#0E0E0D'
            }}
            onClick={() => {
              applyThemeMode(themeMode)
              localStorage.setItem('theme', themeMode)
            }}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
