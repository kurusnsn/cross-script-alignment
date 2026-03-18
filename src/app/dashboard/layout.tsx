"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useHistory } from "@/hooks/useHistory"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/useAuthStore"
import { useSession } from "next-auth/react"
import * as React from "react"

function DashboardContent({ children }: { children: React.ReactNode }) {
  useHistory()
  const router = useRouter()
  const { status } = useSession()
  const isLoading = status === "loading"
  const isAuthenticated = status === "authenticated"
  const { clearAuth } = useAuthStore()

  // Redirect to login if not authenticated (after loading is complete)
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      clearAuth()
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router, clearAuth])

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0F0F0D] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2DD4BF]"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset className="flex flex-col bg-[#2A2A28]">
        <div className="md:hidden fixed top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-50">
          <SidebarTrigger className="h-10 w-10 rounded-md bg-[#1A1A19] text-[#FAF9F5] border border-[#2D2D2B] shadow-md" />
        </div>
        <main className="flex-1 min-w-0 overflow-x-hidden bg-[#2A2A28]">
          {children}
        </main>
      </SidebarInset>
    </>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  )
}
