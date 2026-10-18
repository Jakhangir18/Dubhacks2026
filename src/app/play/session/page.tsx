import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionView } from "@/components/session-view";

export const metadata: Metadata = {
  title: "Session · StrideBloom",
};

export default function SessionPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0e2419]" />}>
      <SessionView />
    </Suspense>
  );
}
