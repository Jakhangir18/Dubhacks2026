"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatWhen } from "@/lib/format"
import { PATIENT } from "@/lib/levels"
import { useStride } from "@/lib/store"

export function ProfileSheet() {
  const { profileOpen, setProfileOpen, state, derived, resetDemo } = useStride()
  const [confirming, setConfirming] = useState(false)
  const span = Math.max(derived.levelCeil - derived.levelFloor, 1)
  const progress = Math.min(100, Math.round(((state.xp - derived.levelFloor) / span) * 100))

  return (
    <Sheet
      open={profileOpen}
      onOpenChange={(open) => {
        setProfileOpen(open)
        if (!open) setConfirming(false)
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-8">
          <SheetTitle>{PATIENT.name}</SheetTitle>
          <SheetDescription>
            Level {derived.playerLevel} · {state.xp.toLocaleString("en-US")} XP
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>Toward level {derived.playerLevel + 1}</span>
              <span>{Math.max(derived.levelCeil - state.xp, 0).toLocaleString("en-US")} XP to go</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sage">
              <div className="h-full rounded-full bg-forest" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="rounded-2xl bg-mint p-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-forest">RECOVERY GOAL</p>
            <p className="mt-1.5 text-sm leading-6 text-ink">{PATIENT.goal}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              With {PATIENT.clinician} · Member since {PATIENT.memberSince}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Notes to the care team</h3>
            {state.careRequests.length === 0 ? (
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                Nothing sent yet. Use Contact care team when a person should see the question.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {state.careRequests.map((request) => (
                  <li key={request.id} className="rounded-2xl border border-border p-3">
                    <p className="text-sm font-semibold text-ink">{request.topic}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{request.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatWhen(request.at, derived.now)} · {request.contact}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {confirming ? (
            <div className="rounded-2xl border border-border p-4">
              <p className="text-sm leading-6 text-ink">
                This restores Jordan&apos;s clinic history and clears notes, chats, and walks from this browser.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 rounded-full px-3"
                  onClick={() => {
                    resetDemo()
                    setConfirming(false)
                    setProfileOpen(false)
                  }}
                >
                  Reset data
                </Button>
                <Button type="button" variant="outline" className="h-9 rounded-full px-3" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="justify-self-start text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
            >
              Reset practice data
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
