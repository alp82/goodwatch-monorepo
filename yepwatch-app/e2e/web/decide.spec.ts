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
  test('match → Matches → everyone’s I’m in → Watch → Tonight → Start again @core', async ({ room }) => {
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
    for (const p of [host, mia, sam]) await p.tap(p.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.audit('Matches');
    await room.point('decide');
    // Every I'm in counts on the match; nobody's screen is taken over and nothing is decided by a tap.
    await host.tap(imIn(host), { expect: { text: 'You’re in' }, observers: [[mia, { label: { text: ', 1 of 3 in$' } }, 'inToPeerMs'], [sam, { label: { text: ', 1 of 3 in$' } }, 'inToPeerMs']] });
    await host.audit('Matches, I’m in');
    await expect(mia.page.getByText(/Alp/)).toHaveCount(0); // never says who
    await mia.tap(imIn(mia), { expect: { label: { text: ', 2 of 3 in$' } } });
    await sam.tap(imIn(sam), { expect: { text: 'Everyone’s in on ' }, observers: [[host, { text: 'Everyone’s in on ' }, 'inToPeerMs'], [mia, { text: 'Everyone’s in on ' }, 'inToPeerMs']] });
    await mia.audit('Matches, everyone’s in');
    await host.page.waitForTimeout(500);
    expect(host.latest?.phase, 'taps alone decide nothing').toBe('choosing');
    // Any one of them taps Watch: the room decides it.
    await mia.tap(mia.button(/^Watch /), { expect: { visible: ['tonight'] }, observers: [[host, { visible: ['tonight'] }, 'agreeToPeerMs'], [sam, { visible: ['tonight'] }, 'agreeToPeerMs']] });
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

  test('a friend’s I’m in leaves everyone where they are; Matches counts it on its row', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    await matchAcross([host, mia]);
    await host.tap(host.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.tap(imIn(host), { expect: { text: 'You’re in' } });
    await eventually(() => mia.latest?.proposal ?? null, (v) => v !== null, 'the friend’s I’m in arrived', mia);
    await expect(mia.testId('voting')).toBeVisible();
    await expect(mia.testId('proposal')).toHaveCount(0);
    await mia.tap(mia.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await expect(mia.page.getByRole('checkbox', { name: /, 1 of 2 in$/ }).filter({ visible: true })).toHaveCount(1);
    await mia.audit('Matches with a friend’s I’m in');
    // The host takes it back: nobody is in any more.
    await host.tap(imIn(host), { expect: {} });
    await eventually(() => (host.latest?.proposal as { agreeCount: number } | null)?.agreeCount ?? 0, (n) => n === 0, 'I’m in taken back', host);
  });
  // Everyone in for two titles: multi-select on Matches, then someone opens the tiebreak with Pick one of 2.
  test('everyone in for two → Pick one of 2 → favorites → most picks → Tonight', async ({ room }) => {
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
    // Every tap is its own I'm in, counted on its row; everyone stays on Matches.
    await host.tap(imIn(host, 0), { expect: { label: { text: ', 1 of 3 in$' } }, observers: [[mia, { label: { text: ', 1 of 3 in$' } }, 'inToPeerMs']] });
    await host.tap(imIn(host, 1), { expect: { label: { text: ', 1 of 3 in$' } } });
    await mia.tap(imIn(mia, 0), { expect: { label: { text: ', 2 of 3 in$' } } });
    await mia.tap(imIn(mia, 1), { expect: { label: { text: ', 2 of 3 in$' } }, observers: [[sam, { label: { text: ', 2 of 3 in$' } }, 'inToPeerMs']] });
    await sam.tap(imIn(sam, 0), { expect: { label: { text: ', 3 of 3 in$' } } });
    await sam.tap(imIn(sam, 1), { expect: { text: 'Everyone’s in on 2' }, observers: [[host, { text: 'Everyone’s in on 2' }, 'inToPeerMs'], [mia, { text: 'Everyone’s in on 2' }, 'inToPeerMs']] });
    await expect(host.page.getByRole('checkbox', { name: /, 3 of 3 in$/, checked: true }).filter({ visible: true })).toHaveCount(2);
    await mia.audit('Matches, everyone’s in on two');
    // Nothing opens or decides until someone asks for it.
    await host.page.waitForTimeout(500);
    for (const p of [host, mia, sam]) await expect(p.testId('tiebreak')).toHaveCount(0);
    expect(host.latest?.phase, 'taps alone decide nothing').toBe('choosing');
    await mia.tap(mia.button('Pick one of 2'), { expect: { visible: ['tiebreak'] }, observers: [[host, { visible: ['tiebreak'] }, 'tiebreakToPeerMs'], [sam, { visible: ['tiebreak'] }, 'tiebreakToPeerMs']], timeout: 15000 });
    await host.audit('Tiebreak');
    // Favorites wait for everyone; the most-picked title wins and the room goes to Tonight.
    const favorite = (p: Person, n: number) => p.page.getByRole('radio', { name: /, my favorite$/ }).filter({ visible: true }).nth(n);
    await host.tap(favorite(host, 0), { expect: { text: 'Waiting for 2 more picks' } });
    await mia.tap(favorite(mia, 1), { expect: { text: 'Waiting for 1 more pick' } });
    await sam.tap(favorite(sam, 0), { expect: { visible: ['tonight'] }, observers: [[host, { visible: ['tonight'] }, 'favoriteToPeerMs'], [mia, { visible: ['tonight'] }, 'favoriteToPeerMs']], timeout: 20000 });
    await eventually(() => host.latest?.phase, (p) => p === 'decided', 'the room decided', host);
    const tiebreak = host.latest?.tiebreak as { candidateIds: string[]; outcome: { candidateId: string; spun: boolean } | null } | null | undefined;
    const decision = host.latest?.decision as { candidateId: string } | null | undefined;
    expect(tiebreak?.outcome?.spun, 'most picks wins without a spin').toBe(false);
    expect(tiebreak?.outcome?.candidateId, 'the most-picked title').toBe(tiebreak?.candidateIds[0]);
    expect(decision?.candidateId, 'Tonight is the tiebreak’s pick').toBe(tiebreak?.outcome?.candidateId);
    await host.audit('Tonight after the tiebreak');
  });
});
