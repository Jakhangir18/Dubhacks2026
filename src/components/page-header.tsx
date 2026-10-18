"use client"

import type { ReactNode } from "react"
import { PageActions } from "@/components/app-shell"

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
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-[1.85rem] font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted-foreground">{subtitle}</p> : null}
        {extra}
      </div>
      <div className="hidden shrink-0 lg:block">
        <PageActions />
      </div>
    </div>
  )
}
