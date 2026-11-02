import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEventTickets } from "@/lib/api";
import { getSessionUser } from "@/lib/session";
import PurchaseTickets from "./PurchaseTickets";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const eventId = Number(params.id);
  if (!Number.isInteger(eventId) || eventId < 1) {
    notFound();
  }

  const event = await getEvent(eventId);
  if (!event) {
    notFound();
  }

  const [tickets, user] = await Promise.all([getEventTickets(eventId), getSessionUser()]);
  const activeTickets = tickets.filter((t) => t.status !== "Refunded");
  const prices = activeTickets.map((t) => Number(t.price)).filter((p) => !Number.isNaN(p));
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const spotsTaken = activeTickets.length;
  const remaining = Math.max(0, event.capacity - spotsTaken);
  const soldOut = remaining <= 0;

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/events" className="mb-6 inline-block text-label-large text-primary">
          ← Back to events
        </Link>
        <hr className="mb-8 border-outline-variant" />

        <div className="flex flex-wrap items-center gap-2">
          {event.categories.map((category) => (
            <span
              key={category.category_id}
              className="rounded-radius-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
            >
              {category.name}
            </span>
          ))}
          {event.status !== "Published" && (
            <span className="rounded-radius-full bg-surface-variant px-3 py-1 text-label-medium text-on-surface-variant">
              {event.status}
            </span>
          )}
        </div>

        <h1 className="mb-6 mt-3 font-heading text-headline-large text-on-background">{event.title}</h1>

        <div className="mb-6 flex flex-col gap-2 rounded-radius-md bg-surface-container p-space-16">
          <p className="text-title-medium text-on-surface">{formatDateTime(event.start_time)}</p>
          <p className="text-body-medium text-on-surface-variant">
            {event.venue.name}
            {event.venue.address ? `, ${event.venue.address}` : ""}
            {event.venue.city ? `, ${event.venue.city}` : ""}
          </p>
        </div>

        {event.description && (
          <p className="mb-6 whitespace-pre-line text-body-large text-on-surface">
            {event.description}
          </p>
        )}

        <div className="rounded-radius-lg bg-surface-container-high p-space-24">
          <h2 className="mb-2 font-heading text-title-large text-on-surface">Tickets</h2>
          {minPrice === null ? (
            <p className="text-body-medium text-on-surface-variant">No tickets available yet.</p>
          ) : (
            <p className="text-body-medium text-on-surface-variant">
              {minPrice === maxPrice
                ? `$${minPrice.toFixed(2)} per ticket`
                : `$${minPrice.toFixed(2)}–$${maxPrice!.toFixed(2)} per ticket`}
            </p>
          )}
          <p className={`mt-1 text-title-small ${soldOut ? "text-error" : "text-on-surface"}`}>
            {soldOut ? "Sold out" : `${spotsTaken} of ${event.capacity} spots taken`}
          </p>
          {event.status === "Published" && (
            <PurchaseTickets
              eventId={event.event_id}
              remaining={remaining}
              pricePerTicket={minPrice}
              isLoggedIn={!!user}
            />
          )}
        </div>
      </div>
    </main>
  );
}
