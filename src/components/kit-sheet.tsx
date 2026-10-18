"use client"

import { useState, type ReactNode } from "react"
import { Camera, Projector, Touchpad } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useStride } from "@/lib/store"

export function KitSheet() {
  const { kitOpen, setKitOpen, state, setSensor, reconnectKit } = useStride()
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)

  function runCheck() {
    setChecking(true)
    setChecked(false)
    window.setTimeout(() => {
      reconnectKit()
      setChecking(false)
      setChecked(true)
    }, 1300)
  }

  return (
    <Sheet open={kitOpen} onOpenChange={setKitOpen}>
      <SheetContent side="right" className="w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-8">
          <SheetTitle>Movement kit</SheetTitle>
          <SheetDescription>
            The trackpad scores the walk. It times each step and feels the left-right shift. The camera keeps you in frame. The projection puts the lawn on the floor.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4 pb-4">
          <SensorRow
            icon={<Camera className="size-4" />}
            name="Camera"
            body="Mounted ahead of the walk. It keeps you in frame so the session can start."
            online={state.sensors.camera}
            onToggle={() => setSensor("camera", !state.sensors.camera)}
          />
          <SensorRow
            icon={<Touchpad className="size-4" />}
            name="Trackpad"
            body="The walking surface. Step timing and left-right weight shift come from the floor, which is what turns cadence and symmetry into a score."
            online={state.sensors.trackpad}
            onToggle={() => setSensor("trackpad", !state.sensors.trackpad)}
          />
          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold text-ink">
                <span className="grid size-8 place-items-center rounded-full bg-mint text-forest">
                  <Projector className="size-4" />
                </span>
                Projection
              </div>
              <span className="text-xs font-semibold text-forest">Ready</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Casts the lawn onto the trackpad. You stomp the plants you see. They close in when pace or stride slips.
            </p>
          </div>
          <Button type="button" className="h-10 rounded-full" onClick={runCheck} disabled={checking}>
            {checking ? "Checking the kit…" : "Run a connection check"}
          </Button>
          {checked ? (
            <p className="text-sm text-forest" role="status">
              Camera and trackpad both answered.
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SensorRow({
  icon,
  name,
  body,
  online,
  onToggle,
}: {
  icon: ReactNode
  name: string
  body: string
  online: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-ink">
          <span className="grid size-8 place-items-center rounded-full bg-mint text-forest">{icon}</span>
          {name}
        </div>
        <span className={online ? "text-xs font-semibold text-forest" : "text-xs font-semibold text-orange"}>
          {online ? "Connected" : "Offline"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onToggle}
        className="mt-3 text-sm font-semibold text-forest underline-offset-4 hover:underline"
      >
        {online ? `Mark ${name.toLowerCase()} offline` : `Mark ${name.toLowerCase()} connected`}
      </button>
    </div>
  )
}
