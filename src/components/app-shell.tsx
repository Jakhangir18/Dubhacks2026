"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, House, Play, Sparkles, TrendingUp } from "lucide-react"
import { motion } from "motion/react"
import { Logo } from "@/components/logo"
import { ContactDialog } from "@/components/contact-dialog"
import { KitSheet } from "@/components/kit-sheet"
import { NotificationsSheet } from "@/components/notifications-sheet"
import { ProfileSheet } from "@/components/profile-sheet"
import { Button } from "@/components/ui/button"
import { PATIENT } from "@/lib/levels"
import { useStride } from "@/lib/store"
import { cn } from "cn"

const NAV = [
  { href: "/", label: "Overview", icon: House },
  { href: "/play", label: "Walk home", icon: Play },
  { href: "/progress", label: "My progress", icon: TrendingUp },
  { href: "/therapist", label: "Maya", icon: Sparkles },
]

const noopSubscribe = () => () => {}

export function PageActions() {
  const { setContactOpen, setNotesOpen, derived } = useStride()
  // False during server render and hydration, true after: keeps the badge out of the SSR markup.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const unread = ready ? derived.unreadCount : 0
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setNotesOpen(true)}
        className="relative grid size-10 place-items-center rounded-full border-[2.5px] border-[#2c4639] bg-[#0d171c] text-foreground transition hover:-translate-y-0.5 hover:border-[#9cff5a]"
        aria-label={unread ? `Updates, ${unread} unread` : "Updates"}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <>
            <span className="absolute right-2 top-2 size-2.5 animate-ping rounded-full bg-orange" />
            <span className="absolute right-2 top-2 size-2.5 rounded-full bg-orange ring-2 ring-[#0d171c]" />
          </>
        ) : null}
      </button>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full border-[2.5px] border-[#ff3d8b] bg-[#2a1220] px-4 text-sm font-semibold text-foreground shadow-[3px_3px_0_#9c2457] hover:bg-[#3a1830] dark:bg-[#2a1220] dark:hover:bg-[#3a1830]"
        onClick={() => setContactOpen(true)}
      >
        <span className="hidden sm:inline">Contact care team</span>
        <span className="sm:hidden">Care team</span>
      </Button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const immersive = pathname.startsWith("/play/session") || pathname.startsWith("/lab")

  if (immersive) {
    return (
      <>
        {children}
        <ContactDialog />
      </>
    )
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <NightSky />
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6">
        <TopBar />
        <main className="pb-28 pt-2 lg:pb-12">{children}</main>
      </div>
      <MobileNav />
      <ContactDialog />
      <KitSheet />
      <ProfileSheet />
      <NotificationsSheet />
    </div>
  )
}

/** Fixed starry backdrop with soft violet and teal glows. */
function NightSky() {
  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(164,107,255,0.16),transparent_45%),radial-gradient(ellipse_at_0%_100%,rgba(45,226,196,0.10),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.55)_1px,transparent_1.5px)] [background-size:120px_120px] opacity-40 [animation:twinkle_5s_ease-in-out_infinite] motion-reduce:animate-none" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,215,106,0.6)_1px,transparent_1.5px)] [background-position:60px_40px] [background-size:180px_180px] opacity-30 [animation:twinkle_7s_ease-in-out_infinite_1s] motion-reduce:animate-none" />
    </div>
  )
}

function TopBar() {
  const pathname = usePathname()
  const { state, derived, setKitOpen, setProfileOpen } = useStride()
  const kitReady = state.sensors.camera && state.sensors.trackpad
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <Link href="/" aria-label="Zombie Walk Home, overview">
        <Logo />
      </Link>
      <nav className="hidden gap-1 rounded-full border-[2.5px] border-[#2c4639] bg-[#0d171c] p-1 lg:flex" aria-label="Workspace">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            >
              {active ? (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-full bg-[#9cff5a]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon className={cn("relative size-4", active ? "text-[#070b10]" : "text-white/60")} />
              <span className={cn("relative", active ? "text-[#070b10]" : "text-white/75 hover:text-white")}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setKitOpen(true)}
          className="hidden items-center gap-2 rounded-full border-[2.5px] border-[#2c4639] bg-[#0d171c] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-[#2de2c4] xl:flex"
        >
          <span className="relative flex size-2">
            <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", kitReady ? "bg-[#9cff5a]" : "bg-orange")} />
            <span className={cn("relative inline-flex size-2 rounded-full", kitReady ? "bg-[#9cff5a]" : "bg-orange")} />
          </span>
          {kitReady ? "Kit ready" : "Check kit"}
        </button>
        <div className="hidden sm:block">
          <PageActions />
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="grid size-10 place-items-center rounded-full border-[2.5px] border-[#ffb21e] bg-[#2a1f0e] text-xs font-bold text-[#ffd76a] transition hover:-rotate-6"
          aria-label={`${PATIENT.name}, level ${derived.playerLevel}`}
        >
          {PATIENT.initials}
        </button>
      </div>
    </header>
  )
}

function MobileNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-30 rounded-[22px] border-[2.5px] border-[#2c4639] bg-[#0d171c]/95 px-2 py-2 shadow-[0_6px_0_#050809] backdrop-blur lg:hidden"
      aria-label="Workspace"
    >
      <ul className="grid grid-cols-4">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium text-muted-foreground",
                  active && "bg-[#9cff5a] text-[#070b10]",
                )}
              >
                <Icon className="size-4" />
                {item.label === "Walk home" ? "Practice" : item.label === "AI therapist" ? "Therapist" : item.label === "My progress" ? "Progress" : item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
