import Link from "next/link";

export default function EventNotFound() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="rounded-radius-md bg-surface-container-low p-space-32 text-title-medium text-on-surface-variant">
          We couldn&apos;t find that event. It may have been removed or the link is wrong.
        </p>
        <Link href="/events" className="mt-6 inline-block text-label-large text-primary">
          ← Back to events
        </Link>
      </div>
    </main>
  );
}
