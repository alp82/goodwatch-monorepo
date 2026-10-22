import type {
  Candidate,
  RoomSnapshot,
  ServerActivity,
} from '@goodwatch/yepwatch-contracts/continuous';
export function continuousFixture(): RoomSnapshot {
  const candidate = (id: string): Candidate => ({
    id,
    identity: { kind: 'movie', tmdbId: Number(id.slice(1)) },
    title: `Isolated test ${id}`,
    year: 2020,
    overview: null,
    posterUrl: null,
    runtimeMinutes: 90,
    availability: [],
  });
  return {
    shared: {
      contractVersion: 2,
      roomId: 'test-room',
      revision: 1,
      phase: 'choosing',
      expiresAt: Date.now() + 3600000,
      hostParticipantId: 'host',
      rosterVersion: 1,
      contextVersion: 1,
      generation: 1,
      participants: [{ participantId: 'host', nickname: 'Host', screenId: 'tv', ready: true }],
      screens: [{ id: 'tv', label: 'Our screen', country: 'DE', serviceIds: [8], confirmed: true }],
      constraints: { kinds: ['movie', 'show_start'], maxMinutes: null, moods: [] },
      candidates: [candidate('c1'), candidate('c2')],
      stream: { version: 1, state: 'ready', reason: null },
      matches: [],
      agreement: { version: 0, state: 'none', error: null },
      decision: null,
    },
    own: {
      participantId: 'host',
      nextSequence: 1,
      canHost: true,
      votes: [],
      pick: { candidateId: null, revision: 0 },
      nextCandidateId: 'c1',
      member: { state: 'guest', prefill: null },
    },
  };
}
export function activityFixture(patch: Partial<ServerActivity> = {}): ServerActivity {
  return {
    type: 'activity',
    roomId: 'test-room',
    participantId: 'peer',
    sessionId: 'session',
    sequence: 1,
    view: 'voting',
    serverTime: 1000,
    expiresAt: 7000,
    ...patch,
  };
}
