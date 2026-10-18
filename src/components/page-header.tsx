"use client"

import type { ReactNode } from "react"
import { BlurFade } from "@/components/ui/blur-fade"

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  extra,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  extra?: ReactNode
}) {
  return (
    <BlurFade delay={0.05} className="mb-6">
      {eyebrow ? <p className="text-[11px] font-bold tracking-[0.2em] text-[#2de2c4]">{eyebrow}</p> : null}
      <h1 className="font-display mt-1 text-4xl tracking-wide text-foreground sm:text-5xl">{title}</h1>
      {subtitle ? <p className="mt-1.5 max-w-2xl text-base leading-7 text-white/70">{subtitle}</p> : null}
      {extra}
    </BlurFade>
  )
}
