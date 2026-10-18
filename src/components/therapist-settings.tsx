"use client"

/** The therapist's settings, ported from web/therapist.html: the player, the consents, the limits the coach adapts
 * inside, the parent's rewards and the notes for the coach. Saved with PUT /api/player/{name}. */

import { useCallback, useState } from "react"
import { motion } from "motion/react"
import { Check, ExternalLink, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api, usePoll, type Health, type Player, type PlayerLimits, type Reward } from "@/lib/game"
import { PLAYER_KEY, useGame } from "@/lib/game-data"
import { gameOrigin } from "@/lib/paths"
import { sticker } from "@/lib/sticker"
import { reviewOf } from "@/lib/walks"
import { cn } from "cn"

type Form = {
  minCadence: string
  walkSeconds: string
  gardenPlants: string
  stormSeeds: string
  rounds: string
  liftCm: string
  liftMin: string
  liftMax: string
  spacingCm: string
  spacingMin: string
  spacingMax: string
  sessionMinutes: string
  speedScale: string
  notes: string
  perceptronConsent: boolean
  aiReviewConsent: boolean
  rewards: Reward[]
}

type NumberKey = Exclude<keyof Form, "notes" | "perceptronConsent" | "aiReviewConsent" | "rewards">

const FIELDS: Array<{ key: NumberKey; label: string; min: number; max: number; step?: number }> = [
  { key: "minCadence", label: "Minimum pace, steps per minute", min: 40, max: 160 },
  { key: "walkSeconds", label: "Act 1 walking, seconds", min: 10, max: 300 },
  { key: "gardenPlants", label: "Act 2 flowers", min: 1, max: 60 },
  { key: "stormSeeds", label: "Act 3 seeds (0: none)", min: 0, max: 60 },
  { key: "rounds", label: "Rounds of flowers and seeds", min: 1, max: 10 },
  { key: "liftCm", label: "Lift target, cm", min: 2, max: 40, step: 0.5 },
  { key: "spacingCm", label: "Flower spacing, cm", min: 40, max: 400 },
  { key: "sessionMinutes", label: "Session length, minutes", min: 3, max: 60 },
  { key: "speedScale", label: "Plant speed, times walking speed", min: 0.3, max: 2, step: 0.1 },
]

const INPUT =
  "h-10 w-24 rounded-xl border-[2.5px] border-[#2c4639] bg-[#070b10] px-2.5 text-sm font-semibold text-white tabular-nums outline-none focus-visible:border-[#9cff5a] [color-scheme:dark]"

function text(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value)
}

function formFrom(player: Player): Form {
  const limits = player.limits
  return {
    minCadence: text(limits.minCadence),
    walkSeconds: text(limits.walkSeconds),
    gardenPlants: text(limits.gardenPlants),
    stormSeeds: text(limits.stormSeeds),
    rounds: text(limits.rounds),
    liftCm: text(limits.liftCm),
    liftMin: text(limits.liftRange?.[0]),
    liftMax: text(limits.liftRange?.[1]),
    spacingCm: text(limits.spacingCm),
    spacingMin: text(limits.spacingRange?.[0]),
    spacingMax: text(limits.spacingRange?.[1]),
    sessionMinutes: text(limits.sessionMinutes),
    speedScale: text(limits.speedScale),
    notes: player.notes ?? "",
    perceptronConsent: Boolean(player.perceptronConsent),
    aiReviewConsent: Boolean(player.aiReviewConsent),
    rewards: player.rewards ?? [],
  }
}

function limitsFrom(form: Form): Partial<PlayerLimits> {
  const n = (value: string) => Number(value)
  return {
    minCadence: n(form.minCadence),
    walkSeconds: n(form.walkSeconds),
    gardenPlants: n(form.gardenPlants),
    stormSeeds: n(form.stormSeeds),
    rounds: n(form.rounds) || 1,
    liftCm: n(form.liftCm),
    liftRange: [n(form.liftMin), n(form.liftMax)],
    spacingCm: n(form.spacingCm),
    spacingRange: [n(form.spacingMin), n(form.spacingMax)],
    sessionMinutes: n(form.sessionMinutes),
    ...(form.speedScale === "" ? {} : { speedScale: n(form.speedScale) }),
  }
}

export function TherapistSettings() {
  const { player, players, setPlayer, status, latest, online, refresh } = useGame()
  const loadPlayer = useCallback(() => api.player(player), [player])
  const doc = usePoll(loadPlayer, 30000, true, player)
  // The server's record is the form until the therapist edits it; a save clears the edits and reloads.
  const [edited, setEdited] = useState<{ player: string; form: Form } | null>(null)
  const loaded = doc.data && doc.data.name === player ? doc.data : null
  const form: Form | null = edited && edited.player === player ? edited.form : loaded ? formFrom(loaded) : null
  const [newName, setNewName] = useState("")
  const [reward, setReward] = useState({ name: "", usd: "" })
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const offline = doc.polled && !doc.data && doc.error !== null

  const review = latest && !latest.demo ? reviewOf(latest) : null
  const next = review?.nextSession
  const suggested = next
    ? (
        [
          ["liftCm", "lift target", "cm"],
          ["spacingCm", "flower spacing", "cm"],
          ["minCadence", "minimum pace", "steps/min"],
        ] as const
      ).filter(([key]) => typeof next[key] === "number")
    : []

  const update = (patch: Partial<Form>) => {
    if (form) setEdited({ player, form: { ...form, ...patch } })
  }

  async function save(extra?: Partial<Form>) {
    if (!form || !loaded) return
    const merged = { ...form, ...extra }
    setBusy(true)
    setMessage("")
    try {
      localStorage.removeItem("zombiewalk.speedScale") // the therapist's speed wins over the operator's [ ] keys
    } catch {
      /* storage blocked */
    }
    try {
      const saved = await api.savePlayer(loaded.name, {
        limits: limitsFrom(merged),
        rewards: merged.rewards,
        notes: merged.notes,
        perceptronConsent: merged.perceptronConsent,
        aiReviewConsent: merged.aiReviewConsent,
      })
      setEdited(null)
      doc.refresh()
      setMessage(`Saved ${saved.name}.`)
      refresh()
    } catch (error) {
      setMessage(`Could not save: ${error instanceof Error ? error.message : "the server did not answer"}.`)
    } finally {
      setBusy(false)
    }
  }

  function applySuggestion() {
    if (!next) return
    const patch: Partial<Form> = {}
    if (typeof next.liftCm === "number") patch.liftCm = String(next.liftCm)
    if (typeof next.spacingCm === "number") patch.spacingCm = String(next.spacingCm)
    if (typeof next.minCadence === "number") patch.minCadence = String(next.minCadence)
    update(patch)
    void save(patch)
  }

  function playAs() {
    try {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(player))
    } catch {
      /* storage blocked */
    }
    window.open(`${gameOrigin()}/`, "_blank", "noopener")
  }

  async function checkIntegrations() {
    setMessage("Checking the integrations…")
    try {
      const result = await api.health()
      setHealth(result)
      setMessage(Object.entries(result).map(([key, value]) => `${key}: ${value.ok ? "ok" : value.detail}`).join(" · "))
    } catch {
      setMessage("The check failed: is the game server running?")
    }
  }

  const chips = status
    ? [
        { label: "Gemini", on: status.gemini, key: "gemini" },
        { label: "Backboard memory", on: status.backboard, key: "backboard" },
        { label: `storage: ${status.storage}`, on: status.storage === "mongodb", key: "mongodb" },
        { label: `Visa: ${status.visa}`, on: status.visa !== "mock", key: "visa" },
        { label: "Perceptron", on: status.perceptron, key: "perceptron" },
        ...(status.voice !== undefined ? [{ label: "Gemini voice", on: status.voice, key: "voice" }] : []),
      ]
    : []

  return (
    <section id="settings" className={sticker("ink", "scroll-mt-24 p-5 sm:p-6")} aria-label="Therapist settings">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#2de2c4]">FOR THE THERAPIST AND THE PARENT</p>
          <h2 className="font-display text-outline mt-1 text-3xl tracking-wide text-[#ffd76a]">THERAPIST SETTINGS</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/70">
            The game uses this player&apos;s limits, their memory and their reward list. The coach adapts only inside the limits. Wellness training game, not a medical device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => {
            const checked = health?.[chip.key]
            const on = checked ? checked.ok : chip.on
            return (
              <span
                key={chip.key}
                title={checked?.detail}
                className={cn(
                  "rounded-full border-2 px-2.5 py-0.5 text-[11px] font-semibold",
                  on ? "border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]" : checked ? "border-[#ff3d8b] bg-[#2a1220] text-[#ff8fbf]" : "border-white/15 text-white/55",
                )}
              >
                {chip.label}
              </span>
            )
          })}
          {online ? (
            <button type="button" onClick={checkIntegrations} className="rounded-full border-2 border-[#2c4639] px-2.5 py-0.5 text-[11px] font-semibold text-white/75 hover:border-[#9cff5a]">
              Check integrations
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#9cff5a]">PLAYER</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={players.includes(player) ? player : ""}
              onChange={(event) => event.target.value && setPlayer(event.target.value)}
              aria-label="Player"
              className={cn(INPUT, "w-44 appearance-none")}
            >
              {!players.includes(player) ? <option value="">{player}</option> : null}
              {players.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="new player name"
              aria-label="New player name"
              className={cn(INPUT, "w-44 font-medium placeholder:text-white/35")}
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-[2.5px] border-[#2c4639] bg-transparent px-3 text-white hover:bg-white/10 dark:bg-transparent"
              onClick={() => {
                const name = newName.trim()
                if (name) {
                  setPlayer(name)
                  setNewName("")
                }
              }}
            >
              Load
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              className="h-10 rounded-xl border-[2.5px] border-[#0b1a14] bg-[#9cff5a] px-4 font-bold text-[#0b1a14] shadow-[0_4px_0_#3d7a19] hover:bg-[#b4ff80]"
              onClick={playAs}
            >
              Play as {player} <ExternalLink className="size-4" />
            </Button>
            <span className="text-xs text-white/55">opens the game in a new tab</span>
          </div>
          <div className="mt-4 grid gap-2">
            <Consent
              checked={form?.perceptronConsent ?? false}
              onChange={(checked) => update({ perceptronConsent: checked })}
              label="Perceptron double-check"
              body="Send leg-only frames (knees down, no face) for a second opinion on steps."
            />
            <Consent
              checked={form?.aiReviewConsent ?? false}
              onChange={(checked) => update({ aiReviewConsent: checked })}
              label="AI gait review"
              body="Send the side camera's numbers (no video) to Gemini. Without it the review uses fixed rules on this computer."
            />
          </div>
        </div>

        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#ffb21e]">LIMITS · THE COACH ADAPTS ONLY INSIDE THESE</p>
          <div className="mt-2 grid gap-2">
            {FIELDS.map((field) => (
              <label key={field.key} className="flex items-center justify-between gap-3 text-sm text-white/75">
                <span>{field.label}</span>
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={form?.[field.key] ?? ""}
                  onChange={(event) => update({ [field.key]: event.target.value } as Partial<Form>)}
                  className={INPUT}
                  disabled={!form}
                />
              </label>
            ))}
            <Range label="Lift range, cm" lo={form?.liftMin ?? ""} hi={form?.liftMax ?? ""} step={0.5} onLo={(v) => update({ liftMin: v })} onHi={(v) => update({ liftMax: v })} disabled={!form} />
            <Range label="Spacing range, cm" lo={form?.spacingMin ?? ""} hi={form?.spacingMax ?? ""} onLo={(v) => update({ spacingMin: v })} onHi={(v) => update({ spacingMax: v })} disabled={!form} />
          </div>
          {suggested.length && next ? (
            <div className="mt-3 rounded-xl border-2 border-[#a46bff]/60 bg-[#1f1630] p-3">
              <p className="text-[11px] font-bold tracking-[0.16em] text-[#c9a8ff]">MAYA SUGGESTS FOR NEXT TIME</p>
              <p className="mt-1 text-sm leading-5 text-white/85">
                {suggested.map(([key, label, unit]) => `${label} ${next[key]} ${unit}`).join(", ")}
                {next.why ? ` · ${next.why}` : ""}
              </p>
              <button type="button" onClick={applySuggestion} disabled={busy || !form} className="mt-2 text-sm font-semibold text-[#c9a8ff] underline-offset-4 hover:underline disabled:opacity-50">
                Apply and save
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#ff8fbf]">REWARDS · PARENT</p>
          <p className="mt-1 text-xs leading-5 text-white/60">A verified full session unlocks one reward; the AI host picks it and checks out with Visa (sandbox mock until credentials exist).</p>
          <ul className="mt-2 grid gap-1.5">
            {(form?.rewards ?? []).map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-sm">
                <span className="text-white/90">{item.name}</span>
                <span className="flex items-center gap-2 text-white/70">
                  ${item.usd}
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => update({ rewards: (form?.rewards ?? []).filter((_, i) => i !== index) })}
                    className="text-white/50 hover:text-[#ff8fbf]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </li>
            ))}
            {!form?.rewards?.length ? <li className="text-xs text-white/50">No rewards yet.</li> : null}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <input value={reward.name} onChange={(event) => setReward({ ...reward, name: event.target.value })} placeholder="e.g. ice cream" aria-label="Reward" className={cn(INPUT, "w-40 font-medium placeholder:text-white/35")} />
            <input type="number" min={0} max={100} step={0.5} value={reward.usd} onChange={(event) => setReward({ ...reward, usd: event.target.value })} placeholder="5" aria-label="Reward in dollars" className={cn(INPUT, "w-20")} />
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-[2.5px] border-[#2c4639] bg-transparent px-3 text-white hover:bg-white/10 dark:bg-transparent"
              disabled={!form || !reward.name.trim()}
              onClick={() => {
                update({ rewards: [...(form?.rewards ?? []), { name: reward.name.trim(), usd: Number(reward.usd || 0) }] })
                setReward({ name: "", usd: "" })
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="rounded-2xl bg-black/25 p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">NOTES FOR THE COACH</p>
          <textarea
            value={form?.notes ?? ""}
            onChange={(event) => update({ notes: event.target.value })}
            placeholder="e.g. prefers short cues; left side tires first"
            aria-label="Notes for the coach"
            disabled={!form}
            className="mt-2 min-h-24 w-full rounded-xl border-[2.5px] border-[#2c4639] bg-[#070b10] px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus-visible:border-[#9cff5a]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <motion.button
              type="button"
              whileTap={{ y: 2 }}
              disabled={busy || !form}
              onClick={() => save()}
              className="font-display inline-flex h-11 items-center gap-2 rounded-2xl border-[2.5px] border-[#0b1a14] bg-[#9cff5a] px-5 text-lg tracking-wide text-[#0b1a14] shadow-[0_4px_0_#3d7a19] disabled:opacity-50"
            >
              <Check className="size-5" strokeWidth={3} /> {busy ? "SAVING…" : "SAVE LIMITS, REWARDS AND NOTES"}
            </motion.button>
            <span className="text-sm text-[#2de2c4]" role="status">
              {message || (offline ? "The game server did not answer: the settings load when it is back." : "")}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

function Consent({ checked, onChange, label, body }: { checked: boolean; onChange: (checked: boolean) => void; label: string; body: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/5 p-3">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-4 accent-[#9cff5a]" />
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="block text-xs leading-5 text-white/60">{body}</span>
      </span>
    </label>
  )
}

function Range({ label, lo, hi, step, onLo, onHi, disabled }: { label: string; lo: string; hi: string; step?: number; onLo: (v: string) => void; onHi: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-white/75">
      <span>{label}</span>
      <span className="flex items-center gap-1.5">
        <input type="number" step={step} value={lo} onChange={(event) => onLo(event.target.value)} aria-label={`${label}, from`} className={cn(INPUT, "w-20")} disabled={disabled} />
        <span className="text-white/40">–</span>
        <input type="number" step={step} value={hi} onChange={(event) => onHi(event.target.value)} aria-label={`${label}, to`} className={cn(INPUT, "w-20")} disabled={disabled} />
      </span>
    </div>
  )
}
