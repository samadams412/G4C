"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
  const reduceMotion = useReducedMotion();

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
          className={`rounded-radius-full border px-4 py-2 text-label-large transition-colors ${
            selectedCategory === null
              ? "border-transparent bg-primary-container text-on-primary-container"
              : "border-outline text-on-surface hover:bg-surface-container"
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.category_id}
            onClick={() => setSelectedCategory(category.category_id)}
            className={`rounded-radius-full border px-4 py-2 text-label-large transition-colors ${
              selectedCategory === category.category_id
                ? "border-transparent bg-primary-container text-on-primary-container"
                : "border-outline text-on-surface hover:bg-surface-container"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      {filteredEvents.length === 0 ? (
        <p className="rounded-radius-md bg-surface-container-low p-space-32 text-center text-title-medium text-on-surface-variant">
          No events match this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-space-16 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event, i) => (
            <motion.div
              key={event.event_id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              // Stagger across a row; reduced motion keeps the fade but drops the slide.
              transition={{
                duration: 0.4,
                ease: "easeOut",
                delay: (i % 3) * 0.08,
                y: reduceMotion ? { duration: 0 } : undefined,
              }}
            >
              <EventCard event={event} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
