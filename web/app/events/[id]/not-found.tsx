import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="rounded-3xl border-[3px] border-dashed border-amber bg-white/60 p-10 font-heading text-lg text-ink/70">
          We couldn&apos;t find that event. It may have been removed or the link is wrong.
        </p>
        <Link href="/events" className="mt-6 inline-block font-heading text-sm font-bold text-violet">
          ← Back to events
        </Link>
      </div>
    </main>
  );
}
