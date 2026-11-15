/**
 * "I'm in" on Matches: which matches each person is in for (counts only, never who) and the tiebreak once
 * everyone's in for two or more. Read straight from the room (contract 3 with matchesIn): `shared.ins` counts
 * every current match, `own.ins` lists yours, a tap sends `set_in`. Everyone in for one title starts the room's
 * offer check (Tonight); everyone in for two or more opens `shared.tiebreak`, where the server counts favorites
 * and settles the outcome (spinning when favorites tie). Pure, so it is unit tested.
 */
import type { OwnPrivateSnapshot, SharedRoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';

export interface InRow {
  /** Candidate id. */
  id: string;
  /** People in for it, you included (counts only). */
  count: number;
  /** You're in for it. */
  mine: boolean;
}

/** Every match's "I'm in" state, in the matches' order. A match the room doesn't count yet has nobody in. */
export function inRows(matchIds: readonly string[], ins: SharedRoomSnapshot['ins'], own: OwnPrivateSnapshot['ins']): InRow[] {
  const counts = new Map((ins ?? []).map((c) => [c.candidateId, c.count]));
  const mine = new Set(own?.candidateIds ?? []);
  return matchIds.map((id) => ({ id, count: Math.max(counts.get(id) ?? 0, mine.has(id) ? 1 : 0), mine: mine.has(id) }));
}

/** Titles everyone's in for, in the matches' order. */
export const everyoneIn = (rows: readonly InRow[], required: number) => (required > 0 ? rows.filter((r) => r.count >= required).map((r) => r.id) : []);

// ——— Tiebreak: everyone's in for two or more ———

export interface TieOutcome {
  /** The title that won. */
  winner: string;
  /** Favorites tied too, so a spin among `among` decided. */
  spun: boolean;
  /** The titles the spin chose among (the most-picked ones), or just the winner. */
  among: string[];
}

export interface TiebreakView {
  /** Bumps whenever the tied set changes (picks start over). */
  version: number;
  /** The titles everyone's in for, in the matches' order. */
  candidateIds: string[];
  /** Favorites per title so far (counts only). */
  favorites: Record<string, number>;
  /** Your favorite in this tiebreak, or null. */
  mine: string | null;
  /** The server's outcome once every favorite is in. */
  outcome: TieOutcome | null;
}

/** The room's open tiebreak as Matches shows it, or null. */
export function tiebreakView(shared: Pick<SharedRoomSnapshot, 'tiebreak'>, own: Pick<OwnPrivateSnapshot, 'favorite'>): TiebreakView | null {
  const t = shared.tiebreak;
  if (!t) return null;
  const favorite = own.favorite && own.favorite.tiebreakVersion === t.version ? own.favorite.candidateId : null;
  return {
    version: t.version,
    candidateIds: [...t.candidateIds],
    favorites: Object.fromEntries(t.favorites.map((f) => [f.candidateId, f.count])),
    mine: favorite,
    outcome: t.outcome ? { winner: t.outcome.candidateId, spun: t.outcome.spun, among: [...t.outcome.among] } : null,
  };
}

/** Spin steps in ms: fast, then slowing to a stop. */
export const SPIN_STEPS = [70, 70, 75, 80, 90, 100, 115, 135, 160, 195, 240, 300] as const;

/** The titles the spin lights, one per step, ending on `winner` (so it lands there on every phone). */
export function spinPath(among: readonly string[], winner: string, steps = SPIN_STEPS.length) {
  const end = Math.max(0, among.indexOf(winner));
  const n = among.length;
  return Array.from({ length: steps }, (_, i) => among[(((end - (steps - 1 - i)) % n) + n) % n]);
}
