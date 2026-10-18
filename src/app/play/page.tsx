import type { Metadata } from "next";
import { LiveView } from "@/components/live-view";

export const metadata: Metadata = {
  title: "Live walk · Zombie Walk Home",
};

export default function PlayPage() {
  return <LiveView />;
}
