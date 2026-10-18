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
import { sticker } from "@/lib/sticker"
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
          <SheetTitle className="font-display text-2xl font-normal tracking-wide text-[#ffd76a]">{PATIENT.name}</SheetTitle>
          <SheetDescription className="text-white/70">
            Level {derived.playerLevel} · {state.xp.toLocaleString("en-US")} XP
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 px-4 pb-6">
          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-white/65">
              <span>Toward level {derived.playerLevel + 1}</span>
              <span>{Math.max(derived.levelCeil - state.xp, 0).toLocaleString("en-US")} XP to go</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full border-2 border-[#0b1a14] bg-[#14242a]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#4f8f22,#9cff5a)]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className={sticker("lime", "rounded-2xl p-4 shadow-[4px_4px_0_#4f8f22]")}>
            <p className="text-[11px] font-bold tracking-[0.16em] text-[#9cff5a]">RECOVERY GOAL</p>
            <p className="mt-1.5 text-sm leading-6 text-white/90">{PATIENT.goal}</p>
            <p className="mt-3 text-xs text-white/60">
              With {PATIENT.clinician} · Member since {PATIENT.memberSince}
            </p>
          </div>
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4] uppercase">Notes to the care team</h3>
            {state.careRequests.length === 0 ? (
              <p className="mt-1.5 text-sm leading-6 text-white/65">
                Nothing sent yet. Use Contact care team when a person should see the question.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2">
                {state.careRequests.map((request) => (
                  <li key={request.id} className="rounded-2xl border-[2.5px] border-[#2c4639] bg-[#070b10]/70 p-3">
                    <p className="text-sm font-semibold text-white">{request.topic}</p>
                    <p className="mt-1 text-sm leading-6 text-white/70">{request.message}</p>
                    <p className="mt-1 text-xs text-white/55">
                      {formatWhen(request.at, derived.now)} · {request.contact}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {confirming ? (
            <div className="rounded-2xl border-[2.5px] border-[#ff3d8b]/60 bg-[#2a1220] p-4">
              <p className="text-sm leading-6 text-white/90">
                This restores Jordan&apos;s clinic history and clears notes, chats, and walks from this browser.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  className="h-9 rounded-full border-2 border-[#0b1a14] bg-[#ff3d8b] px-3 font-semibold text-[#0b1a14] hover:bg-[#ff6aa6] dark:bg-[#ff3d8b] dark:hover:bg-[#ff6aa6]"
                  onClick={() => {
                    resetDemo()
                    setConfirming(false)
                    setProfileOpen(false)
                  }}
                >
                  Reset data
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-[#2c4639] bg-transparent px-3 text-white hover:bg-white/10 dark:bg-transparent"
                  onClick={() => setConfirming(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="justify-self-start text-sm font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline"
            >
              Reset practice data
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
