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
      <article className="flex flex-col gap-3 rounded-radius-md bg-surface-container p-space-16 transition-transform hover:-translate-y-1">
        <div className="flex flex-wrap gap-2">
          {event.categories.map((category) => (
            <span
              key={category.category_id}
              className="rounded-radius-full bg-secondary-container px-3 py-1 text-label-medium text-on-secondary-container"
            >
              {category.name}
            </span>
          ))}
        </div>
        <h2 className="font-heading text-title-large text-on-surface">{event.title}</h2>
        {event.description && (
          <p className="line-clamp-2 text-body-medium text-on-surface-variant">{event.description}</p>
        )}
        <p className="text-label-large text-primary">{formatDate(event.start_time)}</p>
      </article>
    </Link>
  );
}
