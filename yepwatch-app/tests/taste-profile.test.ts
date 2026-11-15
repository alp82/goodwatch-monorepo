import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeProfileSecret, validProfileSecret } from '../src/core/continuous/profile-secret-format';
import { carriesProfile } from '../src/core/continuous/profile-paths';
import { acknowledge, decodeOutbox, encodeOutbox, enqueue, itemId, nextBatch, pendingDelta, toWire, type PendingAnswer } from '../src/core/continuous/taste-outbox';
import { TasteProfileStore, type TasteProfileApi } from '../src/core/continuous/taste-profile-store';
import { cardMeta, strength } from '../src/features/taste/answers';
import { followUpLabel } from '../src/features/home/FollowUpCard.logic';

const P = '/api/yepwatch/v1/proposal';
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('the profile secret is 32 bytes as unpadded base64url (what the server accepts)', () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, i) => (i * 37 + 11) % 256);
  const secret = encodeProfileSecret(bytes);
  assert.equal(secret, Buffer.from(bytes).toString('base64url'));
  assert.equal(secret.length, 43);
  assert.ok(validProfileSecret(secret));
  assert.equal(validProfileSecret(`${secret}=`), false);
  assert.equal(validProfileSecret(null), false);
  for (const n of [1, 2, 3, 31]) assert.equal(encodeProfileSecret(bytes.slice(0, n)), Buffer.from(bytes.slice(0, n)).toString('base64url'));
});

test('only profile routes and admissions carry the profile header', () => {
  assert.ok(carriesProfile(`${P}/profile`, 'GET'));
  assert.ok(carriesProfile(`${P}/profile`, 'DELETE'));
  assert.ok(carriesProfile(`${P}/profile/answers`, 'POST'));
  assert.ok(carriesProfile(`${P}/profile/taste-deck?count=10`, 'GET'));
  assert.ok(carriesProfile(`${P}/rooms`, 'POST'));
  assert.ok(carriesProfile(`${P}/rooms/abc/join`, 'POST'));
  assert.equal(carriesProfile(`${P}/rooms/abc/resume`, 'POST'), false);
  // Returns and room reads wait for the server's linking fix (profile-paths.ts LINK_AGAIN).
  assert.equal(carriesProfile(`${P}/rooms/abc`, 'GET'), false);
  assert.equal(carriesProfile(`${P}/rooms/abc?known=4`, 'GET'), false);
  assert.equal(carriesProfile(`${P}/rooms`, 'GET'), false);
  assert.equal(carriesProfile(`${P}/rooms/abc/commands`, 'POST'), false);
  assert.equal(carriesProfile(`${P}/rooms/abc/realtime-ticket`, 'POST'), false);
  assert.equal(carriesProfile(`${P}/account`, 'GET'), false);
  assert.equal(carriesProfile(`${P}/invites/preview`, 'POST'), false);
  assert.equal(carriesProfile(`${P}/profiles`, 'GET'), false);
});

const item = (key: number, answer: PendingAnswer['answer'], at: number, delta = answer === 'loved' || answer === 'not_for_me' ? 1 : 0, decidedAt?: number): PendingAnswer =>
  ({ key, answer, at, delta, ...(decidedAt === undefined ? {} : { decidedAt }) });

test('outbox: an unsent answer and its Undo cost nothing; one on its way stays and the newer goes after it', () => {
  let list = enqueue([], item(1, 'loved', 10), new Set());
  list = enqueue(list, item(1, null, 11, -1), new Set());
  assert.deepEqual(list.map((p) => [p.key, p.answer, p.at, p.delta]), [[1, null, 11, 0]]);
  assert.equal(pendingDelta(list), 0);
  const flying = new Set([itemId(list[0])]);
  list = enqueue(list, item(1, 'unseen', 12), flying);
  assert.equal(list.length, 2);
  assert.deepEqual(nextBatch(list, flying).map((p) => p.at), [12]);
  list = acknowledge(list, [item(1, null, 11, 0)]);
  assert.deepEqual(list.map((p) => p.at), [12]);
});

test('outbox: next-day answers have their own slot per decision and go out as follow-ups', () => {
  let list = enqueue([], item(5, 'loved', 1), new Set());
  list = enqueue(list, item(5, 'did_not_watch', 2, 0, 100), new Set());
  assert.equal(list.length, 2);
  assert.deepEqual(toWire(list[1]), { key: 5, answer: 'did_not_watch', at: 2, source: 'followup', decidedAt: 100 });
  assert.deepEqual(toWire(list[0]), { key: 5, answer: 'loved', at: 1 });
});

test('outbox: batches of ten, a cap of 50, and a storage form that survives a restart', () => {
  let list: PendingAnswer[] = [];
  for (let i = 0; i < 60; i++) list = enqueue(list, item(i, 'loved', 100 + i), new Set());
  assert.equal(list.length, 50);
  assert.equal(list[0].key, 10);
  assert.equal(nextBatch(list, new Set()).length, 10);
  const back = decodeOutbox(encodeOutbox([item(1, null, 5, -1), item(2, 'not_for_me', 6, 1, 77)]));
  assert.deepEqual(back, [item(1, null, 5, -1), item(2, 'not_for_me', 6, 1, 77)]);
  assert.deepEqual(decodeOutbox('{"nope":1}'), []);
  assert.deepEqual(decodeOutbox('[[1,"maybe",5,0]]'), []);
  assert.deepEqual(decodeOutbox('not json'), []);
});

function harness(api: Partial<TasteProfileApi> = {}, stored: string | null = null) {
  const sent: { revision: number; items: unknown[] }[] = [];
  let revision = 3;
  let answered = 4;
  const writes: (string | null)[] = [];
  const timers: (() => void)[] = [];
  let now = 1000;
  const store = new TasteProfileStore({
    api: {
      profile: async () => ({ answered, loved: answered, notForMe: 0, unseen: 0, revision, followups: [{ key: 9, title: 'Heat', year: 1995, posterUrl: null, mediaType: 'movie', overview: null, runtimeMinutes: 170, decidedAt: 50 }] }),
      profileAnswers: async (body) => {
        sent.push(body);
        if (body.revision !== revision) throw Object.assign(new Error('stale'), { status: 409 });
        revision += 1;
        answered += body.items.filter((i) => i.answer === 'loved' || i.answer === 'not_for_me').length;
        return { revision, answered };
      },
      deleteProfile: async () => undefined,
      ...api,
    },
    read: async () => stored,
    write: async (v) => { writes.push(v); },
    forgetSecret: async () => undefined,
    now: () => now,
    wait: (_ms, run) => { timers.push(run); return () => undefined; },
    random: () => 0,
  });
  return { store, sent, writes, timers, bumpRevision: () => { revision += 1; }, tick: (ms: number) => { now += ms; } };
}

test('store: answers count at once, go in tens and on flush, with stable times', async () => {
  const h = harness();
  await h.store.load();
  assert.equal(h.store.snapshot().rated, 4);
  for (let i = 0; i < 9; i++) h.store.answer(1e12 + i, i % 3 === 2 ? 'unseen' : 'loved');
  assert.equal(h.store.snapshot().rated, 4 + 6);
  assert.equal(h.sent.length, 0);
  h.store.answer(1e12 + 9, 'not_for_me');
  await h.store.flush();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].items.length, 10);
  assert.equal(h.store.snapshot().rated, 11);
  // Two answers in the same millisecond still get different times (the server's idempotency key).
  h.store.answer(2e12 + 1, 'loved');
  h.store.answer(2e12 + 1, null, 'loved');
  h.store.answer(2e12 + 2, 'loved');
  await h.store.flush();
  const times = (h.sent[1].items as { at: number }[]).map((i) => i.at);
  assert.equal(new Set(times).size, times.length);
  assert.equal(h.store.snapshot().rated, 12);
  await settle();
  assert.equal(h.writes.at(-1), null);
});

test('store: a stale revision reads the profile again and resends the same items', async () => {
  const h = harness();
  await h.store.load();
  h.store.answer(1e12 + 1, 'loved');
  h.bumpRevision();
  await h.store.flush();
  assert.equal(h.sent.length, 2);
  assert.deepEqual(h.sent[0].items, h.sent[1].items);
  assert.equal(h.sent[1].revision, h.sent[0].revision + 1);
});

test('store: a network failure waits and goes again; a refusal drops only that batch', async () => {
  let fail = true;
  const h = harness({ profileAnswers: async (body) => { if (fail) throw Object.assign(new Error('offline'), {}); return { revision: body.revision + 1, answered: 5 }; } });
  await h.store.load();
  h.store.answer(1e12 + 1, 'loved');
  await h.store.flush();
  assert.equal(h.timers.length, 1);
  assert.equal(h.store.snapshot().rated, 5);
  fail = false;
  h.timers[0]();
  await h.store.flush();
  assert.equal(h.store.snapshot().rated, 5);
  const refused = harness({ profileAnswers: async () => { throw Object.assign(new Error('gone'), { status: 400 }); } });
  await refused.store.load();
  refused.store.answerFollowUp({ key: 9, decidedAt: 50 }, 'loved');
  await refused.store.flush();
  await settle();
  assert.equal(refused.timers.length, 0);
  assert.equal(refused.writes.at(-1), null);
});

test('store: a next-day answer leaves the list at once; Reset forgets everything', async () => {
  const h = harness();
  await h.store.load();
  assert.equal(h.store.snapshot().followUps.length, 1);
  h.store.answerFollowUp({ key: 9, decidedAt: 50 }, 'did_not_watch');
  assert.equal(h.store.snapshot().followUps.length, 0);
  await h.store.flush();
  assert.deepEqual(h.sent[0].items, [{ key: 9, answer: 'did_not_watch', at: 1000, source: 'followup', decidedAt: 50 }]);
  await h.store.reset();
  assert.equal(h.store.snapshot().rated, 0);
});

test('store: answers kept from an earlier run go first', async () => {
  const h = harness({}, encodeOutbox([item(1e12 + 7, 'loved', 500)]));
  await h.store.load();
  assert.equal(h.store.snapshot().rated, 5);
  await h.store.flush();
  assert.deepEqual(h.sent[0].items, [{ key: 1e12 + 7, answer: 'loved', at: 500 }]);
});

test('taste words: strength levels, card meta and the next-day label', () => {
  assert.deepEqual([0, 1, 5, 10, 20, 40].map((n) => strength(n).word), ['Empty', 'Getting started', 'Taking shape', 'Good', 'Strong', 'Very strong']);
  assert.equal(strength(11).next, 20);
  assert.equal(cardMeta({ year: 2019, mediaType: 'movie', runtimeMinutes: 132.6 }), '2019 · Movie · 133 min');
  assert.equal(cardMeta({ year: null, mediaType: 'tv', runtimeMinutes: null }), 'Show');
  assert.equal(followUpLabel(0, 14 * 3600_000), 'Last night’s pick');
  assert.equal(followUpLabel(0, 3 * 86400_000), 'Picked 3 days ago');
});
