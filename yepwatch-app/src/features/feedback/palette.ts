export type Feedback =
  | "join"
  | "leave"
  | "decided"
  | "swipe"
  | "poster"
  | "start"
  | "matches"
  | "lens";
export const palette = {
  join: ["pluck-002"],
  leave: ["pluck-001"],
  decided: ["success-chime"],
  swipe: ["card-shove-1", "card-shove-2", "card-shove-3"],
  poster: [
    "card-slide-1",
    "card-slide-2",
    "card-slide-3",
    "card-slide-4",
    "card-slide-5",
    "card-slide-6",
    "card-slide-7",
    "card-slide-8",
  ],
  start: ["card-fan-1", "card-fan-2"],
  matches: ["card-fan-1", "card-fan-2"],
  lens: ["click-001", "click-002", "click-003"],
} as const;
export function pickSound(
  event: Feedback,
  previous?: string,
  random = Math.random
) {
  const all: readonly string[] = palette[event];
  const candidates = all.filter((name) => name !== previous);
  const pool = candidates.length ? candidates : all;
  return pool[Math.floor(random() * pool.length)];
}
export function volume(name: string) {
  return name === "success-chime"
    ? 0.14
    : name.startsWith("pluck")
    ? 0.23
    : name.startsWith("click")
    ? 0.15
    : 0.2;
}
