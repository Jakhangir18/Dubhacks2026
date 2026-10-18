import { cn } from "cn"

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-forest text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path d="M5.5 19.5c6.2-.6 10.2-5.4 12.2-12.8-5.6.7-10.2 4.2-12.2 12.8Z" fill="currentColor" />
          <path d="M8.2 16.8c2-2.6 4-4.6 6.8-6" fill="none" stroke="#14684a" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[17px] font-extrabold tracking-tight text-orange">StrideBloom</span>
    </span>
  )
}
