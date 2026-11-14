// The live channel across a gateway restart (restart project only: a stack-wide restart disturbs every room).
// Measured from the moment the restarted gateway answers its health check to the first room snapshot the
// browser receives on a new socket.
//   - a plain restart costs under 1 s;
//   - a handshake that hangs (no answer, no error: a connection lost on the way, as on 2026-11-12 in production)
//     is dropped after 1.5 s and redialed, so it costs about 2.3 s instead of the app's old 10 s give-up.
import { CONTROL, control, eventually, expect, test, type Person } from '../lib/harness';
import { PLANNED_RESTART_QUIET_MS, QUIET_OUTAGE_MS } from '../../src/core/continuous/backoff';
import { inviteLink, join, readyHost, recordPage, start, vote } from './flows';

/** Epoch ms of every room snapshot frame this person's page receives. */
function snapshots(p: Person) {
  const at: number[] = [];
  p.page.on('websocket', (ws) => {
    ws.on('framereceived', ({ payload }) => {
      const text = typeof payload === 'string' ? payload : payload.toString('utf8');
      if (text.startsWith('{"type":"room.snapshot"')) at.push(Date.now());
    });
  });
  return at;
}
async function firstAfter(at: number[], t: number, timeout: number) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const hit = at.find((x) => x > t);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 20));
  }
  return null;
}

test.describe('live channel after a gateway restart', () => {
  test.skip(({ fault }) => fault !== 'restart', 'stack-wide restarts run in the restart project only');

  for (const stall of [0, 1]) {
    test(stall ? 'a hung handshake after the restart is redialed within 2.8 s' : 'a gateway restart costs under 1 s', async ({ room }) => {
      const host = await readyHost(room);
      const received = snapshots(host);
      // A snapshot on the current socket proves the channel is live before the restart. Through the harness: the
      // reload harvests the room-creation recording first, so its gates still apply.
      await host.reload();
      await host.see({ visible: ['room-setup'] }, 15000, 'room page after reload');
      if (!(await firstAfter(received, 0, 10000))) host.journeyFailure('no live snapshot before the restart');
      if (stall) await control('/faults', { wsStall: stall });
      const at = Date.now();
      await control('/restart/gateway?downMs=0');
      const back = Date.now();
      const live = await firstAfter(received, at, 20000);
      // The stall must have been hit (it looks at the first chunk of each connection), or this measured nothing.
      const left = ((await (await fetch(`${CONTROL}/status`)).json()) as { faults: { wsStall: number } }).faults.wsStall;
      await control('/faults', { wsStall: 0 });
      if (left !== 0) host.journeyFailure(`the hung-handshake fault was never hit (${left} left)`);
      room.noteOutage(at, live ?? Date.now());
      if (!live) host.journeyFailure('no room snapshot within 20 s of the gateway restart');
      const ms = live! - back;
      host.record(stall ? 'gatewayRestartStalledHandshakeMs' : 'gatewayRestartLiveMs', ms, `gateway back → snapshot (restart took ${back - at} ms)`);
      const budget = stall ? 2800 : 1000;
      if (ms > budget) host.journeyFailure(`live again ${ms} ms after the gateway was back (budget ${budget} ms)`);
    });
  }
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A deploy as Coolify runs it: every old process is stopped one by one, the gateway first (compose.yaml: created last,
 * so removed first), then the API; nothing serves for a while; then the new ones start. Votes cast meanwhile queue
 * (the front holds their requests) and must reach the other phone once the room is live again.
 */
async function deployLike(people: Person[], downMs: number, signal: 'SIGTERM' | 'SIGKILL') {
  const at = Date.now();
  await control(`/stop/gateway?signal=${signal}`);
  await control(`/stop/api?signal=${signal}`);
  // Each phone answers a card while nothing serves.
  for (const p of people) await vote(p, true);
  await sleep(Math.max(0, at + downMs - Date.now()));
  await Promise.all([control('/start/api'), control('/start/gateway')]);
  return { at, back: Date.now() };
}

/**
 * Both phones on one revision again, at least one revision per queued vote past `before` (every committed vote is a
 * new room revision): each vote landed and its effect reached both phones.
 */
async function converged(people: Person[], before: number) {
  const [a, b] = people;
  await eventually(
    () => ({ a: a.latest?.revision ?? -1, b: b.latest?.revision ?? -1 }),
    (v) => v.a === v.b && v.a >= before + people.length,
    `both phones on one revision, at least ${people.length} past ${before}`,
    a,
    15000,
  );
}
const revision = (people: Person[]) => Math.max(...people.map((p) => p.latest?.revision ?? -1));

test.describe('a deploy replaces the gateway and the API', () => {
  test.skip(({ fault }) => fault !== 'restart', 'stack-wide restarts run in the restart project only');

  test('announced (gateway stops first, says restarting): no connection words for 6 s down; queued votes reach the other phone', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await start(host, [mia]);
    const people = [host, mia];
    const stops = await Promise.all(people.map((p) => recordPage(p, 'voting', /Couldn|Try again/i)));
    const before = revision(people);
    const { at, back } = await deployLike(people, 6000, 'SIGTERM');
    // The gate holds both phones to the announced restart's quiet period: any connection line in it fails the test.
    room.noteOutage(at, back, PLANNED_RESTART_QUIET_MS);
    await converged(people, before);
    host.record('deployLiveAgainMs', Date.now() - back, 'stack back → both phones converged');
    for (const [i, stop] of stops.entries()) {
      const samples = await stop();
      expect(samples.some((s) => s.note), `${people[i].name} never showed Reconnecting during an announced restart`).toBe(false);
      expect(samples.some((s) => s.error), `${people[i].name} never showed an error`).toBe(false);
    }
  });

  test('unannounced (processes killed): the same outage still says Reconnecting after 3 s, and recovers', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await start(host, [mia]);
    const people = [host, mia];
    const stop = await recordPage(host, 'voting', /Couldn|Try again/i);
    const before = revision(people);
    const { at, back } = await deployLike(people, 6000, 'SIGKILL');
    room.noteOutage(at, back);
    await converged(people, before);
    const samples = await stop();
    const first = samples.find((s) => s.note)?.t;
    expect(first, 'a real outage is never hidden: the line showed').toBeDefined();
    expect(first! - at, 'and not before the quiet period').toBeGreaterThanOrEqual(QUIET_OUTAGE_MS);
  });

  test('announced but not back within the quiet period: Reconnecting shows then', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await start(host, [mia]);
    const people = [host, mia];
    const stop = await recordPage(host, 'voting', /Couldn|Try again/i);
    const before = revision(people);
    const { at, back } = await deployLike(people, PLANNED_RESTART_QUIET_MS + 3000, 'SIGTERM');
    room.noteOutage(at, back, PLANNED_RESTART_QUIET_MS);
    await converged(people, before);
    const samples = await stop();
    const first = samples.find((s) => s.note)?.t;
    expect(first, 'an announced restart that runs long still shows the line').toBeDefined();
    expect(first! - at).toBeGreaterThanOrEqual(PLANNED_RESTART_QUIET_MS);
    expect(first! - at).toBeLessThan(PLANNED_RESTART_QUIET_MS + 1500);
  });
});
