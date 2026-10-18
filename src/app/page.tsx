import type { Metadata } from "next";
import { OverviewView } from "@/components/overview-view";

export const metadata: Metadata = {
  title: "Overview · Stride Defense",
};

export default function HomePage() {
  return <OverviewView />;
}
