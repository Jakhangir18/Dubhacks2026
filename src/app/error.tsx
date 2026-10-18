"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-20">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">SOMETHING SLIPPED</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">This screen didn&apos;t load.</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your sessions are still on this device. Try the screen again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}
