import { test, expect, eventually, type Person } from '../lib/harness';
import { createRoom, hostName, inviteLink, join, pickServices, readyHost, start, vote, voteUntilMatch } from './flows';

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

/** Joins a running round from the invitation (lands straight in voting). */
async function joinLate(p: Person, invite: string, name: string) {
  await p.open(invite, { settle: false });
  await p.see({ visible: ['join-screen', 'invite-head'] }, 15000, 'invitation join page');
  await p.fill(p.page.getByLabel('Your name').filter({ visible: true }), name);
  await p.tap(p.button('Join'), { expect: { visible: ['services-sheet'] } });
  await pickServices(p, ['HBO Max']);
  await p.see({ visible: ['voting', 'poster'] }, 15000, `${name} lands in the running round`);
}

/** The voting bar's parts on screen: the chip (and whether its text is cut), the faces, "+N" and Undo. */
const bar = (p: Person) => p.page.evaluate(() => {
  const root = [...document.querySelectorAll('[data-testid="voting-bar"]')].find((e) => (e as HTMLElement).offsetParent !== null)!;
  const rect = (e: Element | null | undefined) => { if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; };
  const labelled = [...root.querySelectorAll('[aria-label]')].filter((e) => (e as HTMLElement).offsetParent !== null);
  const chip = labelled.find((e) => /^(Matches|\d+ match(es)?)$/.test(e.getAttribute('aria-label') ?? ''));
  const text = chip ? [...chip.querySelectorAll('div, span')].find((e) => /match|^\d+$/i.test(e.textContent ?? '') && !e.querySelector('div, span')) as HTMLElement | undefined : undefined;
  const undo = labelled.find((e) => e.getAttribute('aria-label') === 'Undo');
  const more = labelled.find((e) => /^and \d+ more$/.test(e.getAttribute('aria-label') ?? ''));
  const faces = labelled.filter((e) => e !== chip && e !== undo && e !== more);
  return {
    window: window.innerWidth,
    bar: rect(root),
    chip: { label: chip?.getAttribute('aria-label'), text: text?.textContent, cut: text ? text.scrollWidth > text.clientWidth + 0.5 : null, ...rect(chip) },
    faces: faces.map((e) => ({ label: e.getAttribute('aria-label'), ...rect(e) })),
    more: more ? { label: more.getAttribute('aria-label'), text: more.textContent, ...rect(more) } : null,
    undo: rect(undo),
  };
});
type Bar = Awaited<ReturnType<typeof bar>>;
/** Everything inside the bar, the bar inside the window, nothing overlapping its neighbour. */
function fits(b: Bar, what: string) {
  expect(b.bar!.right, `${what}: bar inside the window`).toBeLessThanOrEqual(b.window);
  expect(b.undo!.right, `${what}: Undo inside the bar`).toBeLessThanOrEqual(b.bar!.right + 0.5);
  expect(b.chip.cut, `${what}: the chip's label is whole`).toBe(false);
  const facesLeft = Math.min(...b.faces.map((f) => f.left!), b.more?.left ?? Infinity, b.undo!.left);
  const facesRight = Math.max(...b.faces.map((f) => f.right!), b.more?.right ?? -Infinity);
  expect(b.chip.right!, `${what}: the chip ends before the faces`).toBeLessThanOrEqual(facesLeft + 0.5);
  if (b.faces.length) expect(facesRight, `${what}: the faces end before Undo`).toBeLessThanOrEqual(b.undo!.left + 0.5);
}

test('at 320 px the voting bar fits with 2 and 6 people, and people joining never shift it', async ({ room }) => {
  const host = await room.person('Alp');
  await host.page.setViewportSize({ width: 320, height: 844 });
  await createRoom(host);
  await hostName(host, 'Alp');
  await pickServices(host, ['Netflix'], () => host.tap(host.button('Streaming services, add'), { expect: { visible: ['services-sheet'] } }));
  const invite = await inviteLink(host);
  const mia = await room.person('Mia');
  await mia.page.setViewportSize({ width: 320, height: 844 });
  await join(mia, invite, 'Mia');
  await start(host, [mia]);
  await voteUntilMatch([host, mia]);

  // Two people: both faces, no "+N", the "1 match" chip and Undo all fit.
  for (const p of [host, mia]) {
    const b = await eventually(() => bar(p), (v) => v.faces.length === 2 && /match/.test(v.chip.label ?? ''), `${p.name}: two faces and a match`, p);
    fits(b, `${p.name}, 2 people`);
    expect(b.more).toBeNull();
  }
  await host.page.getByTestId('voting-bar').filter({ visible: true }).screenshot({ path: room.info.outputPath('bar-320-2-people.png') });
  const before = { host: (await shifts(host)).length, mia: (await shifts(mia)).length };

  // Four more arrive during voting: two face slots at 320 px (the chip keeps the proposal dot's room), the rest in "+N".
  for (const name of ['Sam', 'Lea', 'Kai', 'Noa']) await joinLate(await room.person(name), invite, name);
  for (const p of [host, mia]) {
    const b = await eventually(() => bar(p), (v) => v.more?.label === 'and 4 more', `${p.name}: two faces and "and 4 more"`, p);
    fits(b, `${p.name}, 6 people`);
    expect(b.faces).toHaveLength(2);
    expect(b.more!.text).toBe('+4');
  }
  await host.page.getByTestId('voting-bar').filter({ visible: true }).screenshot({ path: room.info.outputPath('bar-320-6-people.png') });
  await host.page.waitForTimeout(500);
  for (const [p, from] of [[host, before.host], [mia, before.mia]] as const) {
    expect((await shifts(p)).slice(from), `${p.name}: layout shifts while four people joined`).toEqual([]);
  }
});
