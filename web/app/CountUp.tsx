"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

export default function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!inView || !el) return;
    if (reduceMotion) {
      el.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1,
      ease: "easeOut",
      onUpdate: (v) => (el.textContent = String(Math.round(v))),
    });
    return () => controls.stop();
  }, [inView, reduceMotion, value]);

  // The visible digits start at 0 and count up client-side; screen readers get the real value
  // even if the stats never scroll into view.
  return (
    <>
      <span ref={ref} aria-hidden="true">
        0
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
