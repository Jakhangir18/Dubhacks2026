"use client"

/** Maya's chat: questions go to POST /api/maya with the chosen walk; her answer comes back grounded in the walk's
 * numbers and the side camera's pictures (shown under the answer), and is spoken with the Gemini voice. */

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Send, Sparkles, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { api, type MayaReply, type MayaTurn, type Moment } from "@/lib/game"
import { MAYA_AVATAR, sticker } from "@/lib/sticker"
import { cn } from "cn"

export const MAYA_PROMPTS = ["How did my knees do?", "What should I practise next time?", "Look at my photos"]

type Line = MayaTurn & { id: string; source?: MayaReply["source"]; usedPhotos?: number; photos?: Moment[] }

export function MayaChat({ player, sessionId, opening, compact = false, className }: { player: string; sessionId: string | null; opening?: string | null; compact?: boolean; className?: string }) {
  const [lines, setLines] = useState<Line[]>([])
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [voice, setVoice] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [lines.length, busy])

  useEffect(() => () => audio.current?.pause(), [])

  async function speak(text: string) {
    if (!voice) return
    try {
      const blob = await api.speak(text, player)
      audio.current?.pause()
      audio.current = new Audio(URL.createObjectURL(blob))
      await audio.current.play()
    } catch {
      /* no voice on this server, or autoplay blocked: the text is on the screen */
    }
  }

  async function send(text: string) {
    const message = text.trim().slice(0, 500)
    if (!message || busy) return
    setError("")
    setDraft("")
    const history = lines.slice(-8).map(({ role, text }) => ({ role, text }))
    setLines((list) => [...list, { id: `u-${Date.now()}`, role: "user", text: message }])
    setBusy(true)
    try {
      const reply = await api.maya({ player, sessionId, message, history })
      setLines((list) => [...list, { id: `m-${Date.now()}`, role: "maya", text: reply.reply, source: reply.source, usedPhotos: reply.usedPhotos, photos: reply.photos }])
      void speak(reply.reply)
    } catch {
      setError("Maya did not answer: is the game server running?")
    } finally {
      setBusy(false)
    }
  }

  const shown: Line[] = opening && lines.length === 0 ? [{ id: "opening", role: "maya", text: opening }] : lines

  return (
    <section className={cn(sticker("rose", "flex flex-col overflow-hidden"), compact ? "min-h-[320px]" : "h-[min(720px,calc(100dvh-12rem))] min-h-[520px]", className)} aria-label="Ask Maya">
      <div className={cn("flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6", compact && "max-h-[420px]")}>
        {compact ? (
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#ff8fbf]">ASK MAYA ABOUT THIS WALK</p>
        ) : null}
        <AnimatePresence initial={false}>
          {shown.map((line) => (
            <motion.div key={line.id} layout="position" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 28 }} className={cn("flex", line.role === "user" && "justify-end")}>
              <div className={cn("max-w-[36rem]", line.role === "maya" && "flex gap-3")}>
                {line.role === "maya" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={MAYA_AVATAR} alt="" className="mt-1 size-9 shrink-0 rounded-full bg-[#ffd6e7] object-contain ring-2 ring-[#ff3d8b]" />
                ) : null}
                <div className="min-w-0">
                  <div className={cn("rounded-3xl border-[2.5px] border-[#0b1a14] px-4 py-3 text-[15px] leading-6", line.role === "maya" ? "rounded-tl-md bg-white text-[#0b1a14] shadow-[3px_3px_0_#9c2457]" : "rounded-tr-md bg-[#9cff5a] font-medium text-[#0b1a14] shadow-[3px_3px_0_#3d7a19]")}>
                    {line.text}
                  </div>
                  {line.source ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/60">
                      <Sparkles className="size-3" /> {line.source === "gemini" ? "Gemini" : "Rules"} · looked at {line.usedPhotos ?? 0} {line.usedPhotos === 1 ? "photo" : "photos"}
                    </p>
                  ) : null}
                  {line.photos?.length ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {line.photos.map((photo) => (
                        <li key={photo.id} className="w-28 overflow-hidden rounded-xl border-2 border-[#0b1a14] bg-black">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.img} alt={photo.title} title={photo.explain} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                          <span className="block truncate px-1.5 py-0.5 text-[10px] font-semibold text-white/80">{photo.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {busy ? (
          <div className="flex items-center gap-3" role="status">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MAYA_AVATAR} alt="" className="size-9 rounded-full bg-[#ffd6e7] object-contain ring-2 ring-[#ff3d8b]" />
            <span className="flex items-center gap-1 rounded-3xl rounded-tl-md border-[2.5px] border-[#0b1a14] bg-white px-4 py-3">
              {[0, 1, 2].map((dot) => (
                <motion.span key={dot} className="size-2 rounded-full bg-[#ff3d8b]" animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.15 }} />
              ))}
            </span>
            <span className="text-sm text-white/60">Maya is looking at your walk…</span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        className="border-t-[2.5px] border-[#ff3d8b]/40 bg-black/20 p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!draft.trim()) setError("Write a question first.")
          else void send(draft)
        }}
      >
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
          {MAYA_PROMPTS.map((prompt, index) => (
            <motion.button key={prompt} type="button" onClick={() => void send(prompt)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + index * 0.07 }} whileHover={{ y: -2 }} className="shrink-0 rounded-full border-2 border-[#ff3d8b]/60 bg-[#2a1220] px-3 py-1.5 text-xs font-semibold text-[#ffd6e7] hover:bg-[#3a1830]">
              {prompt}
            </motion.button>
          ))}
          <button type="button" onClick={() => { setVoice((on) => !on); if (voice) audio.current?.pause() }} aria-pressed={voice} aria-label={voice ? "Maya's voice on" : "Maya's voice off"} className={cn("ml-auto grid size-8 shrink-0 place-items-center rounded-full border-2", voice ? "border-[#0b1a14] bg-[#ffd76a] text-[#0b1a14]" : "border-white/20 text-white/60")}>
            {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea value={draft} onChange={(event) => { setDraft(event.target.value); if (error) setError("") }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!draft.trim()) setError("Write a question first."); else void send(draft) } }} placeholder="Ask about your knees, your photos, or what to practise next." maxLength={500} className="min-h-12 flex-1 rounded-2xl border-[2.5px] border-[#2c4639] bg-[#0d171c] text-[15px] text-white placeholder:text-white/40" aria-invalid={Boolean(error)} />
          <Button type="submit" className="size-12 rounded-2xl border-[2.5px] border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14] shadow-[0_4px_0_#3d7a19] hover:bg-[#b4ff80] active:translate-y-1 active:shadow-none" aria-label="Send" disabled={busy}>
            <Send className="size-5" />
          </Button>
        </div>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </form>
    </section>
  )
}
