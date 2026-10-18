import type { Metadata } from "next";
import { ProgressView } from "@/components/progress-view";

export const metadata: Metadata = {
  title: "My progress · Stride Defense",
};

export default function ProgressPage() {
  return <ProgressView />;
}
