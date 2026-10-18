import type { Metadata } from "next";
import { PlayView } from "@/components/play-view";

export const metadata: Metadata = {
  title: "Play and practice · StrideBloom",
};

export default function PlayPage() {
  return <PlayView />;
}
