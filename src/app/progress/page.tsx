import type { Metadata } from "next";
import { ProgressView } from "@/components/progress-view";

export const metadata: Metadata = {
  title: "My progress · Zombie Walk Home",
};

export default function ProgressPage() {
  return <ProgressView />;
}
