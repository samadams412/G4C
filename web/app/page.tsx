import Link from "next/link";
import { getCategories, getEvents } from "@/lib/api";
import CountUp from "./CountUp";
import HeroShapes from "./HeroShapes";

export default async function Home() {
  let eventCount = 0;
  let categoryCount = 0;
  try {
    const [events, categories] = await Promise.all([getEvents(), getCategories()]);
    eventCount = events.length;
    categoryCount = categories.length;
  } catch {
    // stats are decorative; keep the hero working even if the API is down
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <HeroShapes />
        <div className="relative mx-auto max-w-2xl">
          <h1 className="font-heading text-5xl font-bold text-on-background">
            Find your next <span className="text-primary">favorite</span> event
          </h1>
          <p className="mt-4 text-lg text-on-surface-variant">
            Browse what&apos;s happening near you and grab your tickets in minutes.
          </p>
          <Link
            href="/events"
            className="mt-8 inline-block rounded-full bg-primary px-6 py-3 font-heading text-base font-bold text-on-primary"
          >
            Browse Events
          </Link>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="rounded-3xl bg-surface-container p-8 text-center">
            <p className="font-heading text-4xl font-bold text-primary">
              <CountUp value={eventCount} />
            </p>
            <p className="mt-2 font-heading text-sm font-bold text-on-surface">Events live now</p>
          </div>
          <div className="rounded-3xl bg-surface-container p-8 text-center">
            <p className="font-heading text-4xl font-bold text-primary">
              <CountUp value={categoryCount} />
            </p>
            <p className="mt-2 font-heading text-sm font-bold text-on-surface">Categories to explore</p>
          </div>
        </div>
      </section>
    </main>
  );
}
