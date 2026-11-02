import { getCategories, getEvents } from "@/lib/api";
import EventsList from "./EventsList";

export default async function EventsPage() {
  let events, categories;
  try {
    [events, categories] = await Promise.all([getEvents(), getCategories()]);
  } catch {
    return (
      <main className="min-h-screen bg-background px-6 py-12">
        <p className="mx-auto max-w-3xl rounded-radius-md bg-error-container p-8 text-center text-title-medium text-on-error-container">
          Couldn&apos;t load events right now. Please try again shortly.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 font-heading text-display-small text-on-background">
          Upcoming <span className="text-primary">Events</span>
        </h1>
        <p className="mb-4 text-body-large text-on-surface-variant">Find something happening near you.</p>
        <hr className="mb-8 border-outline-variant" />
        {events.length === 0 ? (
          <p className="rounded-radius-md bg-surface-container-low p-space-32 text-center text-title-medium text-on-surface-variant">
            No events are published yet. Check back soon!
          </p>
        ) : (
          <EventsList events={events} categories={categories} />
        )}
      </div>
    </main>
  );
}
