// Owner decision Q25a: a reload, or a closed tab opened again, mid-vote goes back to the room at the card
// the person was on, with no start page on the way. Timed from the app's first frame (its script ran) to
// the card: `relaunchToCardMs`. The flash gate (finish) fails any screen that shows on the way.
import { test, expect, type Person } from '../lib/harness';
import { cardTitle, inviteLink, join, readyHost, start, vote } from './flows';

/** Ms from the app's first frame (the startup cover) to the voting card, in the current document. */
async function appToCard(p: Person) {
  await p.see({ visible: ['voting', 'poster'] }, 15000, 'back at the card');
  return p.page.evaluate(() => {
    const states = (window as unknown as { __yw: { states: { t: number; sig: string }[] } }).__yw.states;
    const up = states.find((s) => s.sig.split(' ').includes('yepwatch-boot'));
    const card = states.find((s) => ['voting', 'poster'].every((m) => s.sig.split(' ').includes(m)));
    return {
      ms: up && card ? card.t - up.t : null,
      before: card ? states.filter((s) => s.t < card.t).map((s) => s.sig).filter(Boolean) : [],
    };
  });
}

test.describe('relaunch mid-vote', () => {
  test('reload mid-vote: back at the same card, no start page on the way @core', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await start(host, [mia]);
    await vote(mia, false);
    await vote(mia, true);
    const card = await cardTitle(mia);
    await room.point('voting');
    await mia.reload();
    const back = await appToCard(mia);
    if (back.ms !== null) mia.record('relaunchToCardMs', back.ms, 'reload mid-vote: app up → the card');
    expect(back.before.every((sig) => sig.split(' ').every((m) => m === 'yepwatch-boot')), `only the startup cover before the card, saw: ${back.before.join(' → ')}`).toBe(true);
    expect(await cardTitle(mia), 'the card Mia was on').toBe(card);
    await vote(mia, false);
  });

  test('closed tab opened again mid-vote: back at the card the deck is on', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await start(host, [mia]);
    await vote(mia, false);
    const url = mia.page.url();
    await mia.harvest();
    await mia.page.close();
    // The same browser (its room cookie) opens the room's address in a new tab, as a reopened tab does.
    const again = await room.person('Mia (tab reopened)', { context: mia.context, device: mia.device });
    await again.open(url, { settle: false });
    const back = await appToCard(again);
    if (back.ms !== null) again.record('relaunchToCardMs', back.ms, 'reopened tab mid-vote: app up → the card');
    expect(back.before.every((sig) => sig.split(' ').every((m) => m === 'yepwatch-boot')), `only the startup cover before the card, saw: ${back.before.join(' → ')}`).toBe(true);
    // Mia's vote is on the server: the deck continues after it, it never shows the card she answered.
    expect(await cardTitle(again)).not.toBe('');
    await vote(again, true);
  });
});
