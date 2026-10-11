"use client";

import { useMemo, useState } from "react";
import type { Category, EventSummary } from "@/lib/api";
import EventCard from "./EventCard";

export default function EventsList({
  events,
  categories,
}: {
  events: EventSummary[];
  categories: Category[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const filteredEvents = useMemo(() => {
    if (selectedCategory === null) return events;
    return events.filter((event) =>
      event.categories.some((category) => category.category_id === selectedCategory)
    );
  }, [events, selectedCategory]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            selectedCategory === null
              ? "bg-violet text-white"
              : "bg-white text-ink hover:bg-violet/10"
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.category_id}
            onClick={() => setSelectedCategory(category.category_id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              selectedCategory === category.category_id
                ? "bg-violet text-white"
                : "bg-white text-ink hover:bg-violet/10"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="rounded-3xl border-[3px] border-dashed border-amber bg-white/60 p-10 text-center font-heading text-lg text-ink/70">
          No events match this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event, index) => (
            <EventCard key={event.event_id} event={event} accentIndex={index} />
          ))}
        </div>
      )}
    </div>
  );
}
