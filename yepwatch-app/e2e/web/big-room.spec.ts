import { test, eventually, type Person } from '../lib/harness';
import { inviteLink, join, readyHost, start, vote } from './flows';

test('six people (five phones + desktop): deck refill and Matches', async ({ room }) => {
  test.slow();
  const host = await readyHost(room);
  const invite = await inviteLink(host);
  const names = ['Mia', 'Sam', 'Ana', 'Ben', 'Dee'];
  const friends: Person[] = [];
  for (const [i, name] of names.entries()) {
    const p = await room.person(name, { device: i === names.length - 1 ? 'desktop' : 'phone' });
    await join(p, invite, name, 'Netflix');
    friends.push(p);
  }
  await eventually(() => host.latest?.participants.length, (n) => n === 6, 'six people in the room', host);
  await room.point('room');
  await start(host, friends);
  await room.point('voting');
  const everyone = [host, ...friends];
  const first = (host.latest?.candidates as unknown[] | undefined)?.length ?? 0;
  // Everyone says Yep to the first cards (matches), then keeps going past the first deck page (refill).
  for (let i = 0; i < Math.max(first, 10) + 2; i++) await Promise.all(everyone.map((p) => vote(p, i < 3)));
  await eventually(() => host.latest?.matches?.length ?? 0, (n) => n >= 1, 'matches with six people', host, 15000);
  await eventually(() => (host.latest?.candidates as unknown[] | undefined)?.length ?? 0, (n) => n > first, 'the deck refilled', host, 20000);
  for (const p of everyone) await p.tap(p.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
  await friends[4].audit('Matches (desktop, six people)');
});
