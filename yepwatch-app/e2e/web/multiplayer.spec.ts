import { test, eventually } from '../lib/harness';
import { inviteLink, join, readyHost, start, voteUntilMatch } from './flows';

test('three people: invite, join, start, vote to a match', async ({ room }) => {
  const host = await readyHost(room);
  const invite = await inviteLink(host);
  const mia = await room.person('Mia');
  const sam = await room.person('Sam', { locale: 'en-US' });
  await join(mia, invite, 'Mia', 'Disney+');
  await join(sam, invite, 'Sam', 'HBO Max');
  await room.point('room');
  await start(host, [mia, sam]);
  await room.point('voting');
  await voteUntilMatch([host, mia, sam]);
});
