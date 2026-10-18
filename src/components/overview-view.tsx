"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { ArrowRight, BarChart3, Check, ChevronRight, Sprout, TrendingUp, Waves } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatLevel, formatMinutes, formatWhen, greeting, formatHeading } from "@/lib/format"
import { LEVEL_IMAGE_ALT, LEVEL_IMAGES } from "@/lib/levels"
import { streakCopy } from "@/lib/metrics"
import { useStride } from "@/lib/store"
import { cn } from "cn"

export function OverviewView() {
  const { state, derived } = useStride()
  const [range, setRange] = useState<"this" | "last">("this")
  const days = range === "this" ? derived.week : derived.lastWeek
  const minutes = range === "this" ? derived.weekMinutes : derived.lastWeekMinutes
  const peak = Math.max(...days.map((day) => day.minutes), 0)
  const maya = [...state.messages].reverse().find((message) => message.from === "maya")
  const level = derived.prescribed
  const recent = derived.recent.slice(0, 2)

  return (
    <div>
      <PageHeader
        eyebrow={formatHeading(derived.now)}
        title={`${greeting(derived.now)}, Jordan.`}
        subtitle="Your next step is ready when you are."
      />

      <section className="overflow-hidden rounded-[28px] bg-forest text-white shadow-[0_16px_40px_rgba(18,92,66,0.18)]">
        <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
          <div className="relative z-10 flex flex-col justify-center px-6 py-7 sm:px-8 lg:py-9 lg:pl-9 lg:pr-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-white/75">
              <span>TODAY&apos;S SESSION</span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 tracking-normal">{level.minutes} MIN</span>
            </div>
            <h2 className="mt-4 max-w-md text-[2rem] font-semibold leading-none tracking-tight sm:text-4xl">
              {level.name}
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/80 sm:text-[15px]">{level.summary}</p>
            <ol className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/90">
              {level.focus.map((item, index) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-white/15 text-[11px] font-semibold">
                    {index + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <Button
                render={<Link href={`/play/session?level=${level.id}`} />}
                className="h-11 rounded-full bg-orange px-5 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] hover:bg-[#d9772b]"
              >
                Start today&apos;s session
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="relative min-h-[230px] lg:min-h-[320px]">
            <Image
              src={LEVEL_IMAGES[level.image]}
              alt={LEVEL_IMAGE_ALT[level.image]}
              fill
              priority
              sizes="(min-width: 1024px) 460px, 100vw"
              className="object-cover object-[72%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/15 to-transparent lg:bg-gradient-to-r lg:from-forest lg:via-forest/30 lg:to-transparent" />
            <div className="absolute right-4 top-4 rounded-full bg-[#10281d]/80 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-white backdrop-blur-sm">
              LEVEL {formatLevel(level.id)}
            </div>
            <div className="absolute bottom-4 right-4 rounded-full bg-[#10281d]/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-orange" />
              {level.chip}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        <Link href="/progress" className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)] transition hover:border-forest/15">
          <div className="flex items-center justify-between">
            <span className="grid size-8 place-items-center rounded-full bg-mint text-forest">
              <TrendingUp className="size-4" />
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "h-6 border-transparent px-2",
                derived.scoreDelta >= 0 ? "bg-[#e5f6ea] text-[#1c7a45]" : "bg-peach text-orange",
              )}
            >
              {derived.scoreDelta > 0 ? "+" : ""}
              {derived.scoreDelta}%
            </Badge>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Walking score</p>
          <p className="mt-1 text-[2.6rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
            {derived.walkingScore}
            <span className="ml-1 text-lg font-medium text-muted-foreground">/100</span>
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e5f0e8]">
            <div className="h-full rounded-full bg-forest" style={{ width: `${derived.walkingScore}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Moving toward your weekly goal</p>
        </Link>

        <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)]">
          <div className="flex items-center justify-between">
            <span className="grid size-8 place-items-center rounded-full bg-peach text-orange">
              <BarChart3 className="size-4" />
            </span>
            <button
              type="button"
              onClick={() => setRange((current) => (current === "this" ? "last" : "this"))}
              className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-xs font-medium text-[#6d5c49]"
              aria-pressed={range === "last"}
            >
              {range === "this" ? "This week" : "Last week"}
            </button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Practice time</p>
          <p className="mt-1 text-[2.6rem] font-semibold leading-none tracking-tight text-ink tabular-nums">
            {minutes}
            <span className="ml-1 text-lg font-medium text-muted-foreground">min</span>
          </p>
          <div className="mt-4 flex h-24 items-end gap-2">
            {days.map((day, index) => {
              const height = day.minutes === 0 ? 10 : Math.max(18, (day.minutes / Math.max(peak, 1)) * 100)
              const hot = day.minutes > 0 && day.minutes === peak
              return (
                <div key={`${range}-${day.key}`} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-16 w-full items-end">
                    <div
                      className={cn("bar-rise mx-auto w-full max-w-7 rounded-md", hot ? "bg-orange" : "bg-sage")}
                      style={{ height: `${height}%`, animationDelay: `${index * 40}ms` }}
                    />
                  </div>
                  <span className={cn("text-[11px]", day.isToday ? "font-semibold text-ink" : "text-muted-foreground")}>
                    {day.label}
                  </span>
                </div>
              )
            })}
          </div>
        </article>

        <article className="rounded-[24px] bg-mint p-5">
          <div className="flex items-center gap-3">
            <Image
              src="/images/maya.jpg"
              alt="Maya, the StrideBloom AI therapist"
              width={44}
              height={44}
              className="size-11 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-ink">Maya, your AI therapist</p>
              <p className="text-xs text-muted-foreground">Personalized for today</p>
            </div>
          </div>
          <blockquote className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-[#2a4034]">
            “{maya?.text ?? "Finish a scored walk and I will have a note waiting."}”
          </blockquote>
          <Link
            href="/therapist"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest"
          >
            View Maya&apos;s full feedback
            <ArrowRight className="size-4" />
          </Link>
        </article>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_0.9fr]">
        <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
              <p className="text-sm text-muted-foreground">Your latest practice sessions</p>
            </div>
            <Link href="/activity" className="text-sm font-semibold text-forest">
              View all
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border/80">
            {recent.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/activity?session=${session.id}`}
                  className="flex items-center gap-3 py-3.5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f3f7f3] text-forest">
                    {session.levelName === "River Crossing" || session.levelName === "Bloom Line" ? (
                      <Waves className="size-4" />
                    ) : (
                      <Sprout className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{session.levelName}</span>
                    <span className="block text-sm text-muted-foreground">
                      {formatWhen(session.playedAt, derived.now)} · {session.source === "form-round" ? "Form round · " : ""}
                      {formatMinutes(session.durationMin)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums text-ink">{session.walkingScore}</span>
                    <span className="block text-xs text-muted-foreground">Walking score</span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-[24px] bg-peach p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Current streak</h2>
          <p className="mt-3 text-5xl font-semibold tracking-tight text-ink tabular-nums">
            {derived.streak}
            <span className="ml-2 text-lg font-medium text-[#8a6244]">days</span>
          </p>
          <div className="mt-5 flex gap-2">
            {derived.week.map((day) => (
              <span
                key={day.key}
                className={cn(
                  "grid size-9 flex-1 place-items-center rounded-full text-xs font-semibold",
                  day.hasSession && "bg-orange text-white",
                  !day.hasSession && day.isToday && "bg-white text-orange ring-2 ring-orange",
                  !day.hasSession && !day.isToday && "bg-[#f3e4d4] text-[#b08968]",
                )}
                aria-label={`${day.label} ${day.hasSession ? "practiced" : day.isToday ? "today, not yet" : "no session"}`}
              >
                {day.hasSession ? <Check className="size-4" /> : day.label}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[#6d533c]">{streakCopy(state, derived)}</p>
        </article>
      </section>
    </div>
  )
}
