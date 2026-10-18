"use client"

import Link from "next/link"
import { Camera, Server, Smartphone, Sparkles } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useGame } from "@/lib/game-data"
import { useSideCamera } from "@/lib/live"
import { gameOrigin } from "@/lib/paths"
import { useStride } from "@/lib/store"
import { cn } from "cn"

const CARD = "rounded-2xl border-[2.5px] border-[#2c4639] bg-[#070b10]/70 p-4 shadow-[4px_4px_0_#050809]"
const ICON = "grid size-8 place-items-center rounded-full bg-[#12261a] text-[#9cff5a] ring-2 ring-[#9cff5a]/40"

/** What is connected right now: the game server, the phone, and the services behind Maya. */
export function KitSheet() {
  const { kitOpen, setKitOpen } = useStride()
  return (
    <Sheet open={kitOpen} onOpenChange={setKitOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-8">
          <SheetTitle className="font-display text-2xl font-normal tracking-wide text-[#ffd76a]">Connections</SheetTitle>
          <SheetDescription className="leading-6 text-white/70">
            The game server scores the walk from the camera over the pad. The phone at the side measures the legs. Maya reads both.
          </SheetDescription>
        </SheetHeader>
        {kitOpen ? <KitBody onClose={() => setKitOpen(false)} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function KitBody({ onClose }: { onClose: () => void }) {
  const { online, status, running, active } = useGame()
  const side = useSideCamera()
  const origin = gameOrigin()
  return (
    <div className="grid gap-3 px-4 pb-4">
      <Row
        icon={<Server className="size-4" />}
        name="Game server"
        state={online === null ? "Connecting" : online ? (running ? `${active?.player ?? "Someone"} is walking` : "Online") : "Not answering"}
        ok={Boolean(online)}
        body="Serves the game, relays the cameras, keeps the sessions and runs Maya's review."
      />
      <Row
        icon={<Smartphone className="size-4" />}
        name="Phone, side camera"
        state={side.live ? `Live${side.rate !== null ? ` · ${side.rate.toFixed(1)} pictures a second` : ""}` : side.polled ? "Not connected" : "Checking"}
        ok={side.live}
        body="On a stand at the side of the pad, knee height. Draws the legs, measures each knee and keeps the moments."
      />
      <Row
        icon={<Camera className="size-4" />}
        name="Top camera"
        state="Shown on the live walk"
        ok={Boolean(online)}
        body="Over the pad (feet.py): finds the shoes so the game knows which foot landed where."
      />
      <div className={CARD}>
        <div className="flex items-center gap-2 font-semibold text-white">
          <span className={ICON}>
            <Sparkles className="size-4" />
          </span>
          Behind Maya
        </div>
        {status ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[
              ["Gemini", status.gemini],
              ["Backboard memory", status.backboard],
              [`storage: ${status.storage}`, status.storage === "mongodb"],
              [`Visa: ${status.visa}`, status.visa !== "mock"],
              ["Perceptron", status.perceptron],
            ].map(([label, on]) => (
              <li key={String(label)} className={cn("rounded-full border-2 px-2.5 py-0.5 text-[11px] font-semibold", on ? "border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]" : "border-white/15 text-white/55")}>
                {label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-white/60">The server tells which services are live once it answers.</p>
        )}
      </div>
      <Link href="/play" onClick={onClose} className="font-display inline-flex h-11 items-center justify-center rounded-full border-[2.5px] border-[#0b1a14] bg-[#9cff5a] text-lg tracking-wide text-[#0b1a14] shadow-[0_4px_0_#3d7a19] hover:bg-[#b4ff82]">
        OPEN THE LIVE WALK
      </Link>
      {origin ? (
        <p className="text-center text-xs text-white/55">
          The game itself runs at{" "}
          <a href={`${origin}/`} target="_blank" rel="noreferrer" className="font-semibold text-[#2de2c4] hover:underline">
            {origin.replace(/^https?:\/\//, "")}
          </a>
          {" · "}
          <a href={`${origin}/camera.html`} target="_blank" rel="noreferrer" className="font-semibold text-[#2de2c4] hover:underline">
            calibrate the shoes
          </a>
        </p>
      ) : null}
    </div>
  )
}

function Row({ icon, name, state, ok, body }: { icon: React.ReactNode; name: string; state: string; ok: boolean; body: string }) {
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-white">
          <span className={ICON}>{icon}</span>
          {name}
        </div>
        <span className={cn("text-right text-xs font-bold tracking-[0.12em] uppercase", ok ? "text-[#9cff5a]" : "text-[#ffb21e]")}>{state}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-white/65">{body}</p>
    </div>
  )
}
