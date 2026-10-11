export const BADGE_COLORS = [
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
];

export const CARD_ACCENTS = [
  "border-coral/30 shadow-[4px_4px_0_0_rgba(249,115,22,0.18)]",
  "border-pink/30 shadow-[4px_4px_0_0_rgba(236,72,153,0.18)]",
  "border-teal/30 shadow-[4px_4px_0_0_rgba(13,148,136,0.18)]",
  "border-violet/30 shadow-[4px_4px_0_0_rgba(124,58,237,0.18)]",
  "border-sky/30 shadow-[4px_4px_0_0_rgba(37,99,235,0.18)]",
  "border-amber/30 shadow-[4px_4px_0_0_rgba(245,158,11,0.18)]",
];

function hash(value: string) {
  return value.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

export function badgeColorFor(name: string) {
  return BADGE_COLORS[hash(name) % BADGE_COLORS.length];
}

export function cardAccentFor(index: number) {
  return CARD_ACCENTS[index % CARD_ACCENTS.length];
}

export function cardAccentForId(id: number | string) {
  return CARD_ACCENTS[hash(String(id)) % CARD_ACCENTS.length];
}
