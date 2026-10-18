"use client"

import { Bob } from "@/components/motion"
import { MayaChat } from "@/components/maya-chat"
import { TherapistSettings } from "@/components/therapist-settings"
import { BlurFade } from "@/components/ui/blur-fade"
import { NumberTicker } from "@/components/ui/number-ticker"
import { DemoTag } from "@/components/walk-bits"
import { useMounted } from "@/lib/game"
import { useGame } from "@/lib/game-data"
import { MAYA_AVATAR, sticker } from "@/lib/sticker"
import { mayaLine, whenLabel, workOn } from "@/lib/walks"

export function TherapistView() {
  const { latest, demo, player } = useGame()
  const mounted = useMounted()
  const now = new Date()
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
        <MayaChat player={player} sessionId={latest && !latest.demo && latest.openable ? latest.id : null} opening={mayaLine(latest) ?? "Finish a walk and I will have a note waiting. Ask me anything about how you walk."} />

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
