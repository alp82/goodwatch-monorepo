import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRoom, mergePublic, ownCard, latestRetainedVote, PersistentCommands } from '../src/core/continuous/state';
import { applyActivity, pruneActivity, groupActivity } from '../src/core/continuous/activity';
import { parseFrame } from '../src/core/continuous/wire';
import { ContinuousApi, RoomFailure } from '../src/core/continuous/api-client';
import {
  youtubeId,
  reportedAudible,
  embeddingRefused,
  playbackMessage,
  playerHtml,
} from '../src/features/glow/trailer';
import { boundedMatch, presentationSize } from '../src/features/glow/model';
import { continuousFixture, activityFixture } from './continuous-fixture';

test('continuous snapshots preserve separate own authority across pushes, late joins and restarts', () => {
  const old = continuousFixture();
  old.own.votes = [{ candidateId: 'c1', value: 'watch', revision: 1, activeExposureMs: null, timingSource: 'unavailable' }];
  old.own.agreement = { proposalVersion: 1, agreed: true, revision: 1, isProposer: true };
  old.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  let cache = mergeRoom(undefined, old);
  const pushed = { ...old.shared, revision: 4, rosterVersion: 2, matches: [] };
  cache = mergePublic(cache, pushed)!;
  assert.deepEqual(cache.shared.matches, []);
  assert.equal(cache.own.agreement.agreed, true);
  const fresh = continuousFixture();
  fresh.shared = { ...pushed, revision: 3 };
  fresh.own.agreement = { proposalVersion: 1, agreed: false, revision: 2, isProposer: false };
  cache = mergeRoom(cache, fresh);
  assert.equal(cache.shared.revision, 4);
  assert.equal(cache.own.agreement.agreed, false);
  cache = mergeRoom(cache, old);
  assert.equal(cache.own.agreement.agreed, false);
  assert.equal(cache.shared.rosterVersion, 2);
  const restarted = continuousFixture();
  restarted.shared.revision = 5;
  restarted.shared.generation = 2;
  cache = mergeRoom(cache, restarted);
  cache = mergeRoom(cache, fresh);
  assert.equal(cache.own.votes.length, 0);
  assert.equal(cache.shared.generation, 2);
});
test('only own pending answer advances own card; match inspection retains exact next card and confirmed matches only', () => {
  const room = continuousFixture();
  assert.equal(ownCard(room)?.id, 'c1');
  assert.equal(ownCard(room, 'c1')?.id, 'c2');
  assert.deepEqual(room.shared.matches, []);
  assert.equal(boundedMatch(['c2', 'c3'], 'c3', 'c2'), 'c3');
  assert.equal(ownCard(room)?.id, 'c1');
  assert.equal(boundedMatch(['c2'], 'c3', 'c3'), 'c2');
});
test('persist before HTTP, recover the exact envelope after process reload, clear only confirmed or definitive results', async () => {
  const snapshot = continuousFixture();
  let stored: unknown = null;
  let calls = 0;
  const first = new PersistentCommands(() => 'stable-id', {
    write: async (value) => {
      stored = value;
    },
  });
  const command = {
    type: 'vote',
    generation: 1,
    candidateId: 'c1',
    expectedVoteRevision: 0,
    value: 'pass',
  } as const;
  await assert.rejects(
    first.send(command, snapshot, async (body) => {
      calls++;
      assert.deepEqual(stored, body);
      throw new RoomFailure('outcome_unknown', 'lost');
    })
  );
  const saved = first.pending;
  const reloaded = new PersistentCommands(() => 'must-not-use', {
    write: async (value) => {
      stored = value;
    },
  });
  reloaded.pending = saved;
  await assert.rejects(
    reloaded.send(command, snapshot, async () => {
      throw new Error('must not send another command');
    })
  );
  await reloaded.send(undefined, snapshot, async (body) => {
    calls++;
    assert.deepEqual(body, saved);
    return { snapshot };
  });
  assert.equal(calls, 2);
  assert.equal(stored, null);
  const failedStorage = new PersistentCommands(() => 'id', {
    write: async () => {
      throw new Error('storage unavailable');
    },
  });
  await assert.rejects(
    failedStorage.send(command, snapshot, async () => {
      calls++;
      return { snapshot };
    })
  );
  assert.equal(calls, 2);
});
test('exact public parser rejects choice, identity and real pointer leaks on snapshots and activity', () => {
  for (const malformed of [null, undefined, {}, 42]) assert.equal(parseFrame(malformed), null);
  const snapshot = continuousFixture().shared;
  assert.ok(parseFrame(JSON.stringify({ type: 'room.snapshot', snapshot })));
  for (const field of ['vote', 'currentCardId', 'pick', 'watchedHistory']) {
    const dirty = structuredClone(snapshot);
    Object.assign(dirty.participants[0], { [field]: 'private' });
    assert.equal(parseFrame(JSON.stringify({ type: 'room.updated', snapshot: dirty })), null);
  }
  for (const field of ['x', 'y', 'direction', 'title', 'candidateId', 'choice'])
    assert.equal(parseFrame(JSON.stringify({ ...activityFixture(), [field]: 1 })), null);
});
test('neutral activity sessions expire independently; own events, replay and stale gestures stay hidden', () => {
  let sessions = applyActivity(new Map(), activityFixture({ gesture: 'handle' }), 'host', 1000);
  sessions = applyActivity(
    sessions,
    activityFixture({
      sessionId: 'second',
      serverTime: 1100,
      expiresAt: 7100,
      view: 'trailer',
    }),
    'host',
    1100
  );
  assert.equal(sessions.size, 2);
  assert.equal(groupActivity(sessions, 1100).get('peer')?.frame.view, 'trailer');
  sessions = applyActivity(
    sessions,
    activityFixture({
      sequence: 2,
      view: 'away',
      serverTime: 1200,
      expiresAt: 7200,
    }),
    'host',
    1200
  );
  assert.equal(sessions.size, 1);
  sessions = applyActivity(sessions, activityFixture({ participantId: 'host' }), 'host', 1200);
  assert.equal(sessions.size, 1);
  sessions = applyActivity(
    sessions,
    activityFixture({
      sessionId: 'second',
      sequence: 1,
      view: 'matches',
      serverTime: 1300,
    }),
    'host',
    1300
  );
  assert.equal(sessions.get('second')?.frame.view, 'trailer');
  assert.equal(pruneActivity(sessions, 7200).size, 0);
  const pulse = applyActivity(new Map(), activityFixture({ beat: 'answer' }), 'host', 1000);
  assert.equal(pruneActivity(pulse, 2600).get('session')?.pulse, null);
  assert.equal(pruneActivity(pulse, 2600).size, 1);
});
test('v3 HTTP namespace, native bearer and browser cookie split are real, and caller cancellation reaches body reads', async () => {
  const access = {
    roomId: 'room',
    participantId: 'host',
    token: 'private-test-token',
    expiresAt: 10000,
  };
  let headers: HeadersInit | undefined;
  let credentials: RequestCredentials | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    assert.match(String(url), /\/proposal\/rooms\/room$/);
    headers = init?.headers;
    credentials = init?.credentials;
    return Response.json(continuousFixture());
  };
  await new ContinuousApi(fetcher, true).snapshot(access);
  assert.equal(new Headers(headers).get('Authorization'), 'Bearer private-test-token');
  await new ContinuousApi(fetcher).snapshot(access);
  assert.equal(new Headers(headers).get('Authorization'), null);
  assert.equal(credentials, 'include');
  const controller = new AbortController();
  let aborted = false;
  const pending = new ContinuousApi(async (_, init) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return new Response(
      new ReadableStream({
        start(stream) {
          stream.enqueue(new TextEncoder().encode('{'));
          init?.signal?.addEventListener('abort', () => stream.error(new Error('aborted')));
        },
      })
    );
  }).request('/api/yepwatch/v1/proposal/rooms/room', undefined, access, controller.signal);
  controller.abort();
  await assert.rejects(pending);
  assert.equal(aborted, true);
});
test('canonical trailers and reported playback never turn requested audio into a false sound claim', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeId('https://evil.test/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(youtubeId('https://youtube.com.evil.test/embed/dQw4w9WgXcQ'), null);
  assert.equal(reportedAudible(null), false);
  assert.equal(reportedAudible({ state: 1, muted: true, volume: 100 }), false);
  assert.equal(reportedAudible({ state: 2, muted: false, volume: 100 }), false);
  assert.equal(reportedAudible({ state: 1, muted: false, volume: 100 }), true);
  for (const [w, h] of [
    [375, 400],
    [390, 570],
    [540, 620],
  ]) {
    const result = presentationSize(w, h, w > 500);
    assert.ok(result.height <= h);
    assert.ok(result.width < w);
  }
});

test('authoritative retained Undo survives reload/replay, ignores null and retired votes, and clears with generation', () => {
  const room = continuousFixture();
  room.own.votes = [
    {candidateId: 'c1', value: 'watch', revision: 1, activeExposureMs: null, timingSource: 'unavailable'},
    {candidateId: 'c2', value: 'pass', revision: 1, activeExposureMs: null, timingSource: 'unavailable'},
    {candidateId: 'retired', value: 'watch', revision: 1, activeExposureMs: null, timingSource: 'unavailable'},
    {candidateId: 'already-undone', value: null, revision: 2, activeExposureMs: null, timingSource: 'unavailable'},
  ];
  assert.equal(latestRetainedVote(JSON.parse(JSON.stringify(room)))?.candidateId, 'c2');
  room.own.votes[1] = {...room.own.votes[1], value: null, revision: 2, activeExposureMs: null, timingSource: 'unavailable'};
  assert.equal(latestRetainedVote(room)?.candidateId, 'c1');
  room.shared.candidates = room.shared.candidates.filter(c => c.id !== 'c1');
  assert.equal(latestRetainedVote(room), undefined);
  room.shared.generation++;
  room.shared.candidates = [];
  assert.equal(latestRetainedVote(room), undefined);
});

test('embedding refusals retain explicit YouTube recovery instead of suggesting audio permission', () => {
  for (const error of ['101', '150']) {
    const refused = { state: 1, muted: false, volume: 100, error };
    assert.equal(embeddingRefused(refused), true);
    assert.equal(reportedAudible(refused), false);
    assert.equal(
      playbackMessage(refused),
      'This trailer cannot play inside the app. Watch it on YouTube.'
    );
    assert.doesNotMatch(playbackMessage(refused), /Play with sound/);
  }
  assert.equal(
    embeddingRefused({
      state: -1,
      muted: true,
      volume: 0,
      error: 'Playback needs a tap',
    }),
    false
  );
  assert.equal(playbackMessage({ state: 1, muted: false, volume: 75 }), 'Playing · sound on');
  const reports: { error?: string }[] = [];
  let interval: () => void = () => {};
  let events: { onError: (e: {data: number}) => void; onStateChange: (e: {data: number}) => void };
  const context = {
    parent: { postMessage: (value: {error?: string}) => reports.push(value) },
    window: { addEventListener: () => {} },
    document: { createElement: () => ({}), head: { appendChild: () => {} } },
    setInterval: (fn: () => void) => { interval = fn; },
    YT: { Player: function (_id: string, options: {events: typeof events}) {
      events = options.events;
      return { getPlayerState: () => -1, isMuted: () => false, getVolume: () => 100 };
    } },
  };
  runInNewContext(playerHtml('dQw4w9WgXcQ', 'test').match(/<script>([\s\S]*)<\/script>/)![1], context);
  runInNewContext('onYouTubeIframeAPIReady()', context);
  events!.onError({data: 150});
  interval(); interval();
  assert.deepEqual(reports.map(r => r.error), ['150', '150', '150']);
  events!.onStateChange({data: 1});
  assert.equal(reports.at(-1)?.error, undefined);
});

test('native member callbacks require fixed URI, retained room, unexpired local state and no duplicate parameters', async () => {
  const { nativeMemberCallback } = await import('../src/core/continuous/member-state');
  const pending = {
    roomId: 'own-room',
    expectedState: 'own-state',
    verifier: 'own-verifier',
    expiresAt: 10000,
  };
  assert.deepEqual(
    nativeMemberCallback(
      'yepwatch://auth/callback?roomId=own-room&state=own-state&code=one-use',
      pending,
      100
    ),
    {
      roomId: 'own-room',
      state: 'own-state',
      code: 'one-use',
      codeVerifier: 'own-verifier',
    }
  );
  for (const url of [
    'yepwatch://other/callback?roomId=own-room&state=own-state&code=x',
    'yepwatch://auth/callback?roomId=other&state=own-state&code=x',
    'yepwatch://auth/callback?roomId=own-room&state=wrong&code=x',
    'yepwatch://auth/callback?roomId=own-room&state=own-state&code=x&code=y',
    'https://evil.test/auth/callback?roomId=own-room&state=own-state&code=x',
  ])
    assert.throws(() => nativeMemberCallback(url, pending, 100));
  assert.throws(() =>
    nativeMemberCallback(
      'yepwatch://auth/callback?roomId=own-room&state=own-state&code=x',
      pending,
      10001
    )
  );
});

test('inspection is matches-only, action scoped, exact and expires without heartbeat replay', () => {
  const frame = activityFixture({view: 'matches', inspection: {kind: 'poster', candidateId: 'c1'}});
  assert.ok(parseFrame(JSON.stringify(frame)));
  assert.equal(parseFrame(JSON.stringify({...frame, view: 'voting'})), null);
  for (const inspection of [{kind: 'lens', candidateId: 'c1'}, {kind: 'dice', agreed: true}, {kind: 'poster', candidateId: 'c1', participantApproval: true}])
    assert.equal(parseFrame(JSON.stringify({...frame, inspection})), null);
  let sessions = applyActivity(new Map(), frame, 'host', 1000);
  assert.equal(sessions.get('session')?.pulse?.inspection?.kind, 'poster');
  sessions = applyActivity(sessions, activityFixture({view: 'matches', sequence: 2, serverTime: 2000, expiresAt: 8000}), 'host', 2000);
  assert.equal(sessions.get('session')?.pulse?.serverTime, 1000);
  assert.equal(pruneActivity(sessions, 2500).get('session')?.pulse, null);
  assert.equal(pruneActivity(sessions, 2500).get('session')?.frame.view, 'matches');
});
