import { ZOMBIE } from "@/lib/sticker"
import { cn } from "cn"

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-11 place-items-center overflow-hidden rounded-2xl border-[2.5px] border-[#9cff5a] bg-[#12261a] shadow-[3px_3px_0_#4f8f22] transition hover:-rotate-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ZOMBIE.portrait} alt="" className="size-9 object-contain" />
      </span>
      <span className="font-display text-outline text-[22px] leading-none tracking-wide text-[#ffd76a] sm:text-[24px]">
        ZOMBIE WALK <span className="text-[#9cff5a]">HOME</span>
      </span>
    </span>
  )
}
