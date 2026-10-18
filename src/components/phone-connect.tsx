"use client"

/** Connect the phone, then check that it really works: the first thing on the Live walk page while the side
 * camera is not live. Step 1 shows the QR code and the link to the phone page; step 2 watches the pictures
 * arrive and the skeleton find the whole body. */

import { useMemo, useState, type ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, ChevronDown, Circle, Smartphone } from "lucide-react"
import { api, useMounted, type Pose } from "@/lib/game"
import { bodyCheck } from "@/lib/live"
import { gameOrigin, isLocalHost } from "@/lib/paths"
import { sticker } from "@/lib/sticker"
import { cn } from "cn"

export type PhoneConnectProps = {
  sideLive: boolean
  rate: number | null
  rateIsPreview: boolean
  pose: Pose | null
  /** The server has answered at least once (so "waiting" means the phone, not the page). */
  polled: boolean
}

/** The phone page's address, known once the page runs in the browser (the static HTML has no origin). */
export function usePhoneLink() {
  const mounted = useMounted()
  return useMemo(() => {
    const origin = mounted ? gameOrigin() : ""
    if (!origin) return null
    const url = `${origin}/phone.html`
    let host = url.replace(/^https?:\/\//, "")
    let localOnly = false
    try {
      const parsed = new URL(url)
      localOnly = isLocalHost(parsed.hostname)
      host = `${parsed.host}${parsed.pathname}`
    } catch {
      /* keep the raw text */
    }
    return { url, host, localOnly }
  }, [mounted])
}

export function PhoneConnect({ sideLive, rate, rateIsPreview, pose, polled }: PhoneConnectProps) {
  const link = usePhoneLink()
  const body = bodyCheck(sideLive ? pose : null)
  const ready = sideLive && body.ok
  const [showSetup, setShowSetup] = useState(false)
  const rateText = rate !== null && sideLive ? `${rate.toFixed(1)} pictures a second${rateIsPreview ? " (preview)" : ""}` : null

  return (
    <AnimatePresence initial={false} mode="wait">
      {ready && !showSetup ? (
        <motion.div
          key="ready"
          className={sticker("lime", "flex flex-wrap items-center gap-3 px-5 py-3")}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          role="status"
        >
          <span className="grid size-9 place-items-center rounded-full border-2 border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl tracking-wide text-[#9cff5a]">PHONE READY</p>
            <p className="text-sm text-white/70">
              {rateText ?? "Pictures arriving"} · whole body in view
            </p>
          </div>
          <button type="button" onClick={() => setShowSetup(true)} className="text-sm font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">
            Show the setup
          </button>
        </motion.div>
      ) : (
        <motion.section
          key="setup"
          className={sticker("teal", "relative overflow-hidden p-5 sm:p-6")}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          aria-label="Connect the phone"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#2de2c4]">BEFORE THE WALK</p>
              <h2 className="font-display text-outline mt-1 text-3xl tracking-wide text-[#ffd76a] sm:text-4xl">CONNECT THE PHONE</h2>
              <p className="mt-1 max-w-xl text-[15px] leading-6 text-white/75">
                The phone is the side camera: it draws your legs, measures each knee and keeps the moments worth a look.
              </p>
            </div>
            {ready ? (
              <button type="button" onClick={() => setShowSetup(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-[#9cff5a] hover:underline">
                Hide <ChevronDown className="size-4 rotate-180" />
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Step number={1} title="Open this on the phone" done={sideLive}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid size-44 shrink-0 place-items-center rounded-2xl border-[2.5px] border-[#0b1a14] bg-white p-2 shadow-[4px_4px_0_#17806f]">
                  {link ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={api.qrUrl(link.url)} alt={`QR code for ${link.url}`} className="size-full" />
                  ) : (
                    <Smartphone className="size-10 text-[#0b1a14]/40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.16em] text-[#2de2c4]">OR TYPE THE LINK</p>
                  <p className="font-display mt-1 text-xl leading-tight text-white [overflow-wrap:anywhere] sm:text-[1.7rem]">{link?.host ?? "…/phone.html"}</p>
                  {link?.localOnly ? (
                    <p className="mt-2 rounded-xl border-2 border-[#ffb21e]/60 bg-[#2a1f0e] px-3 py-2 text-xs leading-5 text-[#ffd76a]">
                      This page is open as {link.host.split("/")[0]}: a phone cannot reach that. Open the dashboard by the computer&apos;s network address and use that link.
                    </p>
                  ) : null}
                  <ul className="mt-3 grid gap-1 text-sm leading-5 text-white/75">
                    <li>Phone in landscape, on a stand at the side of the pad.</li>
                    <li>About knee height, the whole body in view.</li>
                    <li>Tap <span className="font-semibold text-white">Start the camera</span> and keep the page open.</li>
                  </ul>
                </div>
              </div>
            </Step>

            <Step number={2} title="Check that it works" done={ready}>
              <ul className="grid gap-2.5">
                <CheckRow
                  ok={sideLive}
                  pending={!polled}
                  label="Pictures arriving"
                  detail={sideLive ? rateText ?? "Live" : polled ? "Waiting for the phone's pictures" : "Asking the server"}
                />
                <CheckRow
                  ok={body.ok}
                  pending={!sideLive}
                  label="Whole body in view"
                  detail={sideLive ? body.advice : "Waits for the pictures"}
                >
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {body.parts.map((part) => (
                      <li
                        key={part.name}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[11px] font-bold tracking-[0.08em]",
                          part.seen ? "border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]" : "border-white/15 bg-black/30 text-white/55",
                        )}
                      >
                        {part.seen ? <Check className="size-3" strokeWidth={3} /> : <Circle className="size-2.5" />}
                        {part.name.toUpperCase()}
                      </li>
                    ))}
                  </ul>
                </CheckRow>
              </ul>
            </Step>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function Step({ number, title, done, children }: { number: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <div className="rounded-[22px] border-[2.5px] border-[#0b1a14] bg-[#070b10]/60 p-4 sm:p-5">
      <p className="flex items-center gap-2.5">
        <span className={cn("grid size-8 place-items-center rounded-full border-2 border-[#0b1a14] text-sm font-bold", done ? "bg-[#9cff5a] text-[#0b1a14]" : "bg-[#ffb21e] text-[#0b1a14]")}>
          {done ? <Check className="size-4" strokeWidth={3} /> : number}
        </span>
        <span className="font-display text-xl tracking-wide text-white">
          STEP {number} · {title.toUpperCase()}
        </span>
      </p>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function CheckRow({ ok, pending, label, detail, children }: { ok: boolean; pending: boolean; label: string; detail: string; children?: ReactNode }) {
  return (
    <li className={cn("rounded-2xl border-2 p-3", ok ? "border-[#9cff5a]/60 bg-[#12261a]" : "border-white/10 bg-black/25")}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border-2", ok ? "border-[#0b1a14] bg-[#9cff5a] text-[#0b1a14]" : "border-white/20 text-white/50")}>
          {ok ? (
            <Check className="size-4" strokeWidth={3} />
          ) : (
            <motion.span
              className={cn("size-2.5 rounded-full", pending ? "bg-white/30" : "bg-[#ffb21e]")}
              animate={pending ? undefined : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{label}</p>
          <p className={cn("text-sm leading-5", ok ? "text-[#9cff5a]" : "text-white/65")} aria-live="polite">
            {detail}
          </p>
        </div>
      </div>
      {children}
    </li>
  )
}
