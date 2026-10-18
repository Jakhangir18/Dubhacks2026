import type { Metadata } from "next";
import { TherapistView } from "@/components/therapist-view";

export const metadata: Metadata = {
  title: "AI therapist · Stride Defense",
};

export default function TherapistPage() {
  return <TherapistView />;
}
