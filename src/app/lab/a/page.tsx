import type { Metadata } from "next"
import { VariantA } from "@/components/lab/variant-a"

export const metadata: Metadata = { title: "Variant A · Zombie Walk Home" }

export default function Page() {
  return <VariantA />
}
