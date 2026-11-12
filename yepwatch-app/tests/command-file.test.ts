import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createCommandFiles, type Files } from '../src/core/continuous/command-file';

function memory() {
  const disk = new Map<string, string>();
  let cutAfter: number | null = null;
  const files: Files = {
    read: (uri) => disk.get(uri) ?? null,
    write: (uri, contents) => {
      // Killed mid-write: part of the record reached the file.
      if (cutAfter !== null) { disk.set(uri, contents.slice(0, cutAfter)); throw new Error('killed'); }
      disk.set(uri, contents);
    },
    remove: (uri) => { disk.delete(uri); },
    makeDir: () => {},
    removeDir: (uri) => { for (const k of [...disk.keys()]) if (k.startsWith(uri)) disk.delete(k); },
  };
  return { disk, files, kill: (at: number | null) => { cutAfter = at; } };
}
const none = { read: async () => null, remove: async () => undefined };

test('saved by the time write returns: no asynchronous step stands between the save and the request', async () => {
  const { files } = memory();
  const store = createCommandFiles('d/', files, none);
  void store.write('k', '{"a":1}');
  assert.equal(await store.read('k'), '{"a":1}');
  await store.write('k', null);
  assert.equal(await store.read('k'), null);
});

test('killed mid-write: the last whole value stays, a cleared value never comes back', async () => {
  const { files, kill } = memory();
  const store = createCommandFiles('d/', files, none);
  await store.write('k', '{"a":1}');
  for (const at of [0, 3, 12]) {
    kill(at);
    await assert.rejects(store.write('k', '{"a":2,"long":true}'));
    kill(null);
    assert.equal(await store.read('k'), '{"a":1}', `cut after ${at}`);
  }
  await store.write('k', '{"a":2}');
  await store.write('k', null);
  kill(5);
  await assert.rejects(store.write('k', '{"a":3}'));
  kill(null);
  assert.equal(await store.read('k'), null, 'the cleared value stays cleared');
  // A first write cut off leaves nothing to retry.
  kill(4);
  await assert.rejects(store.write('fresh', '{"a":2}'));
  kill(null);
  assert.equal(await store.read('fresh'), null);
});

test('a command saved by an earlier version (keystore) is moved over once; Erase removes every trace', async () => {
  const { disk, files } = memory();
  const legacy = new Map([['k', '{"old":true}']]);
  const store = createCommandFiles('d/', files, { read: async (k) => legacy.get(k) ?? null, remove: async (k) => { legacy.delete(k); } });
  assert.equal(await store.read('k'), '{"old":true}');
  assert.equal(legacy.size, 0);
  assert.equal(await store.read('k'), '{"old":true}');
  await store.eraseAll();
  assert.equal(disk.size, 0);
});

/** A keystore read that answers only when the test says so. */
function slowLegacy(entries: Record<string, string>) {
  const legacy = new Map(Object.entries(entries));
  const waiting: (() => void)[] = [];
  let reads = 0;
  return {
    legacy,
    get reads() { return reads; },
    store: {
      // The value as it was when asked, delivered later.
      read: (k: string) => { reads++; const v = legacy.get(k) ?? null; return new Promise<string | null>((resolve) => waiting.push(() => resolve(v))); },
      remove: async (k: string) => { legacy.delete(k); },
    },
    /** Answers the oldest outstanding read. */
    answer: async () => { waiting.shift()?.(); await new Promise((r) => setTimeout(r, 0)); },
  };
}

test('two first reads move the old command over once, and never over a command saved meanwhile', async () => {
  const { files } = memory();
  const slow = slowLegacy({ k: '{"old":true}' });
  const store = createCommandFiles('d/', files, slow.store);
  const first = store.read('k');
  const second = store.read('k');
  await slow.answer();
  assert.equal(await first, '{"old":true}');
  // Settled, then a newer recovery command is saved before the second read finishes.
  store.writeNow('k', null);
  store.writeNow('k', '{"new":true}');
  await slow.answer();
  await second;
  assert.equal(await store.read('k'), '{"new":true}', 'the newer command survives');
  assert.ok(slow.reads <= 1, 'the keystore is read once per key');
});

test('a slot written while the keystore read is outstanding is never overwritten by the old entry', async () => {
  const { files } = memory();
  const slow = slowLegacy({ k: '{"old":true}' });
  const store = createCommandFiles('d/', files, slow.store);
  const reading = store.read('k');
  store.writeNow('k', '{"new":true}');
  await slow.answer();
  await reading;
  assert.equal(await store.read('k'), '{"new":true}');
});

test('clearing a key not moved over yet: the old keystore value never comes back, and leaves the keystore', async () => {
  const { files } = memory();
  const legacy = new Map([['k', '{"old":true}']]);
  const store = createCommandFiles('d/', files, { read: async (k) => legacy.get(k) ?? null, remove: async (k) => { legacy.delete(k); } });
  await store.write('k', null);
  assert.equal(await store.read('k'), null);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(legacy.size, 0);
});

test('a confirmed command leaves no payload on disk', async () => {
  const { disk, files } = memory();
  const store = createCommandFiles('d/', files, none);
  for (let i = 0; i < 3; i++) {
    store.writeNow('k', `{"secret":${i}}`);
    await store.write('k', null);
    assert.ok(![...disk.values()].some((v) => v.includes('secret')), `round ${i}: ${[...disk.values()]}`);
  }
  assert.equal(await store.read('k'), null);
});

test('Erase removes the whole outbox, for keys it was never told about, and a pending move doesn\'t bring it back', async () => {
  const { disk, files } = memory();
  const slow = slowLegacy({ k: '{"old":true}' });
  const store = createCommandFiles('d/', files, slow.store);
  store.writeNow('linked-room-gone-from-registry', '{"a":1}');
  store.writeNow('other', '{"b":1}');
  await store.write('other', null);
  const reading = store.read('k');
  await store.eraseAll();
  slow.legacy.set('k', '{"old":true}');
  await slow.answer();
  assert.equal(await reading, null);
  assert.equal([...disk.keys()].filter((u) => u.startsWith('d/')).length, 0, [...disk.keys()].join());
});
