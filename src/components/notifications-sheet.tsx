"use client"

import { useRouter } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useStride } from "@/lib/store"

export function NotificationsSheet() {
  const router = useRouter()
  const { notesOpen, setNotesOpen, setKitOpen, derived, state } = useStride()

  return (
    <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
      <SheetContent side="right" className="w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-8">
          <SheetTitle>Updates</SheetTitle>
          <SheetDescription>What changed for {state.prescribedLevelId ? "today's plan" : "your plan"}.</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2 px-4 pb-6">
          {derived.notifications.map((note) => {
            const unread = !state.readNotificationIds.includes(note.id)
            return (
              <li key={note.id}>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-border bg-white p-4 text-left transition hover:border-forest/30"
                  onClick={() => {
                    setNotesOpen(false)
                    if (note.kind === "kit") {
                      setKitOpen(true)
                      return
                    }
                    router.push(note.href)
                  }}
                >
                  <span className="flex items-center gap-2">
                    {unread ? <span className="size-2 rounded-full bg-orange" aria-hidden="true" /> : null}
                    <span className="text-sm font-semibold text-ink">{note.title}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">{note.body}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
