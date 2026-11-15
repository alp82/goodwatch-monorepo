/**
 * "I'm in" on Matches: which matches each person is in for (counts only, never who), what a tap sends,
 * and how a tie among titles everyone's in on is settled. Pure, so it is unit tested.
 *
 * The server today keeps one proposal at a time with agreements (contract 3): the proposal's title is the
 * one whose "I'm in"s the room counts, and everyone in on it decides it (Tonight). So a tap
 * - on the proposal's title agrees or takes the agreement back;
 * - on another title proposes it, when nobody else is in on the current proposal (nothing of theirs is lost);
 * - otherwise marks it on this device only (shown as "You're in", counted for you alone), so a tap never
 *   wipes friends' "I'm in"s. The server side of real multi-select is in docs/rethink-matches-backend.md.
 */

export interface InRow {
  /** Candidate id. */
  id: string;
  /** People in for it, you included (counts only). */
  count: number;
  /** You're in for it. */
  mine: boolean;
}

export interface ProposalIns {
  candidateId: string;
  agreeCount: number;
  /** You proposed it or agree to it (or your Propose of it is on its way). */
  mine: boolean;
}

/** Every match's "I'm in" state, in the matches' order. `local`: titles marked on this device only. */
export function inRows(matchIds: readonly string[], proposal: ProposalIns | null, local: ReadonlySet<string>): InRow[] {
  return matchIds.map((id) => {
    if (proposal && proposal.candidateId === id) return { id, count: Math.max(proposal.agreeCount, proposal.mine ? 1 : 0), mine: proposal.mine };
    const mine = local.has(id);
    return { id, count: mine ? 1 : 0, mine };
  });
}

/** Titles everyone's in for, in the matches' order. */
export const everyoneIn = (rows: readonly InRow[], required: number) => (required > 0 ? rows.filter((r) => r.count >= required).map((r) => r.id) : []);

export type InTap =
  | { kind: 'agree'; agreed: boolean }
  | { kind: 'propose' }
  | { kind: 'mark'; on: boolean };

/** What tapping a match's "I'm in" does (see the module comment). */
export function inTap(id: string, proposal: ProposalIns | null, local: ReadonlySet<string>): InTap {
  if (proposal && proposal.candidateId === id) return { kind: 'agree', agreed: !proposal.mine };
  if (local.has(id)) return { kind: 'mark', on: false };
  const othersIn = proposal ? proposal.agreeCount - (proposal.mine ? 1 : 0) : 0;
  return othersIn > 0 ? { kind: 'mark', on: true } : { kind: 'propose' };
}

/**
 * The "I'm in" marks this device keeps after a tap. Proposing a new title replaces your own proposal on the
 * server, so a title you were in for stays marked here; agreeing to a title clears its local mark.
 */
export function localAfter(local: ReadonlySet<string>, id: string, tap: InTap, proposal: ProposalIns | null): Set<string> {
  const next = new Set(local);
  if (tap.kind === 'mark') {
    if (tap.on) next.add(id);
    else next.delete(id);
  } else if (tap.kind === 'propose') {
    next.delete(id);
    if (proposal?.mine) next.add(proposal.candidateId);
  } else next.delete(id);
  return next;
}

// ——— Tiebreak: everyone's in for two or more ———

/** A small stable hash (FNV-1a), so every phone spins to the same title from the same seed. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface TieOutcome {
  /** The title that won. */
  winner: string;
  /** Favorites tied too, so a spin among `among` decided. */
  spun: boolean;
  /** The titles the spin chose among (the most-picked ones), or just the winner. */
  among: string[];
}

/**
 * Most favorites wins; favorites tied too: a fair spin among the most-picked titles, decided by `seed`
 * (the server's spin seed for this tiebreak, the same on every phone). Null until every favorite is in.
 */
export function tieOutcome(tied: readonly string[], favorites: Readonly<Record<string, number>>, required: number, seed: string): TieOutcome | null {
  const total = tied.reduce((n, id) => n + (favorites[id] ?? 0), 0);
  if (!tied.length || total < required) return null;
  const top = Math.max(...tied.map((id) => favorites[id] ?? 0));
  const among = tied.filter((id) => (favorites[id] ?? 0) === top);
  if (among.length === 1) return { winner: among[0], spun: false, among };
  return { winner: among[hash(`${seed}:${among.join(',')}`) % among.length], spun: true, among };
}

/** Spin steps in ms: fast, then slowing to a stop. */
export const SPIN_STEPS = [70, 70, 75, 80, 90, 100, 115, 135, 160, 195, 240, 300] as const;

/** The titles the spin lights, one per step, ending on `winner` (so it lands there on every phone). */
export function spinPath(among: readonly string[], winner: string, steps = SPIN_STEPS.length) {
  const end = Math.max(0, among.indexOf(winner));
  const n = among.length;
  return Array.from({ length: steps }, (_, i) => among[(((end - (steps - 1 - i)) % n) + n) % n]);
}
