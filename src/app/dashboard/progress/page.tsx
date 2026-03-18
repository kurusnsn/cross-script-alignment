"use client"

import { useState, useMemo, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Logo } from "@/components/Logo"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, Award, Target, Clock, Brain, Flame, Languages } from "lucide-react"

import { useAuthStore } from "@/store/useAuthStore"
import { useProgress } from "@/hooks/useProgress"
import { useWords } from "@/hooks/useWords"
import { useTheme } from "@/hooks/useTheme"

const TEAL = "#2DD4BF" // Matches the Logo SVG teal
const TEAL_DIM = "rgba(45, 212, 191, 0.15)"

type TabKey = "analytics" | "achievements" | "goals"

const LANGUAGE_LABELS: Record<string, string> = {
  fa: "🇮🇷 Persian (فارسی)",
  ar: "🇸🇦 Arabic (العربية)",
  ur: "🇵🇰 Urdu (اردو)",
  hi: "🇮🇳 Hindi (हिन्दी)",
  ru: "🇷🇺 Russian (Русский)",
  ja: "🇯🇵 Japanese (日本語)",
  ko: "🇰🇷 Korean (한국어)",
  zh: "🇨🇳 Chinese (中文)",
  th: "🇹🇭 Thai (ไทย)",
  he: "🇮🇱 Hebrew (עברית)",
  bn: "🇧🇩 Bengali (বাংলা)",
  es: "🇪🇸 Spanish (Español)",
  fr: "🇫🇷 French (Français)",
  en: "🇺🇸 English",
}

export default function ProgressPage() {
  const { user, token, isAuthenticated } = useAuthStore()
  const userId = user?.id?.toString() || ""
  const wordsUserId = userId
  const isDarkMode = useTheme()
  const pageBg = isDarkMode ? '#2A2A28' : '#F9F9F8'
  const cardBg = isDarkMode ? '#1A1A19' : '#FFFFFF'
  const skeletonBg = isDarkMode ? '#1A1A19' : '#E8E8E6'

  const [selectedLanguage, setSelectedLanguage] = useState<string>("all")
  const { words } = useWords(wordsUserId, token)

  const availableLanguages = useMemo(() => (
    Array.from(new Set(words.map(w => w.language_code).filter(Boolean)))
  ), [words])

  useEffect(() => {
    if (selectedLanguage !== "all" && !availableLanguages.includes(selectedLanguage)) {
      setSelectedLanguage("all")
    }
  }, [availableLanguages, selectedLanguage])

  const languageOptions = useMemo(() => {
    const sorted = [...availableLanguages].sort()
    return [
      { label: "All Languages", value: "all" },
      ...sorted.map((code) => ({
        value: code,
        label: LANGUAGE_LABELS[code] ?? code.toUpperCase()
      }))
    ]
  }, [availableLanguages])

  const { stats, achievements, isLoadingStats, isLoadingAchievements } = useProgress(
    user?.id?.toString(),
    token,
    selectedLanguage === "all" ? undefined : selectedLanguage
  )
  const [activeTab, setActiveTab] = useState<TabKey>("analytics")

  // Skeleton — keeps layout stable, no black flash
  if (isLoadingStats || !stats) {
    return (
      <div className="min-h-screen w-full" style={{ backgroundColor: pageBg }}>
        <div className="space-y-8 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
          {/* Header skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full animate-pulse" style={{ backgroundColor: skeletonBg }} />
            <div className="space-y-2">
              <div className="w-32 h-6 rounded animate-pulse" style={{ backgroundColor: skeletonBg }} />
              <div className="w-56 h-3 rounded animate-pulse" style={{ backgroundColor: skeletonBg }} />
            </div>
          </div>
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5 h-24 animate-pulse" style={{ backgroundColor: cardBg }} />
            ))}
          </div>
          {/* Chart cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl p-6 h-64 animate-pulse" style={{ backgroundColor: cardBg }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && process.env.NODE_ENV !== "development") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ backgroundColor: pageBg }}>
        <div className="flex flex-col items-center justify-center space-y-4 px-6 text-center">
          <h2 className="text-xl font-semibold text-[#FAF9F5]">Please sign in</h2>
          <p className="text-[#9CA3AF]">You need to be logged in to view your progress.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#2A2A28]">
      <div className="space-y-8 p-6 md:p-8 max-w-[1400px] mx-auto w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#FAF9F5]">Progress</h1>
            <p className="text-[#9CA3AF] text-sm">
              Track your learning journey and achievements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger
              className="w-[210px] border border-[#2D2D2B] bg-gradient-to-b from-[#1A1A18] to-[#0F0F0D] text-[#FAF9F5] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#2DD4BF]/40 focus:ring-2 focus:ring-[#2DD4BF]/30 focus:ring-offset-0 data-[state=open]:border-[#2DD4BF]/60"
            >
              <SelectValue placeholder="All Languages" />
            </SelectTrigger>
            <SelectContent className="bg-[#0F0F0D] border-[#2D2D2B] text-[#FAF9F5] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              {languageOptions.map(option => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="focus:bg-[#1A1A19] focus:text-[#FAF9F5] data-[state=checked]:bg-[#0F1F1C] data-[state=checked]:text-[#2DD4BF]"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedLanguage !== "all" && (
            <Badge className="bg-[#2DD4BF]/10 text-[#2DD4BF] border-none text-[10px] px-2 py-0">
              <Languages className="h-3 w-3 mr-1" />
              Filtered
            </Badge>
          )}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Target size={18} />}
          label="Total Words"
          value={stats.totalWords.toLocaleString()}
          sub="+234 this week"
          accent
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Accuracy"
          value={`${stats.averageAccuracy}%`}
          sub="+3% from last month"
          accent
        />
        <StatCard
          icon={<Flame size={18} />}
          label="Current Streak"
          value={`${stats.currentStreak} days`}
          sub="Keep it up!"
          accent
        />
        <StatCard
          icon={<Brain size={18} />}
          label="Languages in Progress"
          value={String(stats.totalLanguages)}
          sub="2 new this month"
          accent
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["analytics", "achievements", "goals"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[10px] uppercase tracking-widest px-4 py-2 rounded-full border transition-all cursor-pointer select-none ${
              activeTab === tab
                ? "bg-[#2DD4BF] border-[#2DD4BF] text-[#FAF9F5] font-bold"
                : "bg-[#2A2A28] border-[#2D2D2B] text-[#9CA3AF] hover:border-[#2DD4BF] hover:text-[#2DD4BF]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Weekly Activity */}
            <div className="bg-[#1A1A19] rounded-xl border border-[#2D2D2B] p-6 min-w-0 overflow-hidden">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#FAF9F5]">Weekly Activity</h3>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Practice sessions over the past week</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2B" />
                  <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D2D2B' }} />
                  <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D2D2B' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#262624', border: '1px solid #404040', borderRadius: 8, color: '#FAF9F5', fontSize: 12 }} cursor={{ fill: 'rgba(45, 212, 191, 0.08)' }} />
                  <Bar dataKey="alignerations" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Accuracy Trend */}
            <div className="bg-[#1A1A19] rounded-xl border border-[#2D2D2B] p-6 min-w-0 overflow-hidden">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#FAF9F5]">Accuracy Trend</h3>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Improvement over time</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D2B" />
                  <XAxis dataKey="month" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D2D2B' }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={{ stroke: '#2D2D2B' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#262624', border: '1px solid #404040', borderRadius: 8, color: '#FAF9F5', fontSize: 12 }} />
                  <Line type="monotone" dataKey="accuracy" stroke={TEAL} strokeWidth={2} dot={{ fill: TEAL, r: 3 }} activeDot={{ r: 5, fill: '#FAF9F5', stroke: TEAL }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Language Distribution */}
            <div className="bg-[#1A1A19] rounded-xl border border-[#2D2D2B] p-6 min-w-0">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#FAF9F5]">Language Practice</h3>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Distribution by language</p>
              </div>
              {stats.languageDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={stats.languageDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={110}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="transparent"
                        strokeWidth={2}
                      >
                        {stats.languageDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#262624', border: '1px solid #404040', borderRadius: 8, color: '#FAF9F5', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {stats.languageDistribution.map((lang) => (
                      <div key={lang.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lang.color }} />
                        <span className="text-xs text-[#FAF9F5]">{lang.name}</span>
                        <span className="text-xs text-[#9CA3AF] ml-auto">{lang.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-center text-[#9CA3AF] py-12 text-sm">No language data yet</p>
              )}
            </div>

            {/* Recent Milestones */}
            <div className="bg-[#1A1A19] rounded-xl border border-[#2D2D2B] p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[#FAF9F5]">Recent Milestones</h3>
                <p className="text-[10px] text-[#9CA3AF] mt-0.5">Achievements and progress</p>
              </div>
              <div className="space-y-3">
                {isLoadingAchievements && (
                  <div className="space-y-2">
                    <div className={`h-16 rounded-lg animate-pulse ${isDarkMode ? "bg-[#2A2A28]/60" : "bg-[#E2E8F0]"}`} />
                    <div className={`h-16 rounded-lg animate-pulse ${isDarkMode ? "bg-[#2A2A28]/60" : "bg-[#E2E8F0]"}`} />
                  </div>
                )}

                {!isLoadingAchievements && achievements.filter(a => a.earned).slice(0, 3).map((achievement, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      isDarkMode ? "bg-[#2A2A28]/60 border-[#2D2D2B]" : "bg-[#F5F8FA] border-[#E2E8F0]"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: TEAL_DIM }}>
                      <Award size={14} className="text-[#2DD4BF]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold ${isDarkMode ? "text-[#FAF9F5]" : "text-[#0F172A]"}`}>{achievement.title}</p>
                      <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-[#9CA3AF]" : "text-[#64748B]"}`}>{achievement.description}</p>
                      {achievement.date && (
                        <Badge className="mt-1.5 bg-[#2DD4BF]/10 text-[#2DD4BF] border-none text-[9px] px-2 py-0 hover:bg-[#2DD4BF]/20">
                          {achievement.date}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                {stats.currentStreak > 0 && (
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      isDarkMode ? "bg-[#2A2A28]/60 border-[#2D2D2B]" : "bg-[#F5F8FA] border-[#E2E8F0]"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: TEAL_DIM }}>
                      <Clock size={14} className="text-[#2DD4BF]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold ${isDarkMode ? "text-[#FAF9F5]" : "text-[#0F172A]"}`}>Study Streak</p>
                      <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-[#9CA3AF]" : "text-[#64748B]"}`}>
                        Current {stats.currentStreak}-day learning streak
                      </p>
                      <Badge className="mt-1.5 bg-[#2DD4BF]/10 text-[#2DD4BF] border-none text-[9px] px-2 py-0 hover:bg-[#2DD4BF]/20">
                        Ongoing
                      </Badge>
                    </div>
                  </div>
                )}

                {!isLoadingAchievements && achievements.filter(a => a.earned).length === 0 && stats.currentStreak === 0 && (
                  <p className={`text-center py-8 text-sm ${isDarkMode ? "text-[#9CA3AF]" : "text-[#64748B]"}`}>No milestones yet. Keep practicing!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Achievements Tab */}
      {activeTab === "achievements" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoadingAchievements && Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`achievement-skeleton-${index}`}
              className="rounded-xl border p-5 bg-[#1A1A19] border-[#2D2D2B]"
            >
              <div className="h-5 w-2/3 rounded bg-[#2A2A28] animate-pulse mb-3" />
              <div className="h-3 w-full rounded bg-[#2A2A28] animate-pulse mb-2" />
              <div className="h-3 w-5/6 rounded bg-[#2A2A28] animate-pulse" />
            </div>
          ))}
          {!isLoadingAchievements && achievements.map((achievement, index) => (
            <div
              key={index}
              className={`rounded-xl border p-5 ${
                achievement.earned
                  ? "bg-[#1A1A19] border-[#2DD4BF]/30"
                  : "bg-[#1A1A19] border-[#2D2D2B]"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{achievement.icon}</span>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-[#FAF9F5] truncate">{achievement.title}</h4>
                  <p className="text-[10px] text-[#9CA3AF]">{achievement.description}</p>
                </div>
              </div>
              {achievement.earned ? (
                <Badge className="bg-[#2DD4BF]/10 text-[#2DD4BF] border-none text-[10px] hover:bg-[#2DD4BF]/20">
                  Earned {achievement.date}
                </Badge>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#9CA3AF]">Progress</span>
                    <span className="text-[#FAF9F5] font-mono">{achievement.progress}/{achievement.total}</span>
                  </div>
                  <div className="w-full bg-[#2A2A28] rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(achievement.progress! / achievement.total!) * 100}%`, backgroundColor: TEAL }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === "goals" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="bg-[#1A1A19] rounded-xl border border-[#2D2D2B] p-6">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-[#FAF9F5]">Current Goals</h3>
              <p className="text-[10px] text-[#9CA3AF] mt-0.5">Track your learning objectives</p>
            </div>
            <div className="space-y-5">
              <GoalBar label="Weekly Words Goal" current={stats.totalWords} target={500} color={TEAL} />
              <GoalBar label="Quiz Accuracy Goal" current={Math.round(stats.averageAccuracy)} target={90} suffix="%" color="#A78BFA" />
              <GoalBar label="Languages Goal" current={stats.totalLanguages} target={5} color="#F59E0B" />
            </div>
          </div>

          <div
            className={`rounded-xl border p-6 ${
              isDarkMode ? "bg-[#1A1A19] border-[#2D2D2B]" : "bg-[#FFFFFF] border-[#E2E8F0]"
            }`}
          >
            <div className="mb-5">
              <h3 className={`text-sm font-semibold ${isDarkMode ? "text-[#FAF9F5]" : "text-[#0F172A]"}`}>Monthly Targets</h3>
              <p className={`text-[10px] mt-0.5 ${isDarkMode ? "text-[#9CA3AF]" : "text-[#475569]"}`}>Progress towards monthly goals</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <MetricTile
                label="Words Translated"
                value={stats.totalWords.toLocaleString()}
                pct={Math.round((stats.totalWords / 2500) * 100)}
                isDarkMode={isDarkMode}
              />
              <MetricTile
                label="Quiz Questions"
                value={String(stats.totalQuestions)}
                pct={Math.round((stats.totalQuestions / 100) * 100)}
                isDarkMode={isDarkMode}
              />
              <MetricTile
                label="Languages"
                value={String(stats.totalLanguages)}
                pct={Math.round((stats.totalLanguages / 5) * 100)}
                isDarkMode={isDarkMode}
              />
              <MetricTile
                label="Day Streak"
                value={String(stats.currentStreak)}
                pct={Math.round((stats.currentStreak / 30) * 100)}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────── */

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-[#1A1A19] rounded-xl border border-[#2D2D2B] p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#2DD4BF]/[0.03] to-transparent pointer-events-none" />
      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-widest text-[#9CA3AF] font-medium">{label}</span>
          <span className={`shrink-0 ${accent ? "text-[#2DD4BF]" : "text-[#9CA3AF]"}`}>{icon}</span>
        </div>
        <div className={`text-2xl font-bold ${accent ? "text-[#2DD4BF]" : "text-[#FAF9F5]"}`}>{value}</div>
        <p className="text-[10px] text-[#9CA3AF] mt-1">{sub}</p>
      </div>
    </div>
  )
}

function GoalBar({ label, current, target, suffix, color }: { label: string; current: number; target: number; suffix?: string; color: string }) {
  const pct = Math.min((current / target) * 100, 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-[#FAF9F5] font-medium">{label}</span>
        <span className="text-[10px] text-[#9CA3AF] font-mono">{current}{suffix}/{target}{suffix}</span>
      </div>
      <div className="w-full bg-[#2A2A28] rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function MetricTile({ label, value, pct, isDarkMode }: { label: string; value: string; pct: number; isDarkMode: boolean }) {
  return (
    <div
      className={`text-center p-4 rounded-lg border ${
        isDarkMode ? "bg-[#2A2A28]/60 border-[#2D2D2B]" : "bg-[#F8FAFC] border-[#E2E8F0]"
      }`}
    >
      <div className={`text-xl font-bold ${isDarkMode ? "text-[#FAF9F5]" : "text-[#0F172A]"}`}>{value}</div>
      <div className={`text-[10px] mt-1 ${isDarkMode ? "text-[#9CA3AF]" : "text-[#475569]"}`}>{label}</div>
      <Badge className="mt-2 bg-[#2DD4BF]/10 text-[#2DD4BF] border-none text-[9px] px-2 py-0 hover:bg-[#2DD4BF]/20">
        {Math.min(pct, 100)}% of goal
      </Badge>
    </div>
  )
}
