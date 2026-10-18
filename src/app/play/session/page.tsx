import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionView } from "@/components/session-view";

export const metadata: Metadata = {
  title: "Walk · Zombie Walk Home",
};

export default function SessionPage() {
  return (
    <Suspense fallback={<div className="px-8 py-10 text-sm text-muted-foreground">Loading the walk…</div>}>
      <SessionView />
    </Suspense>
  );
}
