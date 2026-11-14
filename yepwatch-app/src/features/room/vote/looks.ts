/**
 * The eleven YEP / NOPE looks of the voting card and how cards get them: every card is dealt the
 * next look from a shuffled bag of all eleven; an empty bag is reshuffled so that it never starts
 * with the look that just ended. A card keeps its look for as long as the dealer lives, so Undo
 * brings a card back with its own.
 */
export const LOOKS = ['wash', 'giant', 'filter', 'split', 'neon', 'wall', 'burst', 'stamp', 'bleed', 'echo', 'glitch'] as const;
export type Look = (typeof LOOKS)[number];

/** Looks that run the shared slow loop (wall rows, burst rays, glitch jitter). */
export const LOOPING: readonly Look[] = ['wall', 'burst', 'glitch'];

export function isLook(value: unknown): value is Look {
  return typeof value === 'string' && (LOOKS as readonly string[]).includes(value);
}

/** All looks in a random order (Fisher-Yates); never starts with `last`. */
export function shuffledBag(last: Look | undefined, random: () => number = Math.random): Look[] {
  const bag: Look[] = [...LOOKS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (bag[0] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
  return bag;
}

/**
 * Deals looks to cards. `pinned` (diagnosis only: fixture builds and the E2E harness) replaces the bag: one look for
 * every card, or a list dealt in order, round and round.
 */
export class LookDealer {
  private queue: Look[] = [];
  private last: Look | undefined;
  private readonly dealt = new Map<string, Look>();
  private readonly pinned: readonly Look[] | null;

  constructor(private readonly random: () => number = Math.random, pinned: Look | readonly Look[] | null = null) {
    this.pinned = pinned === null ? null : typeof pinned === 'string' ? [pinned] : pinned.length ? pinned : null;
  }

  /** The look of the card with this key: dealt on first sight, the same one ever after. */
  lookFor(key: string): Look {
    const known = this.dealt.get(key);
    if (known) return known;
    if (this.pinned) {
      const look = this.pinned[this.dealt.size % this.pinned.length];
      this.dealt.set(key, look);
      return look;
    }
    if (!this.queue.length) this.queue = shuffledBag(this.last, this.random);
    const look = this.queue.shift() as Look;
    this.last = look;
    this.dealt.set(key, look);
    return look;
  }
}

/** `?look=<name>` pins one look, for checking a single look in a fixture build. */
export function pinnedLookFrom(search: string | undefined): Look | null {
  if (!search) return null;
  const value = new URLSearchParams(search).get('look');
  return isLook(value) ? value : null;
}

/**
 * The E2E harness's look pin (`E2E_LOOK`, for diagnosing one look's frames): `window.__YEPWATCH_LOOKS__`, one look or
 * a comma list dealt in order. Set only by the harness's init script; null when absent or naming no look.
 */
export function harnessLooksFrom(value: unknown): Look[] | null {
  if (typeof value !== 'string') return null;
  const looks = value.split(',').map((v) => v.trim()).filter(isLook);
  return looks.length ? looks : null;
}
