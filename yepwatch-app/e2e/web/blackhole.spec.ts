// A network that drops every packet silently, then comes back (production smoke, 2026-11-14 05:39: the runner's line
// lost its route for 12 s; no error, no close, navigator.onLine stayed true). One phone sits behind the hole
// (lib/blackhole.ts models TCP: what was sent meanwhile arrives at its sender's next retransmission, a new connection
// at its next SYN retry), says Yep while nothing gets through, and once packets flow again:
//   - "Reconnecting…" (it showed: the outage lasted past the 3 s quiet period) is gone within 1 s,
//   - the live channel is back and the queued vote landed once.
// Two places the hole can hit: a live channel with nothing in flight (it never notices), and a socket whose upgrade
// went out but whose answer never came back (the gateway drops it unauthenticated after 3 s; the app sees a hung
// handshake), as in the incident.
import { expect, eventually, test, type Person } from '../lib/harness';
import { Blackhole } from '../lib/blackhole';
import { budgetsFor } from '../budgets.mjs';
import { inviteLink, join, readyHost, recordPage, start, vote } from './flows';

/**
 * How long the hole lasts: the incident's 12 s, and 17.5 s. Before 2026-11-14 the channel's dials grew sparse in an
 * outage (open waits 1.5-3-6-10 s plus backoff), so the return met a socket dialed ~12.5 s in, whose next SYN retry
 * came at 19.5 s: "Reconnecting…" stayed 2.2-2.4 s after the network was back.
 */
const HOLES = { live: [12000], handshake: [12000, 17500] } as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

test.describe('a network that drops packets silently', () => {
  test.skip(({ fault }) => fault !== 'none', 'the hole is this test’s own fault');

  for (const where of ['live', 'handshake'] as const) for (const HOLE_MS of HOLES[where]) {
    test(`${HOLE_MS / 1000} s ${where === 'live' ? 'on a live channel' : 'during a socket’s handshake'}: Reconnecting is gone within 1 s of the network’s return`, async ({ room }) => {
      const hole = new Blackhole();
      try {
        const host = await readyHost(room, 'Alp', undefined, { network: hole });
        const mia = await room.person('Mia');
        await join(mia, await inviteLink(host), 'Mia');
        await start(host, [mia]);
        const received = snapshots(host);
        const wsLog: { t: number; what: string }[] = [];
        host.page.on('websocket', (ws) => {
          wsLog.push({ t: Date.now(), what: 'dial' });
          ws.on('framesent', (f) => wsLog.push({ t: Date.now(), what: `sent ${String(f.payload).match(/"type":"([a-z._]+)"/)?.[1]}` }));
          ws.on('framereceived', (f) => wsLog.push({ t: Date.now(), what: `got ${String(f.payload).match(/"type":"([a-z._]+)"/)?.[1]}` }));
          ws.on('socketerror', (e) => wsLog.push({ t: Date.now(), what: `error ${e}` }));
          ws.on('close', () => wsLog.push({ t: Date.now(), what: 'close' }));
        });
        if (where === 'handshake') {
          // A reload dials a fresh socket; the hole opens right behind its upgrade request, so the gateway takes the
          // upgrade and its answer is lost (Traefik's 3511 ms "realtime 0" entry at 05:39:11.647).
          hole.dropAfterUpgrade();
          await host.reload();
          await host.see({ visible: ['voting'] }, 15000, 'voting after reload');
          await eventually(() => hole.open, (v) => v, 'the hole opened behind the socket’s upgrade', host, 10000);
        } else {
          hole.drop();
        }
        const at = hole.openedAt;
        const stop = await recordPage(host, 'voting', /Couldn|Try again/i);
        await sleep(1000);
        await vote(host, true);
        await sleep(Math.max(0, at + HOLE_MS - Date.now()));
        hole.restore();
        const back = hole.closedAt;
        room.noteOutage(at, back);
        const live = await (async () => {
          const end = Date.now() + 10000;
          while (Date.now() < end) {
            const hit = received.find((t) => t > back);
            if (hit) return hit;
            await sleep(20);
          }
          return null;
        })();
        await sleep(1500);
        const samples = await stop();
        // What happened around the hole, for a failure's message (paths without ids).
        const rel = (t: number) => `${((t - back) / 1000).toFixed(2)} s`;
        const timeline = [
          `line: ${samples.filter((s, i) => i === 0 || s.note !== samples[i - 1].note).map((s) => `${rel(s.t)} ${s.note ? 'shown' : 'gone'}`).join(', ')}; live snapshot ${live ? rel(live) : 'never'}`,
          ...host.requests.filter((r) => r.t >= at - 1000 && /\/api\//.test(r.url)).map((r) => `${rel(r.t)} → ${r.end ? rel(r.end) : '…'} ${r.method} ${r.url.replace(/^https?:\/\/[^/]+/, '').replace(/[A-Za-z0-9_-]{20,}/g, ':id')} ${r.status ?? r.error ?? ''}`),
          ...wsLog.map((w) => `${rel(w.t)} socket ${w.what}`),
          ...hole.log.filter(([t]) => t >= at - 1000).map(([t, what]) => `${rel(t)} ${what}`),
        ].join('\n  ');
        const shown = samples.filter((s) => s.note);
        if (where === 'handshake') expect(shown.length, `the outage lasted past the quiet period, so the line showed\n  ${timeline}`).toBeGreaterThan(0);
        const lastShown = shown.length ? shown[shown.length - 1].t : 0;
        const goneMs = shown.length ? Math.max(0, samples.find((s) => s.t > lastShown)!.t - back) : 0;
        host.record('blackholeLineGoneMs', goneMs, `network back → Reconnecting gone (${HOLE_MS / 1000} s hole, ${where})`);
        if (live) host.record('blackholeLiveMs', live - back, `network back → live snapshot (${HOLE_MS / 1000} s hole, ${where})`);
        // A live socket with nothing to send never noticed the hole; one that was connecting must connect again.
        if (where === 'handshake') expect(live, `the live channel is back within 10 s of the network\n  ${timeline}`).not.toBeNull();
        expect(samples.some((s) => s.error), 'no error on the page').toBe(false);
        expect(goneMs, `Reconnecting gone within ${budgetsFor().connectionWordsAfterMs} ms of the network’s return\n  ${timeline}`).toBeLessThanOrEqual(budgetsFor().connectionWordsAfterMs);
        const votes = () => host.commandLog.filter((c) => c.t >= at && /\/commands$/.test(c.path) && c.status < 300).length;
        await eventually(votes, (n) => n > 0, 'the vote made in the hole was answered', host, 15000);
        await sleep(500);
        expect(votes(), 'the vote made in the hole was answered once').toBe(1);
      } finally {
        await hole.close();
      }
    });
  }
});
