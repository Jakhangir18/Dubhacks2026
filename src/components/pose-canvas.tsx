"use client"

import { useEffect, useRef } from "react"
import { LEFT, RIGHT } from "@/components/walk-bits"
import type { Pose, PoseKey } from "@/lib/game"
import { cn } from "cn"

type Bone = readonly [PoseKey, PoseKey, "L" | "R" | "C"]

/** Hip, knee, ankle, heel and toe per leg, the torso line, and the cross lines between the sides. */
const BONES: readonly Bone[] = [
  ["l_shoulder", "l_hip", "L"],
  ["l_hip", "l_knee", "L"],
  ["l_knee", "l_ankle", "L"],
  ["l_ankle", "l_heel", "L"],
  ["l_heel", "l_toe", "L"],
  ["l_ankle", "l_toe", "L"],
  ["r_shoulder", "r_hip", "R"],
  ["r_hip", "r_knee", "R"],
  ["r_knee", "r_ankle", "R"],
  ["r_ankle", "r_heel", "R"],
  ["r_heel", "r_toe", "R"],
  ["r_ankle", "r_toe", "R"],
  ["l_shoulder", "r_shoulder", "C"],
  ["l_hip", "r_hip", "C"],
]
const JOINTS: readonly PoseKey[] = ["l_shoulder", "r_shoulder", "l_hip", "r_hip", "l_knee", "r_knee", "l_ankle", "r_ankle"]
const COLOR = { L: LEFT, R: RIGHT, C: "rgba(255,255,255,0.7)" }
const MIN_VISIBLE = 0.3

/** Draws the newest pose over the side picture: the canvas has the picture's own pixel size and the same
 * object-fit, so the fractions in the pose land on the body. */
export function PoseCanvas({ pose, width, height, className }: { pose: Pose | null; width: number; height: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !width || !height) return
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    if (!pose) return
    const point = (key: PoseKey) => {
      const value = pose.pts[key]
      if (!value || value[2] < MIN_VISIBLE) return null
      return { x: value[0] * width, y: value[1] * height }
    }
    const stroke = Math.max(3, Math.round(width / 160))
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const [from, to, side] of BONES) {
      const a = point(from)
      const b = point(to)
      if (!a || !b) continue
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.lineWidth = stroke * 2.2
      ctx.strokeStyle = "rgba(0,0,0,0.55)"
      ctx.stroke()
      ctx.lineWidth = stroke
      ctx.strokeStyle = COLOR[side]
      ctx.stroke()
    }
    for (const key of JOINTS) {
      const p = point(key)
      if (!p) continue
      ctx.beginPath()
      ctx.arc(p.x, p.y, stroke * 1.3, 0, Math.PI * 2)
      ctx.fillStyle = key.startsWith("l_") ? LEFT : RIGHT
      ctx.fill()
      ctx.lineWidth = Math.max(1.5, stroke * 0.5)
      ctx.strokeStyle = "rgba(0,0,0,0.6)"
      ctx.stroke()
    }
    // The knee angle, written beside each knee the camera sees.
    const font = Math.max(14, Math.round(width / 26))
    ctx.font = `700 ${font}px ui-sans-serif, system-ui, sans-serif`
    ctx.textBaseline = "middle"
    for (const side of ["L", "R"] as const) {
      const knee = point(side === "L" ? "l_knee" : "r_knee")
      const angle = pose.knee?.[side]
      if (!knee || typeof angle !== "number" || !Number.isFinite(angle)) continue
      const label = `${side} ${Math.round(angle)}°`
      const pad = font * 0.45
      const w = ctx.measureText(label).width + pad * 2
      const h = font * 1.5
      const left = knee.x < width / 2 ? knee.x + stroke * 3 : knee.x - stroke * 3 - w
      const x = Math.max(2, Math.min(width - w - 2, left))
      const y = Math.max(h / 2 + 2, Math.min(height - h / 2 - 2, knee.y - (side === "L" ? h * 0.7 : -h * 0.7)))
      ctx.fillStyle = "rgba(7,11,16,0.8)"
      ctx.beginPath()
      ctx.roundRect(x, y - h / 2, w, h, h / 2)
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = side === "L" ? LEFT : RIGHT
      ctx.stroke()
      ctx.fillStyle = side === "L" ? LEFT : RIGHT
      ctx.fillText(label, x + pad, y)
    }
  }, [pose, width, height])

  return <canvas ref={ref} className={cn("pointer-events-none absolute inset-0 size-full object-contain", className)} aria-hidden="true" />
}
