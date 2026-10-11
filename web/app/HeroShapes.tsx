"use client";

import { motion, useReducedMotion } from "framer-motion";

const SHAPES = [
  { color: "bg-coral", size: "h-20 w-20", pos: "left-[8%] top-[15%]", duration: 6 },
  { color: "bg-pink", size: "h-14 w-14", pos: "left-[22%] top-[55%]", duration: 7 },
  { color: "bg-teal", size: "h-16 w-16", pos: "right-[18%] top-[20%]", duration: 5.5 },
  { color: "bg-violet", size: "h-24 w-24", pos: "right-[8%] top-[50%]", duration: 8 },
  { color: "bg-sky", size: "h-12 w-12", pos: "left-[45%] top-[10%]", duration: 6.5 },
  { color: "bg-amber", size: "h-16 w-16", pos: "right-[35%] top-[65%]", duration: 7.5 },
];

export default function HeroShapes() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {SHAPES.map((shape, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-[40%] opacity-30 ${shape.color} ${shape.size} ${shape.pos}`}
          animate={
            reduceMotion
              ? undefined
              : { y: [0, -18, 0], rotate: [0, 8, 0] }
          }
          transition={{ duration: shape.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
