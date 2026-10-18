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
          <SheetTitle className="font-display text-2xl font-normal tracking-wide text-[#ffd76a]">Updates</SheetTitle>
          <SheetDescription className="text-white/70">What changed for {state.prescribedLevelId ? "today's plan" : "your plan"}.</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2 px-4 pb-6">
          {derived.notifications.map((note) => {
            const unread = !state.readNotificationIds.includes(note.id)
            return (
              <li key={note.id}>
                <button
                  type="button"
                  className="w-full rounded-2xl border-[2.5px] border-[#2c4639] bg-[#070b10]/70 p-4 text-left shadow-[4px_4px_0_#050809] outline-none hover:border-[#9cff5a]/70 hover:bg-[#12261a] focus-visible:border-[#9cff5a]"
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
                    {unread ? <span className="size-2.5 rounded-full bg-[#ff3d8b] shadow-[0_0_8px_#ff3d8b]" aria-hidden="true" /> : null}
                    <span className="text-sm font-semibold text-white">{note.title}</span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-white/65">{note.body}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
