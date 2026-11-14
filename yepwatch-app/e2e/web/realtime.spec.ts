// The live channel across a gateway restart (restart project only: a stack-wide restart disturbs every room).
// Measured from the moment the restarted gateway answers its health check to the first room snapshot the
// browser receives on a new socket.
//   - a plain restart costs under 1 s;
//   - a handshake that hangs (no answer, no error: a connection lost on the way, as on 2026-11-12 in production)
//     is dropped after 1.5 s and redialed, so it costs about 2.3 s instead of the app's old 10 s give-up.
import { CONTROL, control, eventually, expect, test, type Person, type Room } from '../lib/harness';
import { PLANNED_RESTART_QUIET_MS, QUIET_OUTAGE_MS } from '../../src/core/continuous/backoff';
import { budgetsFor } from '../budgets.mjs';
import { cardTitle, inviteLink, join, readyHost, recordPage, start, vote } from './flows';

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

/** The match count the page shows (the chip's label "1 match", "2 matches"; "Matches" before the first). */
async function shownMatches(p: Person) {
  return p.page.evaluate(() => {
    const yw = (window as unknown as { __yw: { visible(el: Element): boolean } }).__yw;
    const chip = [...document.querySelectorAll('[aria-label]')].find((e) => /^\d+ match(es)?$/.test(e.getAttribute('aria-label') ?? '') && yw.visible(e));
    return chip ? Number.parseInt(chip.getAttribute('aria-label')!, 10) : 0;
  });
}

/**
 * A deploy as Coolify runs it: every old process is stopped one by one, the gateway first, then the API; nothing
 * serves for a while; then the new ones start. Both phones say Yep to the card they share while nothing serves: the
 * votes queue (the front holds their requests), and the match they make must show on both once the room is back.
 */
async function deployLike(room: Room, people: Person[], downMs: number, signal: 'SIGTERM' | 'SIGKILL', quietMs?: number) {
  const titles = await Promise.all(people.map((p) => cardTitle(p)));
  if (new Set(titles).size !== 1) people[0].journeyFailure(`the phones show different cards before the deploy: ${titles.join(' / ')}`);
  if ((await Promise.all(people.map(shownMatches))).some((n) => n !== 0)) people[0].journeyFailure('a match before the deploy');
  const at = Date.now();
  await control(`/stop/gateway?signal=${signal}`);
  await control(`/stop/api?signal=${signal}`);
  for (const p of people) await vote(p, true);
  await sleep(Math.max(0, at + downMs - Date.now()));
  await Promise.all([control('/start/api'), control('/start/gateway')]);
  const back = Date.now();
  room.noteRestart(at, back, `deploy (${signal})`, quietMs);
  return { at, back };
}

/**
 * Each queued vote landed exactly once and within restartQueuedLandMs of the stack's return (every one, not only the
 * first), and the match both made shows on both phones (rendered and in the room).
 */
async function landedOnce(people: Person[], at: number, back: number) {
  const budget = budgetsFor().restartQueuedLandMs;
  for (const p of people) {
    await eventually(() => shownMatches(p), (n) => n === 1, `${p.name} shows the one match the queued votes made`, p, 15000);
    expect(p.latest?.matches?.length, `${p.name}'s room has exactly one match`).toBe(1);
    // The match can reach the page over the live channel before the vote's own HTTP answer does: wait for that.
    const answeredNow = () => p.commandLog.filter((c) => c.t >= at && /\/commands$/.test(c.path) && c.status < 300);
    await eventually(() => answeredNow().length, (n) => n > 0, `${p.name}'s queued vote got its answer`, p, 15000);
    await sleep(500); // a duplicate answer would come right behind it
    const answered = answeredNow();
    expect(answered.length, `${p.name}'s one queued vote was answered once (no resend, no lost vote)`).toBe(1);
    expect(answered[0].t - back, `${p.name}'s queued vote confirmed within ${budget} ms of the stack's return`).toBeLessThanOrEqual(budget);
  }
  const [a, b] = people;
  await eventually(() => [a.latest?.revision, b.latest?.revision], ([x, y]) => x === y, 'both phones on one revision', a, 5000);
}

test.describe('a deploy replaces the gateway and the API', () => {
  test.skip(({ fault }) => fault !== 'restart', 'stack-wide restarts run in the restart project only');

  async function voting(room: Room) {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await start(host, [mia]);
    return [host, mia];
  }

  test('announced (the gateway says restarting): no connection words for 6 s down; queued votes land once and show on both phones', async ({ room }) => {
    const people = await voting(room);
    const stops = await Promise.all(people.map((p) => recordPage(p, 'voting', /Couldn|Try again/i)));
    // The gate holds both phones to the announced restart's quiet period: any connection line in it fails the test.
    const { at, back } = await deployLike(room, people, 6000, 'SIGTERM', PLANNED_RESTART_QUIET_MS);
    await landedOnce(people, at, back);
    for (const [i, stop] of stops.entries()) {
      const samples = await stop();
      expect(samples.some((s) => s.note), `${people[i].name} never showed Reconnecting during an announced restart`).toBe(false);
      expect(samples.some((s) => s.error), `${people[i].name} never showed an error`).toBe(false);
    }
  });

  test('unannounced (processes killed): the same outage still says Reconnecting after 3 s, and recovers', async ({ room }) => {
    const people = await voting(room);
    const stop = await recordPage(people[0], 'voting', /Couldn|Try again/i);
    const { at, back } = await deployLike(room, people, 6000, 'SIGKILL');
    await landedOnce(people, at, back);
    const samples = await stop();
    const first = samples.find((s) => s.note)?.t;
    expect(first, 'a real outage is never hidden: the line showed').toBeDefined();
    expect(first! - at, 'and not before the quiet period').toBeGreaterThanOrEqual(QUIET_OUTAGE_MS);
    // Sampled every 50 ms; a frame or two to render.
    expect(first! - at, 'but as soon as it is over').toBeLessThanOrEqual(QUIET_OUTAGE_MS + 300);
  });

  test('announced but not back within the quiet period: Reconnecting shows then', async ({ room }) => {
    const people = await voting(room);
    const stop = await recordPage(people[0], 'voting', /Couldn|Try again/i);
    const { at, back } = await deployLike(room, people, PLANNED_RESTART_QUIET_MS + 1500, 'SIGTERM', PLANNED_RESTART_QUIET_MS);
    await landedOnce(people, at, back);
    const samples = await stop();
    const first = samples.find((s) => s.note)?.t;
    expect(first, 'an announced restart that runs long still shows the line').toBeDefined();
    expect(first! - at).toBeGreaterThanOrEqual(PLANNED_RESTART_QUIET_MS);
    expect(first! - at).toBeLessThanOrEqual(PLANNED_RESTART_QUIET_MS + 300);
  });
});
