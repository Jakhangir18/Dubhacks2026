"use client"

/** Game control: the therapist's pre-flight (game screen, top camera, phone), the game's state line and the
 * buttons that drive the game through POST /api/game/control. The compact twin lives on the overview. */

import Link from "next/link"
import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowRight, Check, Copy, FastForward, Gauge, Minus, Pause, Play, Plus, RotateCcw, Square, Volume2, VolumeX, Footprints } from "lucide-react"
import { useMounted, type ControlCmd, type GameState } from "@/lib/game"
import type { GameScreen } from "@/lib/live"
import { gameOrigin } from "@/lib/paths"
import { sticker } from "@/lib/sticker"
import { clock } from "@/lib/walks"
import { cn } from "cn"

const LABEL: Record<ControlCmd, string> = {
  start: "Start",
  pause: "Pause",
  resume: "Resume",
  next: "Next round",
  end: "End walk",
  restart: "Restart",
  voice: "Voice",
  faster: "Faster",
  slower: "Slower",
  autowalk: "Auto-walk",
}

const ACT_WORD: Record<string, string> = { walk: "WALKING", garden: "FLOWERS", rest: "REST" }

/** The game's state in two lines: a word for the scene, and the round, score and time. */
export function stateLine(state: GameState | null, connected: boolean): { title: string; detail: string } {
  if (!connected || !state) return { title: "NO GAME SCREEN", detail: "Open the game link on the projector laptop; this line fills itself." }
  const round = state.round && state.rounds ? `round ${state.round} of ${state.rounds}` : state.round ? `round ${state.round}` : null
  const bits = [round, `${state.score} pts`, clock(state.t), state.stompPct !== null ? `${Math.round(state.stompPct)}% flowers` : null].filter(Boolean)
  switch (state.scene) {
    case "title":
      return { title: "TITLE SCREEN", detail: "Ready: Start plays the intro." }
    case "intro":
      return { title: "INTRO", detail: "The story is playing on the projector." }
    case "ready":
      return { title: "ON THE STRIPS", detail: "Stand on the white strips; Start begins the warm-up." }
    case "zone":
      return { title: "PROJECTOR SETUP", detail: "The game is being lined up on the pad." }
    case "home":
      return { title: "HOME", detail: `The walk is over, the summary is on the screen · ${bits.join(" · ")}` }
    default:
      return { title: state.paused ? "PAUSED" : (ACT_WORD[state.act ?? ""] ?? "PLAYING"), detail: bits.join(" · ") }
  }
}

function useGameLink() {
  const mounted = useMounted()
  return useMemo(() => (mounted && gameOrigin() ? `${gameOrigin()}/?demo=1&line=0.68` : null), [mounted])
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          window.setTimeout(() => setDone(false), 1500)
        } catch {
          window.prompt("Copy the game link", text)
        }
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-[#0b1a14] bg-[#ffd76a] px-3 text-sm font-bold text-[#0b1a14] shadow-[0_3px_0_#a8690b] active:translate-y-0.5 active:shadow-none"
    >
      {done ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}
      {done ? "Copied" : "Copy"}
    </button>
  )
}

function Preflight({ ok, pending, label, state, fix, children }: { ok: boolean; pending?: boolean; label: string; state: string; fix?: string; children?: React.ReactNode }) {
  return (
    <li className={cn("rounded-2xl border-2 p-3", ok ? "border-[#9cff5a]/60 bg-[#12261a]" : "border-[#ffb21e]/50 bg-[#2a1f0e]/70")}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2", ok ? "border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]" : "border-[#ffb21e]/70 text-[#ffb21e]")}>
          {ok ? <Check className="size-4" strokeWidth={3} /> : <span className={cn("size-2.5 rounded-full bg-[#ffb21e]", !pending && "motion-safe:animate-pulse")} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{label}</p>
          <p className={cn("text-sm leading-5", ok ? "text-[#9cff5a]" : "text-[#ffd76a]")} aria-live="polite">
            {state}
          </p>
          {!ok && fix ? <p className="mt-0.5 text-sm leading-5 text-white/65">{fix}</p> : null}
          {children}
        </div>
      </div>
    </li>
  )
}

function Confirmation({ game }: { game: GameScreen }) {
  const last = game.last
  return (
    <AnimatePresence mode="wait">
      {last ? (
        <motion.p
          key={last.at}
          className={cn("text-sm font-semibold", last.error ? "text-[#ff8fbf]" : last.gameConnected ? "text-[#9cff5a]" : "text-[#ffd76a]")}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
        >
          {last.error ? `${LABEL[last.cmd]}: ${last.error}` : `${LABEL[last.cmd]} sent · ${last.gameConnected ? "the game is listening" : "no game screen connected"}`}
        </motion.p>
      ) : null}
    </AnimatePresence>
  )
}

type ButtonProps = { cmd: ControlCmd; game: GameScreen; enabled: boolean; label?: string; icon: React.ReactNode; primary?: boolean; hint?: string }

function ControlButton({ cmd, game, enabled, label, icon, primary, hint }: ButtonProps) {
  const sending = game.busy === cmd
  return (
    <motion.button
      type="button"
      whileTap={enabled ? { y: 2 } : undefined}
      disabled={!enabled || game.busy !== null}
      onClick={() => void game.control(cmd)}
      title={enabled ? undefined : hint}
      aria-label={label ?? LABEL[cmd]}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-2xl border-[2.5px] border-[#0b1a14] px-4 text-sm font-bold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40",
        primary ? "font-display bg-[#9cff5a] px-6 text-xl text-[#0b1a14] shadow-[0_5px_0_#3d7a19]" : "bg-[#0d171c] text-white shadow-[0_4px_0_#050809] hover:bg-[#14242a]",
        sending && "opacity-70",
      )}
    >
      {icon}
      {label ?? LABEL[cmd]}
    </motion.button>
  )
}

export type PreflightChecks = { top: boolean; side: boolean; body: boolean; sideRate: number | null; polled: boolean }

export function GameControl({ game, checks }: { game: GameScreen; checks: PreflightChecks }) {
  const link = useGameLink()
  const state = game.state
  const line = stateLine(state, game.connected)
  const playing = game.connected && state?.scene === "play"
  const canStart = game.connected && (state?.scene === "title" || state?.scene === "ready")
  const phoneOk = checks.side && checks.body
  return (
    <section className={sticker("amber", "p-5 sm:p-6")} aria-label="Game control">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#ffb21e]">FOR THE THERAPIST</p>
          <h2 className="font-display text-outline mt-1 text-3xl tracking-wide text-[#ffd76a] sm:text-4xl">GAME CONTROL</h2>
        </div>
        {link ? (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <span className="hidden sm:inline">Game link</span>
            <code className="rounded-lg bg-black/30 px-2 py-1 text-xs text-white/85">{link.replace(/^https?:\/\//, "")}</code>
            <CopyButton text={link} />
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-white/60">PRE-FLIGHT</p>
          <ul className="mt-2 grid gap-2">
            <Preflight
              ok={game.connected}
              pending={!game.polled}
              label="Game screen"
              state={game.connected ? `Connected · ${line.title.toLowerCase()}` : game.missing ? "This server has no game channel yet" : game.polled ? "Not connected" : "Asking the server"}
              fix="Open it on the projector laptop, full screen with F."
            >
              {!game.connected && link ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={link} target="_blank" rel="noreferrer" className="font-display text-xl leading-tight text-white [overflow-wrap:anywhere] hover:underline sm:text-2xl">
                    {link.replace(/^https?:\/\//, "")}
                  </a>
                  <CopyButton text={link} />
                </div>
              ) : null}
            </Preflight>
            <Preflight
              ok={checks.top}
              label="Top camera"
              state={checks.top ? "Live" : "No pictures in the last 3 s"}
              fix="Start feet.py on the camera computer; it sends the pad's pictures to this server."
            />
            <Preflight
              ok={phoneOk}
              pending={!checks.polled}
              label="Side camera (phone)"
              state={phoneOk ? `Live${checks.sideRate !== null ? ` · ${checks.sideRate.toFixed(1)} pictures a second` : ""} · whole body in view` : checks.side ? "Pictures arrive, the whole body is not in view yet" : "Not connected"}
              fix={checks.side ? "Move the phone until shoulders, hips, knees and ankles show green in the step below." : "Scan the QR code in the step below with the phone."}
            />
          </ul>
        </div>

        <div className="rounded-[22px] border-[2.5px] border-[#0b1a14] bg-[#070b10]/60 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-white/60">THE GAME NOW</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${line.title}-${game.connected}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <p className={cn("font-display text-outline mt-1 text-3xl leading-none tracking-wide", game.connected ? "text-[#9cff5a]" : "text-white/50")}>{line.title}</p>
              <p className="mt-1.5 text-sm leading-5 text-white/75" aria-live="polite">{line.detail}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ControlButton cmd="start" game={game} enabled={canStart} icon={<Play className="size-5 fill-current" />} primary hint="Needs the game screen on its title or ready scene" />
            {state?.paused ? (
              <ControlButton cmd="resume" game={game} enabled={playing} icon={<Play className="size-4" />} hint="Only while the game plays" />
            ) : (
              <ControlButton cmd="pause" game={game} enabled={playing} icon={<Pause className="size-4" />} hint="Only while the game plays" />
            )}
            <ControlButton cmd="next" game={game} enabled={playing && state?.act === "rest"} icon={<FastForward className="size-4" />} hint="Only during the rest between rounds" />
            <ControlButton cmd="end" game={game} enabled={playing} icon={<Square className="size-4 fill-current" />} hint="Only while the game plays" />
            <ControlButton cmd="restart" game={game} enabled={game.connected} icon={<RotateCcw className="size-4" />} hint="Needs the game screen" />
          </div>
          <p className="mt-2 text-xs text-white/55">The cameras are recommended, not required: you can start without the side camera.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ControlButton
              cmd="voice"
              game={game}
              enabled={game.connected}
              label={state ? (state.voice ? "Voice on" : "Voice off") : "Voice"}
              icon={state?.voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              hint="Needs the game screen"
            />
            <span className="inline-flex items-center gap-1 rounded-2xl border-[2.5px] border-[#0b1a14] bg-[#0d171c] p-1 shadow-[0_4px_0_#050809]">
              <button type="button" onClick={() => void game.control("slower")} disabled={!game.connected || game.busy !== null} aria-label="Plant speed slower" className="grid size-8 place-items-center rounded-xl text-white hover:bg-white/10 disabled:opacity-40">
                <Minus className="size-4" />
              </button>
              <span className="inline-flex items-center gap-1 px-1 text-sm font-bold text-white tabular-nums">
                <Gauge className="size-4 text-[#ffb21e]" /> speed ×{state?.speed !== null && state?.speed !== undefined ? state.speed.toFixed(1) : "–"}
              </span>
              <button type="button" onClick={() => void game.control("faster")} disabled={!game.connected || game.busy !== null} aria-label="Plant speed faster" className="grid size-8 place-items-center rounded-xl text-white hover:bg-white/10 disabled:opacity-40">
                <Plus className="size-4" />
              </button>
            </span>
            <ControlButton cmd="autowalk" game={game} enabled={game.connected} label="Auto-walk (demo)" icon={<Footprints className="size-4" />} hint="Needs the game screen" />
          </div>
          <div className="mt-3 min-h-5">
            <Confirmation game={game} />
          </div>
        </div>
      </div>
    </section>
  )
}

/** The state line and the main buttons, for the overview. */
export function GameControlCompact({ game }: { game: GameScreen }) {
  const state = game.state
  const line = stateLine(state, game.connected)
  const playing = game.connected && state?.scene === "play"
  const canStart = game.connected && (state?.scene === "title" || state?.scene === "ready")
  return (
    <section className={sticker("amber", "flex flex-wrap items-center gap-4 rounded-[22px] px-5 py-4")} aria-label="Game control">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">THE GAME NOW</p>
        <p className={cn("font-display text-outline text-2xl leading-none tracking-wide", game.connected ? "text-[#9cff5a]" : "text-white/50")}>{line.title}</p>
        <p className="mt-1 truncate text-sm text-white/70">{line.detail}</p>
        <div className="mt-1 min-h-5">
          <Confirmation game={game} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ControlButton cmd="start" game={game} enabled={canStart} icon={<Play className="size-5 fill-current" />} primary hint="Needs the game screen on its title or ready scene" />
        {state?.paused ? (
          <ControlButton cmd="resume" game={game} enabled={playing} icon={<Play className="size-4" />} hint="Only while the game plays" />
        ) : (
          <ControlButton cmd="pause" game={game} enabled={playing} icon={<Pause className="size-4" />} hint="Only while the game plays" />
        )}
        <ControlButton cmd="end" game={game} enabled={playing} icon={<Square className="size-4 fill-current" />} hint="Only while the game plays" />
        <Link href="/play" className="inline-flex items-center gap-1 text-sm font-semibold text-[#ffd76a] hover:underline">
          Live walk <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  )
}
