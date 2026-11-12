// The live channel across a gateway restart (restart project only: a stack-wide restart disturbs every room).
// Measured from the moment the restarted gateway answers its health check to the first room snapshot the
// browser receives on a new socket.
//   - a plain restart costs under 1 s;
//   - a handshake that hangs (no answer, no error: a connection lost on the way, as on 2026-11-12 in production)
//     is dropped after 1.5 s and redialed, so it costs about 2.3 s instead of the app's old 10 s give-up.
import { control, test, type Person } from '../lib/harness';
import { readyHost } from './flows';

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
      // A snapshot on the current socket proves the channel is live before the restart.
      await host.page.reload();
      await host.see({ visible: ['room-setup'] }, 15000, 'room page after reload');
      if (!(await firstAfter(received, 0, 10000))) host.journeyFailure('no live snapshot before the restart');
      if (stall) await control('/faults', { wsStall: stall });
      const at = Date.now();
      await control('/restart/gateway?downMs=0');
      const back = Date.now();
      const live = await firstAfter(received, at, 20000);
      await control('/faults', { wsStall: 0 });
      room.noteOutage(at, live ?? Date.now());
      if (!live) host.journeyFailure('no room snapshot within 20 s of the gateway restart');
      const ms = live! - back;
      host.record(stall ? 'gatewayRestartStalledHandshakeMs' : 'gatewayRestartLiveMs', ms, `gateway back → snapshot (restart took ${back - at} ms)`);
      const budget = stall ? 2800 : 1000;
      if (ms > budget) host.journeyFailure(`live again ${ms} ms after the gateway was back (budget ${budget} ms)`);
    });
  }
});
