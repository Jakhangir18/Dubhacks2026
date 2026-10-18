"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, House, Play, Sparkles, TrendingUp } from "lucide-react"
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
  { href: "/play", label: "Play & practice", icon: Play },
  { href: "/progress", label: "My progress", icon: TrendingUp },
  { href: "/therapist", label: "AI therapist", icon: Sparkles },
]

export function PageActions() {
  const { setContactOpen, setNotesOpen, derived } = useStride()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setNotesOpen(true)}
        className="relative grid size-10 place-items-center rounded-full border border-border bg-white text-ink shadow-sm transition hover:bg-white"
        aria-label={derived.unreadCount ? `Updates, ${derived.unreadCount} unread` : "Updates"}
      >
        <Bell className="size-4" />
        {derived.unreadCount > 0 ? (
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-orange ring-2 ring-white" />
        ) : null}
      </button>
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-full bg-white px-4 text-sm font-semibold shadow-sm"
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
  const immersive = pathname.startsWith("/play/session")

  if (immersive) {
    return (
      <>
        {children}
        <ContactDialog />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 px-4 py-3 lg:hidden">
            <Logo />
            <PageActions />
          </header>
          <main className="flex-1 px-4 pb-28 pt-2 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">{children}</main>
        </div>
      </div>
      <MobileNav />
      <ContactDialog />
      <KitSheet />
      <ProfileSheet />
      <NotificationsSheet />
    </div>
  )
}

function Sidebar() {
  const pathname = usePathname()
  const { state, derived, setKitOpen, setProfileOpen } = useStride()
  const kitReady = state.sensors.camera && state.sensors.trackpad
  const kitLabel = kitReady
    ? "All sensors connected"
    : !state.sensors.camera && !state.sensors.trackpad
      ? "Sensors need a check"
      : !state.sensors.camera
        ? "Camera needs a check"
        : "Trackpad needs a check"

  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col px-4 py-5 lg:flex">
      <Logo />
      <p className="mt-8 px-3 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">WORKSPACE</p>
      <nav className="mt-2 grid gap-1" aria-label="Workspace">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[#41564a] transition hover:bg-white",
                active && "bg-[#e5f3e8] text-forest",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto grid gap-3">
        <button
          type="button"
          onClick={() => setKitOpen(true)}
          className="rounded-2xl border border-border/80 bg-white p-3 text-left shadow-sm transition hover:border-forest/20"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className={cn("size-2 rounded-full", kitReady ? "bg-[#3c9d62]" : "bg-orange")} />
            Movement kit
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">{kitLabel}</span>
          <span className="mt-3 flex gap-1.5">
            <KitPill label="Camera" on={state.sensors.camera} />
            <KitPill label="Trackpad" on={state.sensors.trackpad} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-3 rounded-2xl px-1 py-1 text-left transition hover:bg-white"
        >
          <span className="grid size-9 place-items-center rounded-full bg-orange text-xs font-bold text-white">
            {PATIENT.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{PATIENT.name}</span>
            <span className="block text-xs text-muted-foreground">
              Level {derived.playerLevel} · {state.xp.toLocaleString("en-US")} XP
            </span>
          </span>
          <span className="px-1 text-lg tracking-widest text-muted-foreground" aria-hidden="true">
            ···
          </span>
        </button>
      </div>
    </aside>
  )
}

function KitPill({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        on ? "bg-[#f3f6f2] text-[#41564a]" : "bg-peach text-orange",
      )}
    >
      {label}
    </span>
  )
}

function MobileNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 px-2 py-2 backdrop-blur lg:hidden"
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
                  active && "text-forest",
                )}
              >
                <Icon className="size-4" />
                {item.label === "Play & practice" ? "Practice" : item.label === "AI therapist" ? "Therapist" : item.label === "My progress" ? "Progress" : item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
