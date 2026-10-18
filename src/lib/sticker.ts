import { cn } from "cn"

export type StickerTone = "lime" | "amber" | "violet" | "teal" | "rose" | "ink"

const TONES: Record<StickerTone, string> = {
  lime: "bg-[#12261a] border-[#9cff5a] shadow-[5px_5px_0_#4f8f22]",
  amber: "bg-[#2a1f0e] border-[#ffb21e] shadow-[5px_5px_0_#a8690b]",
  violet: "bg-[#1f1630] border-[#a46bff] shadow-[5px_5px_0_#5b3a99]",
  teal: "bg-[#0e2529] border-[#2de2c4] shadow-[5px_5px_0_#17806f]",
  rose: "bg-[#2a1220] border-[#ff3d8b] shadow-[5px_5px_0_#9c2457]",
  ink: "bg-[#0d171c] border-[#2c4639] shadow-[5px_5px_0_#050809]",
}

/** Night sticker card: dark tint, chunky outline, neon offset shadow. */
export function sticker(tone: StickerTone = "ink", className?: string) {
  return cn("rounded-[26px] border-[2.5px]", TONES[tone], className)
}

/** Chunky game button: dark outline, solid drop that presses down. */
export const GAME_BUTTON =
  "font-display inline-flex h-12 items-center gap-2 rounded-2xl border-[2.5px] border-[#0b1a14] bg-[#9cff5a] px-6 text-xl tracking-wide text-[#0b1a14] shadow-[0_5px_0_#3d7a19] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#3d7a19]"

export const ZOMBIE = {
  portrait: "/zombie/portrait.webp",
  idle: "/zombie/idle.webp",
  walk: "/zombie/walk.webp",
  cheer: "/zombie/cheer.webp",
}

export const MAYA_AVATAR = "/images/maya-cartoon.webp"
