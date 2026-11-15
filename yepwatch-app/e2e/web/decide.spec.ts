import { test, expect, eventually, type Person } from '../lib/harness';
import { cardTitle, inviteLink, join, readyHost, start, vote } from './flows';

const COMMANDS = /\/api\/yepwatch\/v1\/proposal\/rooms\/[^/]+\/commands(?:\?|$)/;
/** Past the 500 ms after a press within which the browser excuses a layout shift. */
const LATE_PROPOSAL_MS = 900;

/** The last Yep that makes a match is timed until the other phones' matches peek shows it. */
async function matchAcross(people: Person[]) {
  const [last, ...others] = [...people].reverse();
  for (let round = 0; round < 15; round++) {
    for (const p of others) await vote(p, true);
    const want = (last.latest?.matches?.length ?? 0) + 1;
    const label = { text: `^${want} match(es)?$` };
    const before = await cardTitle(last);
    await last.tap(last.button('Yep'), {
      repeatable: true,
      expect: { cardChanged: { from: before } },
      moment: 'swipeNextCardMs',
      observers: others.map((p) => [p, { label }, 'voteToPeerMs'] as [Person, { label: { text: string } }, string]),
      timeout: 3000,
      soft: true,
    });
    if ((last.latest?.matches?.length ?? 0) >= want) return;
  }
  last.journeyFailure('no match after 15 rounds of everyone saying Yep');
}

/** A match's I'm in checkbox on Matches ("I'm in for <title>, 1 of 3 in"); `n`: which match. */
const imIn = (p: Person, n = 0) => p.page.getByRole('checkbox', { name: /^I’m in for / }).filter({ visible: true }).nth(n);

test.describe('match, I’m in, Tonight', () => {
  test('match → Matches → I’m in → friends’ I’m in → Tonight → Start again @core', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    const sam = await room.person('Sam', { device: 'desktop', locale: 'en-US' });
    const invite = await inviteLink(host);
    await join(mia, invite, 'Mia', 'Netflix');
    await join(sam, invite, 'Sam', 'Netflix');
    await start(host, [mia, sam]);
    await sam.audit('voting (desktop)');
    await room.point('voting');
    await matchAcross([host, mia, sam]);
    await host.tap(host.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.audit('Matches');
    await room.point('decide');
    // The host stays on Matches (to say which other ones they're in for); the friends get "Someone's in".
    await host.tap(imIn(host), { expect: { text: 'You’re in' }, observers: [[mia, { visible: ['proposal'] }, 'proposeToPeerMs'], [sam, { visible: ['proposal'] }, 'proposeToPeerMs']] });
    await host.audit('Matches, I’m in');
    await mia.audit('Someone’s in');
    await expect(mia.page.getByText(/Alp/)).toHaveCount(0); // never says who
    await mia.tap(mia.button('I’m in'), { expect: { text: 'You’re in|2 of 3 in' } });
    await sam.tap(sam.button('I’m in'), { expect: { visible: ['tonight'] }, observers: [[host, { visible: ['tonight'] }, 'agreeToPeerMs'], [mia, { visible: ['tonight'] }, 'agreeToPeerMs']] });
    await host.audit('Tonight (host)');
    await sam.audit('Tonight (desktop)');
    await expect(host.page.getByRole('link', { name: /^(Watch|Find) on / }).first()).toBeVisible();
    await expect(mia.page.getByText('Alp can start again', { exact: true })).toBeVisible();
    // Restart the round.
    await host.tap(host.button('Start again'), { expect: { visible: ['room-setup'] }, observers: [[mia, { visible: ['waiting'] }, 'restartToPeerMs']] });
    await eventually(() => host.latest?.phase, (p) => p === 'setup', 'room back in setup', host);
    // A beat to reach Start, as people need: with no Ready hold the friends' room screen lasts exactly
    // until the round arrives, so a Start within ~150 ms of Start again would show it for less than a flash.
    await host.page.waitForTimeout(300);
    await start(host, [mia, sam]);
    await eventually(() => host.latest?.generation, (g) => (g ?? 0) >= 1, 'a new round (generation advanced)', host);
  });

  // CI run 43605791062 (1 in 10): the proposal came back 550 ms after the press, past the 500 ms a press excuses,
  // and Matches moved under it. Here the I'm in always comes back late; the layout-shift gate judges Matches,
  // which shows "You're in" at once and holds still until the server's answer.
  test('the I’m in comes back late: Matches holds still', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    await matchAcross([host, mia]);
    await host.tap(host.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.page.route(COMMANDS, async (route) => {
      if (route.request().method() === 'POST' && /"type":"set_in"/.test(route.request().postData() ?? '')) await new Promise((resolve) => setTimeout(resolve, LATE_PROPOSAL_MS));
      await route.continue().catch(() => undefined);
    });
    await host.tap(imIn(host), { expect: { text: 'You’re in' }, timeout: 15000 });
    await eventually(() => host.latest?.proposal ?? null, (v) => v !== null, 'the I’m in arrived', host, 15000);
    await host.page.waitForTimeout(500);
    await host.harvest();
    expect(host.recordings.at(-1)?.shifts ?? [], 'no layout shift while the I’m in arrives').toEqual([]);
    await expect(host.testId('matches')).toBeVisible();
  });

  test('Keep swiping sets a friend’s I’m in aside; Matches counts it on its row', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    await matchAcross([host, mia]);
    await host.tap(host.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.tap(imIn(host), { expect: { text: 'You’re in' }, observers: [[mia, { visible: ['proposal'] }, 'proposeToPeerMs']] });
    await mia.tap(mia.button('Keep swiping'), { expect: { visible: ['voting'] } });
    await mia.tap(mia.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await expect(mia.page.getByRole('checkbox', { name: /, 1 of 2 in$/ }).filter({ visible: true })).toHaveCount(1);
    await mia.audit('Matches with a friend’s I’m in');
    // The host takes it back: nobody is in any more.
    await host.tap(imIn(host), { expect: {} });
    await eventually(() => (host.latest?.proposal as { agreeCount: number } | null)?.agreeCount ?? 0, (n) => n === 0, 'I’m in taken back', host);
  });
  // Everyone in for two titles: multi-select on Matches, then the tiebreak. The server decides the first title
  // everyone's in for at once, so two become everyone's together only when the room shrinks: Sam leaves.
  test('everyone in for two → tiebreak → favorites → the spin → Tonight', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    const sam = await room.person('Sam');
    const invite = await inviteLink(host);
    await join(mia, invite, 'Mia', 'Netflix');
    await join(sam, invite, 'Sam', 'Netflix');
    await start(host, [mia, sam]);
    await matchAcross([host, mia, sam]);
    await matchAcross([host, mia, sam]);
    for (const p of [host, mia, sam]) await p.tap(p.button(/^\d+ matches$/), { expect: { visible: ['matches'] } });
    // Every tap is its own I'm in; a friend's I'm in keeps everyone on Matches, counted on its row.
    await host.tap(imIn(host, 0), { expect: { label: { text: ', 1 of 3 in$' } }, observers: [[mia, { label: { text: ', 1 of 3 in$' } }, 'inToPeerMs']] });
    await host.tap(imIn(host, 1), { expect: { label: { text: ', 1 of 3 in$' } } });
    await mia.tap(imIn(mia, 0), { expect: { label: { text: ', 2 of 3 in$' } } });
    await mia.tap(imIn(mia, 1), { expect: { label: { text: ', 2 of 3 in$' } }, observers: [[sam, { label: { text: ', 2 of 3 in$' } }, 'inToPeerMs']] });
    await expect(host.page.getByRole('checkbox', { name: /, 2 of 3 in$/, checked: true }).filter({ visible: true })).toHaveCount(2);
    await expect(sam.testId('matches')).toBeVisible();
    await mia.audit('Matches, in for two');
    // Sam leaves: the two left are in for both, and the tiebreak opens by itself on their phones.
    await sam.tap(sam.button(/, switch couch$/));
    await sam.tap(sam.button(/, Couch page$/), { expect: { visible: ['room-sheet'] } });
    await sam.tap(sam.button('Leave couch'));
    await sam.tap(sam.button('Leave'), { expect: { visible: ['home-rooms'] }, observers: [[host, { visible: ['tiebreak'] }, 'tiebreakToPeerMs'], [mia, { visible: ['tiebreak'] }, 'tiebreakToPeerMs']], timeout: 15000 });
    await host.audit('Tiebreak');
    // Favorites wait for everyone; different picks tie, so the server's spin decides and the room goes to Tonight.
    await host.tap(host.page.getByRole('radio', { name: /, my favorite$/ }).filter({ visible: true }).nth(0), { expect: { text: 'Waiting for 1 more pick' } });
    await mia.tap(mia.page.getByRole('radio', { name: /, my favorite$/ }).filter({ visible: true }).nth(1), { expect: { visible: ['tonight'] }, observers: [[host, { visible: ['tonight'] }, 'favoriteToPeerMs']], timeout: 20000 });
    await eventually(() => host.latest?.phase, (p) => p === 'decided', 'the room decided', host);
    const tiebreak = host.latest?.tiebreak as { outcome: { candidateId: string; spun: boolean } | null } | null | undefined;
    const decision = host.latest?.decision as { candidateId: string } | null | undefined;
    expect(tiebreak?.outcome?.spun, 'tied favorites spin').toBe(true);
    expect(decision?.candidateId, 'Tonight is the spin’s pick').toBe(tiebreak?.outcome?.candidateId);
    await host.audit('Tonight after the tiebreak');
  });
});
