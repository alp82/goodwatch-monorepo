import { ACTIVITY_LIMITS, type ServerActivity } from '@goodwatch/yepwatch-contracts/proposal';

/** One burst to render: a tap, or the first frame of a hold episode (renewals never repeat it). */
export interface CheerEvent {
  id: string;
  participantId: string;
  kind: 'tap' | 'hold';
  seed: number;
  generation: number;
  at: number;
  self: boolean;
}
interface ParticipantHold {
  seed: number;
  generation: number;
  /** sessionId -> hold evidence deadline (serverTime + pulse TTL). */
  sessions: Map<string, number>;
}
/** Ephemeral peer cheer state. Distinct participants, each possibly on several sessions/devices. */
export interface CheerState {
  holds: Map<string, ParticipantHold>;
  /** Last hold seed seen per participant, so renewals of the same episode emit no new burst. */
  lastSeed: Map<string, number>;
}
export const emptyCheers = (): CheerState => ({ holds: new Map(), lastSeed: new Map() });

/** Pure: fold one server activity frame into cheer state; returns a burst event for taps and new holds. */
export function applyCheerFrame(state: CheerState, frame: ServerActivity, now: number, ownId: string): { state: CheerState; event?: CheerEvent } {
  const cheer = frame.cheer;
  if (!cheer || frame.participantId === ownId) return { state };
  if (frame.serverTime + ACTIVITY_LIMITS.pulseTtlMs <= now || frame.serverTime > now + 5000) return { state };
  const holds = new Map(state.holds);
  const lastSeed = new Map(state.lastSeed);
  const id = `${frame.participantId}:${frame.sessionId}:${frame.sequence}`;
  if (cheer.kind === 'tap') {
    return { state: { holds, lastSeed }, event: { id, participantId: frame.participantId, kind: 'tap', seed: cheer.seed, generation: cheer.generation, at: frame.serverTime, self: false } };
  }
  const current = holds.get(frame.participantId);
  if (cheer.kind === 'release') {
    if (current) {
      const sessions = new Map(current.sessions);
      sessions.delete(frame.sessionId);
      if (sessions.size) holds.set(frame.participantId, { ...current, sessions });
      else holds.delete(frame.participantId);
    }
    return { state: { holds, lastSeed } };
  }
  // hold
  const fresh = !current || current.generation !== cheer.generation ? new Map<string, number>() : new Map(current.sessions);
  fresh.set(frame.sessionId, frame.serverTime + ACTIVITY_LIMITS.pulseTtlMs);
  holds.set(frame.participantId, { seed: cheer.seed, generation: cheer.generation, sessions: fresh });
  const isNew = lastSeed.get(frame.participantId) !== cheer.seed;
  lastSeed.set(frame.participantId, cheer.seed);
  return {
    state: { holds, lastSeed },
    event: isNew ? { id, participantId: frame.participantId, kind: 'hold', seed: cheer.seed, generation: cheer.generation, at: frame.serverTime, self: false } : undefined,
  };
}
/** Distinct participants with any unexpired hold session for this generation, with their episode seed. */
export function holderSeeds(state: CheerState, now: number, generation: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const [participantId, hold] of state.holds) {
    if (hold.generation !== generation) continue;
    for (const until of hold.sessions.values()) if (until > now) { out.set(participantId, hold.seed); break; }
  }
  return out;
}
export const holdingParticipants = (state: CheerState, now: number, generation: number) => new Set(holderSeeds(state, now, generation).keys());
/** Bursts stay renderable for the pulse TTL only, so returning to Tonight never replays old ones. */
export const freshCheerEvents = <T extends { at: number }>(events: readonly T[], now: number) => events.filter((e) => e.at + ACTIVITY_LIMITS.pulseTtlMs > now);
/** Drops expired hold sessions (and participants with none left). */
export function pruneCheers(state: CheerState, now: number): CheerState {
  const holds = new Map<string, ParticipantHold>();
  for (const [participantId, hold] of state.holds) {
    const sessions = new Map([...hold.sessions].filter(([, until]) => until > now));
    if (sessions.size) holds.set(participantId, { ...hold, sessions });
  }
  return { holds, lastSeed: state.lastSeed };
}
/** Earliest future hold deadline, for a one-shot expiry timer (null when nobody holds). */
export function nextCheerExpiry(state: CheerState, now: number): number | null {
  let next: number | null = null;
  for (const hold of state.holds.values()) for (const until of hold.sessions.values()) if (until > now && (next === null || until < next)) next = until;
  return next;
}
/** Every non-dropped participant (self included) is holding. A one-person room counts; nobody required is never "all". */
export function allHolding(holders: Set<string>, selfHolding: boolean, ownId: string, participants: { participantId: string; dropped?: boolean }[]): boolean {
  const required = participants.filter((p) => !p.dropped);
  if (!required.length) return false;
  return required.every((p) => (p.participantId === ownId ? selfHolding : holders.has(p.participantId)));
}
export function newCheerSeed(): number {
  return Math.floor(Math.random() * 2147483648) % 2147483648;
}
/** Deterministic PRNG so every window draws the same composition from a shared seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
