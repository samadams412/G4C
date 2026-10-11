import Link from "next/link";
import { notFound } from "next/navigation";
import { getEvent, getEventTickets } from "@/lib/api";
import { badgeColorFor, cardAccentForId } from "@/lib/colors";
import { getSessionUser } from "@/lib/session";
import PurchaseTickets from "./PurchaseTickets";

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

  const cardAccent = cardAccentForId(event.event_id);

  return (
    <main className="min-h-screen bg-cream px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/events" className="mb-6 inline-block font-heading text-sm font-bold text-violet">
          ← Back to events
        </Link>
        <BuntingDivider />

        <div className="flex flex-wrap items-center gap-2">
          {event.categories.map((category) => (
            <span
              key={category.category_id}
              className={`rounded-full px-3 py-1 text-xs font-bold ${badgeColorFor(category.name)}`}
            >
              {category.name}
            </span>
          ))}
          {event.status !== "Published" && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {event.status}
            </span>
          )}
        </div>

        <h1 className="mb-6 mt-3 font-heading text-4xl font-bold text-ink">{event.title}</h1>

        <div className={`mb-6 flex flex-col gap-2 rounded-3xl border-[3px] bg-white p-5 ${cardAccent}`}>
          <p className="font-heading text-sm font-medium text-sky">{formatDateTime(event.start_time)}</p>
          <p className="text-sm text-slate-600">
            {event.venue.name}
            {event.venue.address ? `, ${event.venue.address}` : ""}
            {event.venue.city ? `, ${event.venue.city}` : ""}
          </p>
        </div>

        {event.description && (
          <p className="mb-6 whitespace-pre-line text-base leading-relaxed text-slate-700">
            {event.description}
          </p>
        )}

        <div className="rounded-3xl border-[3px] border-teal/30 bg-white p-5">
          <h2 className="mb-2 font-heading text-lg font-bold text-ink">Tickets</h2>
          {minPrice === null ? (
            <p className="text-sm text-slate-600">No tickets available yet.</p>
          ) : (
            <p className="text-sm text-slate-600">
              {minPrice === maxPrice
                ? `$${minPrice.toFixed(2)} per ticket`
                : `$${minPrice.toFixed(2)}–$${maxPrice!.toFixed(2)} per ticket`}
            </p>
          )}
          <p className="mt-1 text-sm font-medium text-ink">
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
