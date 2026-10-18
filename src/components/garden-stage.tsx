import Image from "next/image"

const ART = "/art"

type Sprite = {
  src: string
  width: number
  height: number
  className: string
}

const SKY: Sprite[] = [
  { src: "tree-teal.png", width: 256, height: 256, className: "left-[2%] top-[8%] w-[30%] max-w-[150px]" },
  { src: "tree-lime.png", width: 256, height: 256, className: "right-[6%] top-[4%] w-[28%] max-w-[140px]" },
  { src: "moon.png", width: 256, height: 256, className: "right-[28%] top-[2%] w-[22%] max-w-[104px]" },
  { src: "house.png", width: 520, height: 392, className: "right-[1%] bottom-[24%] w-[42%] max-w-[200px]" },
]

const CAST: Sprite[] = [
  { src: "flower-marigold.png", width: 256, height: 256, className: "bottom-[14%] left-[18%] w-[24%] max-w-[118px]" },
  { src: "flower-bell.png", width: 256, height: 256, className: "bottom-[18%] left-[40%] w-[20%] max-w-[100px]" },
  { src: "fence.png", width: 286, height: 160, className: "bottom-[30%] left-[34%] z-[15] w-[30%] max-w-[140px]" },
  { src: "pod.png", width: 256, height: 256, className: "bottom-[34%] right-[26%] w-[17%] max-w-[84px]" },
  { src: "flower-rose.png", width: 256, height: 256, className: "bottom-[12%] right-[4%] w-[22%] max-w-[112px]" },
  { src: "seed.png", width: 128, height: 128, className: "bottom-[42%] right-[8%] w-[9%] max-w-[42px]" },
  { src: "gus-idle.png", width: 289, height: 384, className: "bottom-[6%] left-[-2%] w-[40%] max-w-[196px]" },
]

function SpriteImage({ src, width, height, className }: Sprite) {
  return (
    <Image
      src={`${ART}/${src}`}
      alt=""
      width={width}
      height={height}
      className={`absolute h-auto select-none ${className}`}
    />
  )
}

export function GardenStage() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_18%,rgba(45,226,196,0.22),transparent_42%),radial-gradient(ellipse_at_18%_78%,rgba(156,255,90,0.14),transparent_46%),radial-gradient(ellipse_at_88%_70%,rgba(164,107,255,0.16),transparent_40%)]" />
      {SKY.map((sprite) => (
        <SpriteImage key={sprite.src} {...sprite} />
      ))}
      <div className="absolute inset-x-0 bottom-0 z-10 grid h-[38%] grid-cols-8 grid-rows-2">
        {Array.from({ length: 16 }, (_, index) => {
          const light = (Math.floor(index / 8) + (index % 8)) % 2 === 0
          return (
            <div
              key={index}
              className="bg-cover bg-center"
              style={{
                backgroundImage: `url(${ART}/${light ? "tile-grass-light.png" : "tile-grass-dark.png"})`,
              }}
            />
          )
        })}
      </div>
      <div className="absolute inset-x-0 bottom-[38%] z-10 h-8 bg-gradient-to-b from-transparent to-[#14240f]/40" />
      {CAST.map((sprite) => (
        <SpriteImage key={sprite.src} {...sprite} className={sprite.className.includes("z-") ? sprite.className : `z-20 ${sprite.className}`} />
      ))}
    </div>
  )
}
