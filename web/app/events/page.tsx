import { getCategories, getEvents } from "@/lib/api";
import EventsList from "./EventsList";

const BUNTING_COLORS = ["bg-coral", "bg-pink", "bg-teal", "bg-violet", "bg-sky", "bg-amber"];

function BuntingDivider() {
  return (
    <div className="mb-8 flex h-1.5 overflow-hidden rounded-full">
      {BUNTING_COLORS.map((color) => (
        <div key={color} className={`h-full flex-1 ${color}`} />
      ))}
    </div>
  );
}

export default async function EventsPage() {
  let events, categories;
  try {
    [events, categories] = await Promise.all([getEvents(), getCategories()]);
  } catch {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-3xl border-[3px] border-amber bg-white p-8 text-center font-heading text-lg text-red-600">
          Couldn&apos;t load events right now. Please try again shortly.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 font-heading text-4xl font-bold text-ink">
          Upcoming <span className="text-pink">Events</span>
        </h1>
        <p className="mb-4 text-slate-600">Find something happening near you.</p>
        <BuntingDivider />
        {events.length === 0 ? (
          <p className="rounded-3xl border-[3px] border-dashed border-amber bg-white/60 p-10 text-center font-heading text-lg text-ink/70">
            No events are published yet. Check back soon!
          </p>
        ) : (
          <EventsList events={events} categories={categories} />
        )}
      </div>
    </main>
  );
}
