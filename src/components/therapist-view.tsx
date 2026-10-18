"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Send } from "lucide-react"
import { Bob } from "@/components/motion"
import { TherapistSettings } from "@/components/therapist-settings"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DemoTag } from "@/components/walk-bits"
import { formatClock, formatWhen, uid } from "@/lib/format"
import { useMounted } from "@/lib/game"
import { useGame } from "@/lib/game-data"
import { mayaReply } from "@/lib/maya"
import { MAYA_AVATAR, sticker } from "@/lib/sticker"
import { useStride } from "@/lib/store"
import type { ChatMessage } from "@/lib/types"
import { mayaLine, startOfWeekLocal, streakOf, weekOf, whenLabel, workOn } from "@/lib/walks"
import { cn } from "cn"

const PROMPTS = [
  "What should I work on next?",
  "How were my knees?",
  "Were my steps even?",
  "What does my latest walk mean?",
]

/** The StrideBloom seed's chat lines: shown only while the demo walks are. */
const SEED_IDS = new Set(["m1", "m2", "m3"])

export function TherapistView() {
  const { state, derived, addMessage } = useStride()
  const { walks, latest, demo, player } = useGame()
  const mounted = useMounted()
  const [draft, setDraft] = useState("")
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const now = new Date()
  const week = weekOf(walks, startOfWeekLocal(now), now)
  const weekMinutes = week.reduce((sum, day) => sum + day.minutes, 0)
  const streak = streakOf(walks, now)

  // Maya opens with her real note on the latest walk; the demo's scripted lines show only with the demo walks.
  const messages = useMemo<ChatMessage[]>(() => {
    if (demo) return state.messages
    const own = state.messages.filter((message) => !SEED_IDS.has(message.id))
    const line = mayaLine(latest)
    if (!latest || !line) return own
    return [{ id: `note-${latest.id}`, from: "maya", text: line, at: new Date(latest.at * 1000).toISOString() }, ...own]
  }, [demo, latest, state.messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, typing])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || typing) return
    setError("")
    setDraft("")
    const reply = mayaReply(trimmed, { latest, walks, streak, weekMinutes, goalMinutes: state.weeklyGoalMin, now: new Date() })
    addMessage({ id: uid("jordan"), from: "jordan", text: trimmed, at: new Date().toISOString() })
    setTyping(true)
    timer.current = window.setTimeout(() => {
      addMessage({ id: uid("maya"), from: "maya", text: reply, at: new Date().toISOString() })
      setTyping(false)
    }, 700)
  }

  const focus = latest ? workOn(latest) : null

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Bob src={MAYA_AVATAR} alt="Maya, the Zombie Walk Home AI therapist" className="size-24 shrink-0 rounded-full bg-[#ffd6e7] object-contain ring-[3px] ring-[#ff3d8b]" />
        <BlurFade delay={0.05}>
          <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.2em] text-[#ff8fbf]">
            AI THERAPIST · ONLINE {demo ? <DemoTag /> : null}
          </p>
          <h1 className="font-display mt-1 text-5xl tracking-wide">Maya</h1>
          <p className="mt-1 max-w-xl text-base leading-6 text-white/70">
            She reviews every walk from the game&apos;s numbers and the side camera. She does not assess pain. That note goes to the care team.
          </p>
        </BlurFade>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
        <section className={sticker("rose", "flex h-[min(720px,calc(100dvh-12rem))] min-h-[520px] flex-col overflow-hidden")}>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  layout="position"
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className={cn("flex", message.from === "jordan" && "justify-end")}
                >
                  <div className={cn("max-w-[36rem]", message.from === "maya" && "flex gap-3")}>
                    {message.from === "maya" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={MAYA_AVATAR} alt="" className="mt-1 size-9 shrink-0 rounded-full bg-[#ffd6e7] object-contain ring-2 ring-[#ff3d8b]" />
                    ) : null}
                    <div>
                      <div
                        className={cn(
                          "rounded-3xl border-[2.5px] border-[#0b1a14] px-4 py-3 text-[15px] leading-6",
                          message.from === "maya"
                            ? "rounded-tl-md bg-white text-[#0b1a14] shadow-[3px_3px_0_#9c2457]"
                            : "rounded-tr-md bg-[#9cff5a] font-medium text-[#0b1a14] shadow-[3px_3px_0_#3d7a19]",
                        )}
                      >
                        {message.text}
                      </div>
                      <p className={cn("mt-1 text-[11px] text-white/50", message.from === "jordan" && "text-right")}>
                        {mounted ? `${formatWhen(message.at, derived.now)} · ${formatClock(message.at)}` : ""}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {typing ? (
              <div className="flex items-center gap-3" role="status">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MAYA_AVATAR} alt="" className="size-9 rounded-full bg-[#ffd6e7] object-contain ring-2 ring-[#ff3d8b]" />
                <span className="flex items-center gap-1 rounded-3xl rounded-tl-md border-[2.5px] border-[#0b1a14] bg-white px-4 py-3">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="size-2 rounded-full bg-[#ff3d8b]"
                      animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.15 }}
                    />
                  ))}
                </span>
                <span className="text-sm text-white/60">Maya is reviewing the numbers…</span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          <form
            className="border-t-[2.5px] border-[#ff3d8b]/40 bg-black/20 p-3 sm:p-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!draft.trim()) {
                setError("Write a question first.")
                return
              }
              send(draft)
            }}
          >
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {PROMPTS.map((prompt, index) => (
                <motion.button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.07 }}
                  whileHover={{ y: -2 }}
                  className="shrink-0 rounded-full border-2 border-[#ff3d8b]/60 bg-[#2a1220] px-3 py-1.5 text-xs font-semibold text-[#ffd6e7] hover:bg-[#3a1830]"
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (error) setError("")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    if (!draft.trim()) setError("Write a question first.")
                    else send(draft)
                  }
                }}
                placeholder="Ask about the knees, the pace, the flowers, or what to work on next."
                className="min-h-12 flex-1 rounded-2xl border-[2.5px] border-[#2c4639] bg-[#0d171c] text-[15px] text-white placeholder:text-white/40"
                aria-invalid={Boolean(error)}
              />
              <Button
                type="submit"
                className="size-12 rounded-2xl border-[2.5px] border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14] shadow-[0_4px_0_#3d7a19] hover:bg-[#b4ff80] active:translate-y-1 active:shadow-none"
                aria-label="Send"
                disabled={typing}
              >
                <Send className="size-5" />
              </Button>
            </div>
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </form>
        </section>

        <aside className="grid gap-5">
          <BlurFade delay={0.2}>
            <article className={sticker("lime", "p-5")}>
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#9cff5a]">WORK ON NEXT</p>
              <h2 className="font-display text-outline mt-1 text-3xl leading-none tracking-wide text-[#ffd76a]">{focus ? focus.text.replace(/\.$/, "").toUpperCase() : "THE FIRST WALK"}</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">{focus?.why ?? "Finish a walk and Maya picks the one thing to work on."}</p>
            </article>
          </BlurFade>
          <BlurFade delay={0.3}>
            <article className={sticker("teal", "p-5")}>
              <h2 className="font-display text-xl tracking-wide">LATEST WALK</h2>
              {latest ? (
                <>
                  <p className="mt-1 text-sm text-white/60">{mounted ? whenLabel(latest.at, now) : ""} · {player}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <Score label="Flowers" value={latest.flowersPct} unit="%" />
                    <Score label="Even L/R" value={latest.evenPct} unit="%" />
                    <Score label="Cadence" value={latest.cadence} unit="/min" />
                    <Score label="Knee L/R" value={latest.kneeDeg.L !== null || latest.kneeDeg.R !== null ? `${latest.kneeDeg.L ?? "–"}/${latest.kneeDeg.R ?? "–"}°` : null} />
                  </dl>
                </>
              ) : (
                <p className="mt-2 text-sm text-white/60">No walk yet.</p>
              )}
            </article>
          </BlurFade>
        </aside>
      </div>

      <div className="mt-6">
        <BlurFade delay={0.35}>
          <TherapistSettings />
        </BlurFade>
      </div>
    </div>
  )
}

function Score({ label, value, unit }: { label: string; value: number | string | null; unit?: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-3">
      <dt className="text-[11px] font-bold tracking-[0.12em] text-[#2de2c4]">{label.toUpperCase()}</dt>
      <dd className="font-display text-outline mt-1 text-3xl tabular-nums text-[#9cff5a]">
        {value === null ? "—" : typeof value === "number" ? <NumberTicker value={value} delay={0.4} /> : value}
        {value !== null && unit ? <span className="ml-0.5 text-base text-white/60">{unit}</span> : null}
      </dd>
    </div>
  )
}
