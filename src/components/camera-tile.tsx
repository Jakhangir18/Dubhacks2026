"use client"

import { useState, type ReactNode } from "react"
import { motion } from "motion/react"
import { Camera, Smartphone } from "lucide-react"
import type { CameraState } from "@/lib/live"
import { cn } from "cn"

/** One camera picture with its status chip; the overlay (the skeleton) is drawn by the child it is given the
 * picture's pixel size for. The waiting state is deliberate: a quiet tile, not a broken image. */
export function CameraTile({
  title,
  waiting,
  camera,
  kind,
  overlay,
  className,
}: {
  title: string
  waiting: string
  camera: CameraState
  kind: "top" | "side"
  overlay?: (size: { width: number; height: number }) => ReactNode
  className?: string
}) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const Icon = kind === "side" ? Smartphone : Camera
  const state = camera.fresh ? "live" : camera.seenEver ? "lost" : "waiting"

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-[22px] border-[2.5px] border-[#2c4639] bg-black shadow-[4px_4px_0_#050809]", className)}>
      {camera.src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={camera.src}
            alt={title}
            className={cn("size-full object-contain transition-opacity", state === "lost" && "opacity-40")}
            onLoad={(event) => {
              const image = event.currentTarget
              if (image.naturalWidth !== size.width || image.naturalHeight !== size.height) {
                setSize({ width: image.naturalWidth, height: image.naturalHeight })
              }
            }}
          />
          {overlay && size.width ? overlay(size) : null}
        </>
      ) : (
        <div className="grid size-full place-items-center bg-[radial-gradient(ellipse_at_50%_60%,rgba(45,226,196,0.12),transparent_60%)]">
          <div className="flex flex-col items-center gap-2 text-center">
            <motion.span
              className="grid size-14 place-items-center rounded-full border-[2.5px] border-dashed border-white/25 text-white/60"
              animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className="size-6" />
            </motion.span>
            <p className="max-w-[16rem] text-sm leading-5 text-white/60">{waiting}</p>
          </div>
        </div>
      )}
      <span
        className={cn(
          "absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-[11px] font-bold tracking-[0.1em]",
          state === "live" && "border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]",
          state === "lost" && "border-[#ffb21e]/70 bg-[#2a1f0e] text-[#ffd76a]",
          state === "waiting" && "border-white/20 bg-black/60 text-white/70",
        )}
      >
        {state === "live" ? <span className="size-2 rounded-full bg-[#0b1a14] motion-safe:animate-pulse" /> : null}
        {title.toUpperCase()} · {state.toUpperCase()}
      </span>
    </div>
  )
}
