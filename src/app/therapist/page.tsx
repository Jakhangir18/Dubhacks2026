import type { Metadata } from "next";
import { TherapistView } from "@/components/therapist-view";

export const metadata: Metadata = {
  title: "AI therapist · StrideBloom",
};

export default function TherapistPage() {
  return <TherapistView />;
}
