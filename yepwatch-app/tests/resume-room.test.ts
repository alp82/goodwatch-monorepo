import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { RoomFailure } from '../src/core/continuous/api-client';
import { resumeRoom, type ResumeDeps } from '../src/core/continuous/resume-room';
import { bootPage } from '../src/features/home/boot-phase';
import { continuousFixture } from './continuous-fixture';

const NOW = Date.now();
const access = { roomId: 'test-room', participantId: 'p1', token: 't', expiresAt: NOW + 60_000 };

function deps(patch: Partial<ResumeDeps> & { snap?: RoomSnapshot | Error } = {}) {
  const log = { forgot: 0, adopted: [] as RoomSnapshot[], reads: 0 };
  const snap = patch.snap ?? continuousFixture();
  const d: ResumeDeps = {
    loadFront: async () => 'test-room',
    forget: async () => { log.forgot++; },
    loadAccess: async () => access,
    snapshot: async () => { log.reads++; if (snap instanceof Error) throw snap; return snap; },
    adopt: (s) => { log.adopted.push(s); },
    now: () => NOW,
    ...patch,
  };
  return { d, log };
}

test('a launch goes back to the room in front while it is still going, with the room already loaded', async () => {
  for (const phase of ['setup', 'choosing'] as const) {
    const fixture = continuousFixture();
    fixture.shared.phase = phase;
    const { d, log } = deps({ snap: fixture });
    assert.equal(await resumeRoom(d), 'test-room');
    assert.deepEqual(log.adopted, [fixture]);
    assert.equal(log.forgot, 0);
  }
});

test('nothing in front, or no place in it on this device: the start page, without a room read', async () => {
  let r = deps({ loadFront: async () => null });
  assert.equal(await resumeRoom(r.d), null);
  assert.equal(r.log.reads, 0);
  r = deps({ loadAccess: async () => null });
  assert.equal(await resumeRoom(r.d), null);
  assert.equal(r.log.forgot, 1);
  r = deps({ loadAccess: async () => ({ ...access, expiresAt: NOW - 1 }) });
  assert.equal(await resumeRoom(r.d), null);
  assert.equal(r.log.reads, 0);
});

test('decided, expired or left rooms, and refused places, lead to the start page and are forgotten', async () => {
  const decided = continuousFixture(); decided.shared.phase = 'decided';
  const expired = continuousFixture(); expired.shared.expiresAt = NOW - 1;
  const left = continuousFixture(); left.own.left = true;
  for (const snap of [decided, expired, left, new RoomFailure('unauthorized', 'no'), new RoomFailure('not_found', 'gone')]) {
    const { d, log } = deps({ snap });
    assert.equal(await resumeRoom(d), null);
    assert.equal(log.forgot, 1);
    assert.equal(log.adopted.length, 0);
  }
});

test('a check that cannot reach the server still goes back to the room', async () => {
  for (const snap of [new TypeError('Network request failed'), new RoomFailure('unavailable', 'restarting'), Object.assign(new Error('aborted'), { name: 'AbortError' })]) {
    const { d, log } = deps({ snap });
    assert.equal(await resumeRoom(d), 'test-room');
    assert.equal(log.forgot, 0);
    assert.equal(log.adopted.length, 0);
  }
});

test('startup waits for the start page, invitations and rooms; other pages show at once', () => {
  assert.equal(bootPage('/'), 'home');
  assert.equal(bootPage('/r/ABC123'), 'invite:ABC123');
  assert.equal(bootPage('/room/xyz'), 'room:xyz');
  assert.equal(bootPage('/room/xyz/matches'), 'room:xyz');
  for (const path of ['/new', '/privacy', '/auth/callback', '/r/ABC/extra']) assert.equal(bootPage(path), null);
});
