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
      <DialogContent className="sm:max-w-lg">
        {sent ? (
          <div className="pr-6">
            <DialogHeader>
              <DialogTitle>The care team has your note.</DialogTitle>
              <DialogDescription>
                {topic === "Something hurts"
                  ? "Pause practice until someone replies. If this is urgent, contact your clinician directly rather than waiting on this form."
                  : "A clinician replies within one business day. Your walking history stays attached to the note."}
              </DialogDescription>
            </DialogHeader>
            <Button type="button" className="mt-5 h-10 rounded-full px-4" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4 pr-2">
            <DialogHeader>
              <DialogTitle>Contact the care team</DialogTitle>
              <DialogDescription>
                Form questions, pain, the kit, or scheduling. Maya can talk about walking scores. People answer this.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="care-topic">Topic</Label>
              <select
                id="care-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="h-10 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
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
                className="min-h-28 bg-white"
                aria-invalid={Boolean(errors.message)}
              />
              {errors.message ? <p className="text-sm text-destructive">{errors.message}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="care-contact">How should they reach you?</Label>
              <Input
                id="care-contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="Email or phone"
                className="h-10 bg-white"
                aria-invalid={Boolean(errors.contact)}
              />
              {errors.contact ? <p className="text-sm text-destructive">{errors.contact}</p> : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="h-10 rounded-full px-4" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-10 rounded-full bg-orange px-4 text-white hover:bg-[#d9772b]">
                Send note
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
