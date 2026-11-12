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
  await store.erase('k');
  assert.equal(disk.size, 0);
});
