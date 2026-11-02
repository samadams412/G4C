import Link from "next/link";
import type { EventSummary } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function EventCard({ event }: { event: EventSummary }) {
  return (
    <Link href={`/events/${event.event_id}`}>
      <article className="flex flex-col gap-3 rounded-3xl bg-surface-container p-5 transition-transform hover:-translate-y-1">
        <div className="flex flex-wrap gap-2">
          {event.categories.map((category) => (
            <span
              key={category.category_id}
              className="rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container"
            >
              {category.name}
            </span>
          ))}
        </div>
        <h2 className="font-heading text-xl font-semibold text-ink">{event.title}</h2>
        {event.description && (
          <p className="line-clamp-2 text-sm text-slate-600">{event.description}</p>
        )}
        <p className="font-heading text-sm font-medium text-sky">{formatDate(event.start_time)}</p>
      </article>
    </Link>
  );
}
