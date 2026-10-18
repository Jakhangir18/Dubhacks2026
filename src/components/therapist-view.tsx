"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Send } from "lucide-react"
import { PageActions } from "@/components/app-shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatClock, formatWhen, uid } from "@/lib/format"
import { mayaReply } from "@/lib/maya"
import { useStride } from "@/lib/store"
import { cn } from "cn"

const PROMPTS = [
  "What should I focus on today?",
  "How is my symmetry this week?",
  "Why did my pace drop?",
  "What does my latest score mean?",
]

export function TherapistView() {
  const { state, derived, addMessage } = useStride()
  const [draft, setDraft] = useState("")
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState("")
  const endRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [state.messages.length, typing])

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
    const reply = mayaReply(trimmed, {
      walkingScore: derived.walkingScore,
      delta: derived.scoreDelta,
      latest: derived.latest,
      weekMinutes: derived.weekMinutes,
      goal: state.weeklyGoalMin,
      streak: derived.streak,
      prescribedName: derived.prescribed.name,
    })
    addMessage({ id: uid("jordan"), from: "jordan", text: trimmed, at: new Date().toISOString() })
    setTyping(true)
    timer.current = window.setTimeout(() => {
      addMessage({ id: uid("maya"), from: "maya", text: reply, at: new Date().toISOString() })
      setTyping(false)
    }, 700)
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Image
            src="/images/maya.jpg"
            alt="Maya, the Zombie Walk Home AI therapist"
            width={76}
            height={76}
            className="size-[72px] rounded-full object-cover"
          />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">AI THERAPIST</p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight text-ink">Maya</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              She reviews every scored walk. She does not assess pain. That note goes to the care team.
            </p>
          </div>
        </div>
        <div className="hidden lg:block">
          <PageActions />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.8fr)]">
        <section className="flex h-[min(720px,calc(100dvh-12rem))] min-h-[520px] flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_8px_24px_rgba(23,48,38,0.04)]">
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {state.messages.map((message) => (
              <div key={message.id} className={cn("flex", message.from === "jordan" && "justify-end")}>
                <div className={cn("max-w-[36rem]", message.from === "maya" && "flex gap-3")}>
                  {message.from === "maya" ? (
                    <Image
                      src="/images/maya.jpg"
                      alt=""
                      width={32}
                      height={32}
                      className="mt-1 size-8 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <div>
                    <div
                      className={cn(
                        "rounded-3xl px-4 py-3 text-sm leading-6",
                        message.from === "maya" ? "rounded-tl-md bg-mint text-ink" : "rounded-tr-md bg-forest text-white",
                      )}
                    >
                      {message.text}
                    </div>
                    <p className={cn("mt-1 text-[11px] text-muted-foreground", message.from === "jordan" && "text-right")}>
                      {formatWhen(message.at, derived.now)} · {formatClock(message.at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {typing ? (
              <p className="text-sm text-muted-foreground" role="status">
                Maya is reviewing the numbers…
              </p>
            ) : null}
            <div ref={endRef} />
          </div>
          <form
            className="border-t border-border p-3 sm:p-4"
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
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="shrink-0 rounded-full bg-[#f3f6f2] px-3 py-1.5 text-xs font-medium text-[#41564a] hover:bg-mint"
                >
                  {prompt}
                </button>
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
                placeholder="Ask about pace, symmetry, or today's goal."
                className="min-h-12 flex-1 bg-white"
                aria-invalid={Boolean(error)}
              />
              <Button type="submit" className="size-11 rounded-full" aria-label="Send" disabled={typing}>
                <Send className="size-4" />
              </Button>
            </div>
            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          </form>
        </section>

        <aside className="grid gap-4">
          <article className="rounded-[24px] bg-mint p-5">
            <p className="text-xs font-semibold tracking-[0.14em] text-forest">TODAY</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">{derived.prescribed.name}</h2>
            <p className="mt-2 text-sm leading-6 text-[#2a4034]">{derived.prescribed.summary}</p>
          </article>
          <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(23,48,38,0.04)]">
            <h2 className="font-semibold text-ink">Latest scored walk</h2>
            {derived.latest ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                <Score label="Pace" value={derived.latest.pace} />
                <Score label="Symmetry" value={derived.latest.symmetry} />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No scored walk yet.</p>
            )}
            {derived.latest ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{derived.latest.feedback}</p>
            ) : null}
          </article>
        </aside>
      </div>
    </div>
  )
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#f6faf6] px-2 py-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}
