import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">OFF THE PATH</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">That page is not on the walk home.</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The dashboard is the overview, the live walk, the sessions, and Maya.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center rounded-full bg-forest px-5 text-sm font-semibold text-[#0b1a14]"
      >
        Back to overview
      </Link>
    </div>
  );
}
