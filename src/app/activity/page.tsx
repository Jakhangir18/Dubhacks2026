import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityView } from "@/components/activity-view";

export const metadata: Metadata = {
  title: "Sessions · StrideBloom",
};

export default function ActivityPage() {
  return (
    <Suspense fallback={<div className="px-8 py-10 text-sm text-muted-foreground">Loading sessions…</div>}>
      <ActivityView />
    </Suspense>
  );
}
