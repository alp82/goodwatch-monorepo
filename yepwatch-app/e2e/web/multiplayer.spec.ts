import { test, expect, eventually, type Person } from '../lib/harness';
import { inviteLink, join, pickServices, readyHost, start, vote, voteUntilMatch } from './flows';

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

/** Layout shifts this page recorded so far (no recent input), with their sources. */
const shifts = (p: Person) => p.page.evaluate(() => (window as unknown as { __yw: { shifts: { value: number; sources: unknown[] }[] } }).__yw.shifts);
/** The faces in the voting bar, by accessible label. */
const faces = (p: Person) => p.page.evaluate(() => [...document.querySelectorAll('[data-testid="voting-bar"] [aria-label]')]
  .filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute('aria-label') ?? ''));

test('a third person joins, votes and leaves during voting: the voting bar never shifts', async ({ room }) => {
  const host = await readyHost(room, 'Alp');
  const invite = await inviteLink(host);
  const mia = await room.person('Mia');
  await join(mia, invite, 'Mia');
  await start(host, [mia]);
  await vote(host, false);
  await vote(mia, true);
  const before = { host: (await shifts(host)).length, mia: (await shifts(mia)).length };

  // Sam arrives while the others are voting.
  const sam = await room.person('Sam');
  await sam.open(invite, { settle: false });
  await sam.see({ visible: ['join-screen', 'invite-head'] }, 15000, 'invitation join page');
  await sam.fill(sam.page.getByLabel('Your name').filter({ visible: true }), 'Sam');
  await sam.tap(sam.button('Join'), { expect: { visible: ['services-sheet'] } });
  await pickServices(sam, ['HBO Max']);
  await sam.see({ visible: ['voting', 'poster'] }, 15000, 'Sam lands in the running round');
  for (const p of [host, mia]) await eventually(() => faces(p), (v) => v.some((l) => l.startsWith('Sam')), `${p.name} sees Sam's face`, p);

  // Everyone answers a card; the faces react, nothing moves.
  await vote(sam, true);
  await vote(host, true);
  await vote(mia, false);

  // Sam leaves through the room page.
  const visible = (name: string | RegExp) => sam.page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).first();
  await visible(/, switch room$/).click();
  await visible(/, Room page$/).click();
  await visible('Leave room').click();
  await visible('Leave').click();
  for (const p of [host, mia]) await eventually(() => faces(p), (v) => !v.some((l) => l.startsWith('Sam')), `${p.name} sees Sam go`, p);
  await host.page.waitForTimeout(800);

  for (const [p, from] of [[host, before.host], [mia, before.mia]] as const) {
    const late = (await shifts(p)).slice(from);
    expect(late, `${p.name}: layout shifts while Sam joined, voted and left`).toEqual([]);
  }
});
