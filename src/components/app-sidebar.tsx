"use client"

import * as React from "react"
import {
  Languages,
  Brain,
  BarChart3,
  History,
  BookOpen,
  Search,
  Folder,
  Plus,
  MoreVertical,
  ChevronRight,
  Sparkles,
  Trash2,
  Clock,
} from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useHistoryStore } from "@/store/useHistoryStore"
import { useHistory } from "@/hooks/useHistory"
import { HistorySearchModal } from "@/components/HistorySearchModal"
import { useAuthStore } from "@/store/useAuthStore"
import { Logo } from "@/components/Logo"


// Translit app data
const data = {
  // Static user data used as fallback
  user: {
    name: "User",
    email: "user@align.app",
    avatar: "https://github.com/shadcn.png",
  },
  navMain: [
    {
      title: "Transliteration",
      url: "/dashboard/aligneration",
      icon: Languages,
    },
    {
      title: "Quiz",
      url: "/dashboard/quiz",
      icon: Brain,
    },
    {
      title: "My Words",
      url: "/dashboard/words",
      icon: BookOpen,
    },
    {
      title: "Progress",
      url: "/dashboard/progress",
      icon: BarChart3,
    },
  ],
}

const DEFAULT_HISTORY_FILTER_KEY = JSON.stringify({ limit: 50 }, ["limit"])

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()
  const queryClient = useQueryClient()
  const user = useAuthStore(state => state.user)
  const token = useAuthStore(state => state.token)
  const sidebarUserId = user?.id
  const [searchModalOpen, setSearchModalOpen] = React.useState(false)
  
  // From History Store (Zustand)
  const {
    selectedHistoryId,
    selectHistoryItem,
    selectedFolderId,
    setSelectedFolderId
  } = useHistoryStore()

  // From History Hook (TanStack Query)
  const { 
    translations: history, 
    folders, 
    createFolder, 
    deleteFolder,
    moveTranslation
  } = useHistory()

  // Prefetch history on hover so page loads instantly on click
  const prefetchHistory = React.useCallback(() => {
    if (!sidebarUserId) return
    const numericUserId = Number(sidebarUserId)
    queryClient.prefetchQuery({
      queryKey: ['history', numericUserId, DEFAULT_HISTORY_FILTER_KEY],
      queryFn: async () => {
        const response = await fetch(`/api/translations/history?userId=${numericUserId}&limit=50`)
        if (!response.ok) {
          throw new Error("Failed to prefetch history")
        }
        return response.json()
      },
      staleTime: 60_000,
    })
    queryClient.prefetchQuery({
      queryKey: ['folders', numericUserId],
      queryFn: async () => {
        const response = await fetch(`/api/history/folders?userId=${numericUserId}`)
        if (!response.ok) {
          throw new Error("Failed to prefetch folders")
        }
        return response.json()
      },
      staleTime: 120_000,
    })
    router.prefetch('/dashboard/history')
  }, [queryClient, router, sidebarUserId])

  const prefetchWords = React.useCallback(() => {
    if (!sidebarUserId) return
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    queryClient.prefetchQuery({
      queryKey: ['words', String(sidebarUserId)],
      queryFn: async () => {
        const response = await fetch('/api/words', { headers })
        if (!response.ok) {
          throw new Error("Failed to prefetch words")
        }
        return response.json()
      },
      staleTime: 60_000,
    })
    router.prefetch('/dashboard/words')
  }, [queryClient, router, token, sidebarUserId])

  const prefetchProgress = React.useCallback(() => {
    if (!sidebarUserId) return
    const userId = String(sidebarUserId)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    queryClient.prefetchQuery({
      queryKey: ['progress', 'stats', userId, undefined],
      queryFn: async () => {
        const response = await fetch('/api/progress/stats', { headers })
        if (!response.ok) {
          throw new Error("Failed to prefetch progress stats")
        }
        return response.json()
      },
      staleTime: 120_000,
    })

    queryClient.prefetchQuery({
      queryKey: ['progress', 'achievements', userId],
      queryFn: async () => {
        const response = await fetch('/api/progress/achievements', { headers })
        if (!response.ok) {
          throw new Error("Failed to prefetch achievements")
        }
        const payload = await response.json()
        return payload.achievements ?? []
      },
      staleTime: 300_000,
    })

    router.prefetch('/dashboard/progress')
  }, [queryClient, router, token, sidebarUserId])

  const prefetchRouteData = React.useCallback((url: string) => {
    if (url === '/dashboard/words') {
      prefetchWords()
      return
    }
    if (url === '/dashboard/progress') {
      prefetchProgress()
      return
    }
    if (url === '/dashboard/aligneration' || url === '/dashboard/quiz') {
      prefetchHistory()
    }
  }, [prefetchHistory, prefetchProgress, prefetchWords])

  const [isAddingFolder, setIsAddingFolder] = React.useState(false)
  const [newFolderName, setNewFolderName] = React.useState("")
  const [draggedItem, setDraggedItem] = React.useState<string | null>(null)
  const newFolderInputRowRef = React.useRef<HTMLDivElement>(null)

  // Construct user object for NavUser
  const sidebarUser = {
    name: user?.name || data.user.name,
    email: user?.email || data.user.email,
    avatar: user?.avatarUrl || data.user.avatar,
  }
  const normalizedUserName = (user?.name || "").trim().toLowerCase()
  const emailLocalPart = (user?.email || "").split("@")[0]?.trim().toLowerCase() || ""
  const forceProBadgeForKurusnsn =
    normalizedUserName === "kurusnsn" || emailLocalPart === "kurusnsn"
  const effectiveSubscriptionStatus: "trial" | "pro" | "expired" = forceProBadgeForKurusnsn
    ? "pro"
    : (user?.subscriptionStatus || "trial")

  React.useEffect(() => {
    if (!isAddingFolder) {
      setNewFolderName("")
    }
  }, [isAddingFolder])

  React.useEffect(() => {
    if (!sidebarUserId) return
    const timer = window.setTimeout(() => {
      prefetchHistory()
      prefetchWords()
      prefetchProgress()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [prefetchHistory, prefetchProgress, prefetchWords, sidebarUserId])

  React.useEffect(() => {
    if (!isAddingFolder) return

    const frame = requestAnimationFrame(() => {
      newFolderInputRowRef.current?.scrollIntoView({ block: "nearest" })
    })

    return () => cancelAnimationFrame(frame)
  }, [isAddingFolder])

  // Keyboard shortcut for search
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchModalOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim())
      setIsAddingFolder(false)
    }
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItem(itemId)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", itemId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, folderId: number) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData("text/plain")
    if (itemId) {
      moveTranslation({ translationId: Number(itemId), folderId })
    }
    setDraggedItem(null)
  }

  const closeMobileSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }, [isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-2 sm:py-2">
          {state === "collapsed" ? (
            <div className="flex items-center justify-center w-full">
              <SidebarTrigger />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Logo size={isMobile ? 28 : 32} />
                <span className="font-semibold text-base sm:text-lg">TranslitAI</span>
              </div>
              <SidebarTrigger />
            </>

          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Search Bar */}
        {state !== "collapsed" && (
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => setSearchModalOpen(true)}
              className="w-full min-w-0 flex items-center justify-between gap-2 px-3 h-11 sm:h-10 text-xs text-[#9CA3AF] hover:bg-[#2A2A28] border border-[#2A2A28] rounded-xl transition-all duration-200 group shadow-sm bg-[#1A1A18]"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Search className="h-3.5 w-3.5 group-hover:text-[#2DD4BF] transition-colors" />
                <span className="truncate font-medium">Search history...</span>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 px-1.5 py-0.5 rounded border border-[#3A3A38] bg-[#2A2A28] text-[9px] font-mono group-hover:border-[#2DD4BF]/30 group-hover:text-[#2DD4BF] transition-all sm:flex">
                <span>⌘</span>
                <span>K</span>
              </div>
            </button>
          </div>
        )}

        {/* Navigation Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider px-2">Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link
                      href={item.url}
                      onClick={closeMobileSidebar}
                      onMouseEnter={() => prefetchRouteData(item.url)}
                      onFocus={() => prefetchRouteData(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Folders Group */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">Folders</SidebarGroupLabel>
          <SidebarGroupAction
            onClick={() => setIsAddingFolder(true)}
            title="Add Folder"
            className="hover:text-[#2DD4BF]"
          >
            <Plus className="h-4 w-4" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAddingFolder && (
                <SidebarMenuItem className="list-none px-2 pt-1 pb-2">
                  <div ref={newFolderInputRowRef} className="min-h-8">
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder()
                        if (e.key === "Escape") setIsAddingFolder(false)
                      }}
                      placeholder="Folder name..."
                      className="h-8 text-sm leading-tight bg-sidebar-accent border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#2DD4BF]/50"
                      onBlur={() => {
                        // Slight delay to allow Enter key or other actions to process
                        setTimeout(() => setIsAddingFolder(false), 150)
                      }}
                      autoFocus
                    />
                  </div>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={selectedFolderId === undefined}
                  onClick={() => {
                    setSelectedFolderId(undefined)
                    router.push('/dashboard/history')
                    closeMobileSidebar()
                  }}
                  onMouseEnter={prefetchHistory}
                  tooltip="All History"
                >
                  <History className={cn("h-4 w-4", selectedFolderId === undefined && "text-[#2DD4BF]")} />
                  <span>All History</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {folders.map(folder => (
                <SidebarMenuItem 
                  key={folder.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, folder.id)}
                  className={cn(
                    "transition-colors duration-200",
                    draggedItem && "bg-[#2DD4BF]/5 rounded-md"
                  )}
                >
                  <SidebarMenuButton 
                    isActive={selectedFolderId === folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id)
                      router.push('/dashboard/history')
                      closeMobileSidebar()
                    }}
                    onMouseEnter={prefetchHistory}
                    className="pr-8 min-w-0"
                  >
                    <Folder className={cn("h-4 w-4", selectedFolderId === folder.id && "text-[#2DD4BF]")} />
                    <span className="truncate">{folder.name}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete folder "${folder.name}"?`)) {
                        deleteFolder(folder.id)
                      }
                    }}
                    showOnHover
                    className="hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />
      </SidebarContent>

      <SidebarFooter>
        <NavUser 
          user={sidebarUser} 
          subscriptionStatus={effectiveSubscriptionStatus}
        />
      </SidebarFooter>
      <SidebarRail />

      <HistorySearchModal 
        open={searchModalOpen} 
        onOpenChange={setSearchModalOpen} 
      />
    </Sidebar>
  )
}
