import Image from "next/image"
import type { ReactNode } from "react"
import { cn } from "cn"

type Piece = {
  src: string
  width: number
  height: number
  className: string
}

const SCENES: Record<number, { pieces: Piece[]; alt: string }> = {
  1: {
    alt: "A seed on the night lawn under the moon",
    pieces: [
      { src: "/art/moon.png", width: 256, height: 256, className: "right-[6%] top-[4%] w-[36%]" },
      { src: "/art/seed.png", width: 128, height: 128, className: "bottom-[16%] left-1/2 w-[30%] -translate-x-1/2" },
    ],
  },
  2: {
    alt: "Marmalade the marigold on the night lawn",
    pieces: [
      { src: "/art/flower-marigold.png", width: 256, height: 256, className: "bottom-[6%] left-1/2 w-[62%] -translate-x-1/2" },
    ],
  },
  3: {
    alt: "Two footsteps on the night lawn",
    pieces: [
      { src: "/art/foot-l.png", width: 256, height: 256, className: "bottom-[10%] left-[8%] w-[38%]" },
      { src: "/art/foot-r.png", width: 256, height: 256, className: "bottom-[18%] right-[6%] w-[38%]" },
    ],
  },
  4: {
    alt: "Ding-Dong the bell flower on the night lawn",
    pieces: [
      { src: "/art/flower-bell.png", width: 256, height: 256, className: "bottom-[4%] left-1/2 w-[58%] -translate-x-1/2" },
    ],
  },
  5: {
    alt: "The cottage on the night lawn",
    pieces: [
      { src: "/art/tree-lime.png", width: 256, height: 256, className: "left-[-4%] top-[2%] w-[36%]" },
      { src: "/art/house.png", width: 520, height: 392, className: "bottom-[8%] right-[2%] w-[70%]" },
    ],
  },
  6: {
    alt: "A fence and a narrow pair of steps on the night lawn",
    pieces: [
      { src: "/art/fence.png", width: 286, height: 160, className: "bottom-[34%] left-1/2 w-[72%] -translate-x-1/2" },
      { src: "/art/foot-l.png", width: 256, height: 256, className: "bottom-[4%] left-[18%] w-[30%]" },
      { src: "/art/foot-r.png", width: 256, height: 256, className: "bottom-[4%] right-[16%] w-[30%]" },
    ],
  },
  7: {
    alt: "Pip the seed pod on the night lawn",
    pieces: [
      { src: "/art/pod.png", width: 256, height: 256, className: "bottom-[8%] left-1/2 w-[52%] -translate-x-1/2" },
    ],
  },
  8: {
    alt: "Gus the zombie waving on the night lawn",
    pieces: [
      { src: "/zombie/idle.webp", width: 478, height: 640, className: "bottom-0 left-1/2 w-[52%] -translate-x-1/2" },
    ],
  },
  9: {
    alt: "The sleepy moon over the night lawn",
    pieces: [
      { src: "/art/moon.png", width: 256, height: 256, className: "left-1/2 top-[2%] w-[52%] -translate-x-1/2" },
      { src: "/art/tree-teal.png", width: 256, height: 256, className: "bottom-[18%] left-[-6%] w-[40%]" },
    ],
  },
  10: {
    alt: "Rosie the rose on the night lawn",
    pieces: [
      { src: "/art/tree-teal.png", width: 256, height: 256, className: "right-[-4%] top-[-4%] w-[40%]" },
      { src: "/art/flower-rose.png", width: 256, height: 256, className: "bottom-[4%] left-1/2 w-[58%] -translate-x-1/2" },
    ],
  },
}

export function GoalBanner({
  levelId,
  locked,
  className,
  children,
}: {
  levelId: number
  locked?: boolean
  className?: string
  children: ReactNode
}) {
  const scene = SCENES[levelId] ?? SCENES[1]
  return (
    <div className={cn("relative overflow-hidden border-[2.5px] border-[#2c4639] bg-[#0d171c]", className)}>
      <div
        className={cn("absolute inset-y-0 left-0 w-[46%] overflow-hidden bg-[#070b10]", locked && "opacity-50 saturate-[0.65]")}
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_16%,rgba(45,226,196,0.24),transparent_46%),radial-gradient(ellipse_at_18%_82%,rgba(156,255,90,0.14),transparent_48%)]" />
        <div className="absolute inset-x-0 bottom-0 grid h-[40%] grid-cols-4 grid-rows-2">
          {Array.from({ length: 8 }, (_, index) => {
            const light = (Math.floor(index / 4) + (index % 4)) % 2 === 0
            return (
              <div
                key={index}
                className="bg-cover bg-center"
                style={{
                  backgroundImage: `url(/art/${light ? "tile-grass-light.png" : "tile-grass-dark.png"})`,
                }}
              />
            )
          })}
        </div>
        {scene.pieces.map((piece) => (
          <Image
            key={`${piece.src}-${piece.className}`}
            src={piece.src}
            alt=""
            width={piece.width}
            height={piece.height}
            className={cn("absolute h-auto max-w-none select-none", piece.className)}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,transparent_28%,rgba(13,23,28,0.8)_38%,#0d171c_46%)]" />
      <div className="relative z-10 flex h-full items-center">
        <div className="w-1/2 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col justify-center pr-5">{children}</div>
      </div>
      <span className="sr-only">{scene.alt}</span>
    </div>
  )
}
