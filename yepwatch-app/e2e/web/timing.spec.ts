// Key timing moments, repeated E2E_TIMING_RUNS times (each run its own test, so runs spread over workers).
// The reporter applies the p95 budgets (budgets.mjs) across all samples of a moment.
import { eventually, test, type Person } from '../lib/harness';
import { cardTitle, createRoom, inviteLink, join, readyHost, start, vote } from './flows';

const runs = Number(process.env.E2E_TIMING_RUNS ?? 3);
for (let run = 1; run <= runs; run++) {
  test(`timing run ${run}: new room, create, invite open, start, swipe, vote → peer, idea → peer`, async ({ room }) => {
    const host = await readyHost(room); // newRoomMs + createRoomMs
    const mia = await room.person('Mia');
    const invite = await inviteLink(host);
    await mia.open(invite, { settle: false });
    const shown = await mia.firstShown(['join-screen', 'invite-head']);
    if (shown.at) mia.record('inviteOpenMs', shown.at - shown.origin, 'navigation start → join page');
    await mia.fill(mia.page.getByLabel('Your name').filter({ visible: true }), 'Mia');
    await mia.tap(mia.button('Join'), { expect: { visible: ['services-sheet'] } });
    await mia.tap(mia.page.getByRole('checkbox', { name: 'Netflix', exact: true }).filter({ visible: true }), { repeatable: true });
    await mia.tap(mia.button('Done'), { expect: { visible: ['waiting'] } });
    await mia.tap(mia.button('Suggest an idea'), { expect: { visible: ['mood-page'] } });
    await mia.fill(mia.page.getByLabel('Mood'), 'space adventure');
    await mia.tap(mia.page.getByLabel('Mood'), { key: 'Enter', expect: { visible: ['waiting'] }, observers: [[host, { label: { text: 'Use space adventure', exact: true } }, 'ideaToPeerMs']] });
    // The host presses Start a beat after Mia is back in the room, as people do: with no Ready hold her
    // room screen now lasts exactly until the round arrives, and a Start within ~150 ms of her return
    // would show that room for less than a flash's length.
    await host.page.waitForTimeout(300);
    await start(host, [mia]); // startToFirstCardMs, startToPeerVotingMs
    for (let i = 0; i < 3; i++) { await vote(host, false); await vote(mia, false); } // swipeNextCardMs
    // Mia's Yep on a card the host already said Yep to: a match, timed until the host's chip shows it.
    for (let i = 0; i < 6 && !(host.latest?.matches?.length); i++) {
      await vote(host, true);
      const before = await cardTitle(mia);
      await mia.tap(mia.button('Yep'), { repeatable: true, soft: true, timeout: 2500, expect: { cardChanged: { from: before } }, observers: [[host, { label: { text: '^1 match$' } }, 'voteToPeerMs'] as [Person, { label: { text: string } }, string]] });
    }
    void createRoom; void join;
  });
}

// Start a beat after a setup change (a friend's service joins the room's): the room's deck is built again right
// then, and Start must not wait visibly for it. Same moments, same budgets.
test('start right after a setup change', async ({ room }) => {
  const host = await readyHost(room);
  const mia = await room.person('Mia');
  const services = () => new Set(host.latest?.screens.flatMap((s) => s.serviceIds) ?? []).size;
  const before = services();
  await join(mia, await inviteLink(host), 'Mia'); // Disney+, which the room doesn't have
  await eventually(services, (n) => n > before, 'the host\'s room has Mia\'s service', host);
  await host.page.waitForTimeout(300); // the beat people take (see above)
  await start(host, [mia]); // startToFirstCardMs, startToPeerVotingMs
});
