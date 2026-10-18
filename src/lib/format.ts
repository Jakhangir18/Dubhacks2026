export function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function addDaysUTC(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  )
}

export function startOfWeekUTC(date: Date) {
  const weekday = date.getUTCDay()
  const mondayOffset = weekday === 0 ? 6 : weekday - 1
  return addDaysUTC(date, -mondayOffset)
}

export function formatHeading(date: Date) {
  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  })
  const month = date.toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  })
  return `${weekday}, ${month} ${date.getUTCDate()}`.toUpperCase()
}

export function greeting(date: Date) {
  const hour = date.getUTCHours()
  if (hour >= 4 && hour < 12) return "Good morning"
  if (hour >= 12 && hour < 17) return "Good afternoon"
  if (hour >= 17 && hour < 22) return "Good evening"
  return "Hello"
}

export function formatWhen(iso: string, now: Date) {
  const key = iso.slice(0, 10)
  if (key === dayKey(now)) return "Today"
  if (key === dayKey(addDaysUTC(now, -1))) return "Yesterday"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  })
}

export function formatLevel(id: number) {
  return String(id).padStart(2, "0")
}

export function formatMinutes(minutes: number) {
  return `${minutes} min`
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
