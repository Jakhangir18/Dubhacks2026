"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useStride } from "@/lib/store"

const TOPICS = ["Question about my form", "Something hurts", "Movement kit", "Scheduling"]

export function ContactDialog() {
  const { contactOpen, setContactOpen, submitCare } = useStride()
  const [topic, setTopic] = useState(TOPICS[0])
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [errors, setErrors] = useState<{ message?: string; contact?: string }>({})
  const [sent, setSent] = useState(false)

  function close(open: boolean) {
    setContactOpen(open)
    if (!open) {
      window.setTimeout(() => {
        setSent(false)
        setErrors({})
        setMessage("")
        setContact("")
        setTopic(TOPICS[0])
      }, 200)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: { message?: string; contact?: string } = {}
    if (message.trim().length < 12) nextErrors.message = "Add a little more detail, at least a sentence."
    if (contact.trim().length < 5) nextErrors.contact = "Add an email or a phone number."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    submitCare({ topic, message: message.trim(), contact: contact.trim() })
    setSent(true)
    toast.success("Sent to the care team")
  }

  return (
    <Dialog open={contactOpen} onOpenChange={close}>
      <DialogContent className="rounded-[26px] border-[2.5px] border-[#2c4639] shadow-[5px_5px_0_#050809] ring-0 sm:max-w-lg">
        {sent ? (
          <div className="pr-6">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-normal tracking-wide text-[#ffd76a]">The care team has your note.</DialogTitle>
              <DialogDescription className="leading-6 text-white/70">
                {topic === "Something hurts"
                  ? "Pause practice until someone replies. If this is urgent, contact your clinician directly rather than waiting on this form."
                  : "A clinician replies within one business day. Your walking history stays attached to the note."}
              </DialogDescription>
            </DialogHeader>
            <Button
              type="button"
              className="mt-5 h-10 rounded-full border-[2.5px] border-[#0b1a14] bg-[#9cff5a] px-4 font-semibold text-[#0b1a14] shadow-[0_4px_0_#3d7a19] hover:bg-[#b4ff82]"
              onClick={() => close(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4 pr-2">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl font-normal tracking-wide text-[#ffd76a]">Contact the care team</DialogTitle>
              <DialogDescription className="leading-6 text-white/70">
                Form questions, pain, the kit, or scheduling. Maya can talk about walking scores. People answer this.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="care-topic">Topic</Label>
              <select
                id="care-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="h-10 rounded-xl border-[2.5px] border-[#2c4639] bg-[#070b10] px-3 text-sm text-white outline-none [color-scheme:dark] focus-visible:border-[#9cff5a] focus-visible:ring-3 focus-visible:ring-[#9cff5a]/25"
              >
                {TOPICS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="care-message">What should they know?</Label>
              <Textarea
                id="care-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="The left step shortened during Even stride, and the knee felt unstable after."
                className="min-h-28 rounded-xl border-[2.5px] border-[#2c4639] bg-[#070b10] text-white placeholder:text-white/40 focus-visible:border-[#9cff5a] focus-visible:ring-[#9cff5a]/25 dark:bg-[#070b10]"
                aria-invalid={Boolean(errors.message)}
              />
              {errors.message ? <p className="text-sm font-medium text-[#ff8fa0]">{errors.message}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="care-contact">How should they reach you?</Label>
              <Input
                id="care-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Email or phone"
                className="h-10 rounded-xl border-[2.5px] border-[#2c4639] bg-[#070b10] text-white placeholder:text-white/40 focus-visible:border-[#9cff5a] focus-visible:ring-[#9cff5a]/25 dark:bg-[#070b10]"
                aria-invalid={Boolean(errors.contact)}
              />
              {errors.contact ? <p className="text-sm font-medium text-[#ff8fa0]">{errors.contact}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-[2.5px] border-[#2c4639] bg-transparent px-4 text-white hover:bg-white/10 dark:bg-transparent"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-10 rounded-full border-[2.5px] border-[#0b1a14] bg-[#ffb21e] px-4 font-semibold text-[#0b1a14] shadow-[0_4px_0_#a8690b] hover:bg-[#ffc54d]">
                Send note
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
