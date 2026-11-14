import { test, expect, eventually, type Person } from '../lib/harness';
import { cardTitle, inviteLink, join, readyHost, start, vote } from './flows';

const COMMANDS = /\/api\/yepwatch\/v1\/proposal\/rooms\/[^/]+\/commands$/;
/** Past the 500 ms after a press within which the browser excuses a layout shift. */
const LATE_PROPOSAL_MS = 900;

/** The last Yep that makes a match is timed until the other phones' Matches chip shows it. */
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

test.describe('match, proposal, Tonight', () => {
  test('match → Matches → propose → agree → Tonight → Start again @core', async ({ room }) => {
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
    await host.tap(host.button('Propose this').first(), { expect: { visible: ['proposal'] }, observers: [[mia, { visible: ['proposal'] }, 'proposeToPeerMs'], [sam, { visible: ['proposal'] }, 'proposeToPeerMs']] });
    await host.audit('Your proposal');
    await mia.audit('Someone proposes');
    await expect(mia.page.getByText(/Alp/)).toHaveCount(0); // never says who
    await mia.tap(mia.button('Agree'), { expect: { text: 'You agree|2 of 3 agree' } });
    await sam.tap(sam.button('Agree'), { expect: { visible: ['tonight'] }, observers: [[host, { visible: ['tonight'] }, 'agreeToPeerMs'], [mia, { visible: ['tonight'] }, 'agreeToPeerMs']] });
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

  // CI run 43605791062 (1 in 10): the proposal came back 550 ms after Propose this, past the 500 ms a press excuses,
  // and Matches drew its card where the match was for a frame before the room's page replaced it: Keep swiping
  // moved 14 px. Here the proposal always comes late; the layout-shift gate judges the Matches page.
  test('the proposal comes late: Matches holds still until the proposal replaces it', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    await matchAcross([host, mia]);
    await host.tap(host.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.page.route(COMMANDS, async (route) => {
      if (route.request().method() === 'POST' && /"type":"propose"/.test(route.request().postData() ?? '')) await new Promise((resolve) => setTimeout(resolve, LATE_PROPOSAL_MS));
      await route.continue().catch(() => undefined);
    });
    await host.tap(host.button('Propose this').first(), { expect: { visible: ['proposal'] }, timeout: 15000 });
    await host.page.waitForTimeout(500);
    await host.harvest();
    expect(host.recordings.at(-1)?.shifts ?? [], 'no layout shift while the proposal arrives').toEqual([]);
  });

  test('Keep swiping sets a proposal aside; Matches shows it as a card', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    await matchAcross([host, mia]);
    await host.tap(host.button(/^\d+ match(es)?$/), { expect: { visible: ['matches'] } });
    await host.tap(host.button('Propose this').first(), { expect: { visible: ['proposal'] }, observers: [[mia, { visible: ['proposal'] }, 'proposeToPeerMs']] });
    await mia.tap(mia.button('Keep swiping'), { expect: { visible: ['voting'] } });
    await mia.tap(mia.button(/^\d+ match(es)?$/), { expect: { visible: ['matches', 'proposal-card'] } });
    await mia.audit('Matches with a proposal card');
    await host.tap(host.button('Take back'), { expect: {} });
    await eventually(() => (host.latest?.shortlist as { proposedCandidateId: string | null } | null)?.proposedCandidateId ?? null, (v) => v === null, 'proposal taken back', host);
  });
});
