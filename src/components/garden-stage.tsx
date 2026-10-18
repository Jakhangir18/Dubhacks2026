import { Particles } from "@/components/ui/particles"

/** Night-garden backdrop behind the form round: the hero still plus drifting fireflies. */
export function GardenStage() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/hero-night-z.webp" alt="" className="size-full object-cover object-[70%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,11,16,0.85),rgba(7,11,16,0.35)_60%,transparent)]" />
      <Particles className="absolute inset-0" quantity={40} staticity={30} size={1} color="#ffd76a" />
    </div>
  )
}
