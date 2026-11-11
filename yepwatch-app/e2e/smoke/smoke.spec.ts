// Production smoke (guests only): one room, one friend through the invite link, a few votes.
// Creates one real room per run on the target; keep it to this.
import { test } from '../lib/harness';
import { inviteLink, join, readyHost, start, vote } from '../web/flows';

test('smoke: guest creates a room, a friend joins by link, both vote', async ({ room }) => {
  const host = await readyHost(room, 'Smoke host', 'smoke test');
  await host.audit('room page');
  const friend = await room.person('Smoke friend');
  await join(friend, await inviteLink(host), 'Smoke friend', 'Netflix');
  await start(host, [friend]);
  for (let i = 0; i < 3; i++) { await vote(host, false); await vote(friend, false); }
});
