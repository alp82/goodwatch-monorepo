/**
 * The answers a Taste card takes and where each sends the card (owner round 4): Loved it flies right, Not for me flies
 * left, Haven't seen (or a next-day "Didn't watch it") drops off the bottom with a quick fade.
 */
export type CardAnswer = 'loved' | 'not_for_me' | 'unseen' | 'did_not_watch';
export type Exit = 'right' | 'left' | 'down';
export const EXIT: Record<CardAnswer, Exit> = { loved: 'right', not_for_me: 'left', unseen: 'down', did_not_watch: 'down' };
export const ANSWER_LABEL: Record<CardAnswer, string> = { loved: 'Loved it', not_for_me: 'Not for me', unseen: 'Haven’t seen', did_not_watch: 'Didn’t watch' };
/** The Taste card's buttons, left to right (owner round 3: Haven't seen first, Loved it last). */
export const TASTE_ANSWERS = ['unseen', 'not_for_me', 'loved'] as const;
/** The next-day question's buttons, left to right. */
export const FOLLOW_UP_ANSWERS = ['did_not_watch', 'not_for_me', 'loved'] as const;

/** How many cards the first run deals, and how many make "That's enough" the way out. */
export const FIRST_RUN_CARDS = 10;
export const ENOUGH_ANSWERS = 5;

const LEVELS = [
  { at: 0, word: 'Empty' },
  { at: 1, word: 'Getting started' },
  { at: 5, word: 'Taking shape' },
  { at: 10, word: 'Good' },
  { at: 20, word: 'Strong' },
  { at: 40, word: 'Very strong' },
] as const;
/** Profile strength from rated titles: its word, how many of 5 segments are lit, and the next level's count. */
export function strength(rated: number) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (rated >= LEVELS[k].at) i = k;
  return { word: LEVELS[i].word, segments: i, next: LEVELS[i + 1]?.at ?? null };
}

/** A card's meta line: "2019 · Movie · 133 min". */
export function cardMeta(c: { year: number | null; mediaType: 'movie' | 'tv'; runtimeMinutes: number | null }) {
  return [c.year ? String(c.year) : null, c.mediaType === 'movie' ? 'Movie' : 'Show', c.runtimeMinutes ? `${Math.round(c.runtimeMinutes)} min` : null].filter(Boolean).join(' · ');
}
