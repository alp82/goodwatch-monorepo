// A member's start page after a full page reload: opening a room's card goes straight to the room, never through
// its empty opening screen. The start page read the account's rooms (each with its snapshot), but the room read
// its own access and snapshot again from nothing, so the card's tap showed the bare "opening" page for 50-83 ms
// (a flash) before the room. Leaving afterwards asks for no live connection again: the gateway refuses the leaver's
// socket when the Leave commits, and its redial asked for a ticket the server refused (403) in 1 of 20 smoke runs.
import { randomBytes } from 'node:crypto';
import type { Person } from '../lib/harness';
import { test, expect, issuer } from '../lib/harness';
import { inviteLink, readyHost } from './flows';

const TICKET = /\/api\/yepwatch\/v1\/proposal\/rooms\/[^/]+\/realtime-ticket$/;
const COMMANDS = /\/api\/yepwatch\/v1\/proposal\/rooms\/[^/]+\/commands$/;
const LATE_LEAVE_MS = 800;

async function signedIn(p: Person, user: string, displayName: string) {
  await issuer(`/_e2e/user?user=${encodeURIComponent(user)}`, { displayName });
  await p.open('/');
  await p.roundTrip(p.button('Continue with GoodWatch').first());
  await p.see({ visible: ['avatar-goodwatch-mark'] }, 15000, 'signed in');
}

/**
 * Every DOM change from here on (MutationObserver callbacks run before the frame is painted): whether a shown room
 * status page (opening, unavailable) appeared. The page stays mounted under others, so only a visible one counts.
 */
const watchStatus = (p: Person) => p.page.evaluate(() => {
  const w = window as unknown as { __status?: number };
  w.__status = 0;
  const seen = () => {
    if ([...document.querySelectorAll<HTMLElement>('[data-testid="room-status"]')].some((e) => e.checkVisibility())) w.__status! += 1;
  };
  new MutationObserver(seen).observe(document.body, { childList: true, subtree: true, attributes: true });
});
const statusSeen = (p: Person) => p.page.evaluate(() => (window as unknown as { __status: number }).__status);

test.describe('room card after a full page reload', () => {
  test('member reloads the start page and opens the room: the room shows, never its empty opening page', async ({ room }) => {
    const host = await readyHost(room, 'Alp', 'reload card heist');
    const invite = await inviteLink(host);
    const user = `member-Mia-${randomBytes(3).toString('hex')}`;
    const mia = await room.person('Mia', { member: user });
    await signedIn(mia, user, 'Mia');
    await mia.open(invite, { settle: false });
    await mia.see({ visible: ['join-screen', 'invite-head'] });
    await mia.tap(mia.button('Join as Mia'), { expect: { any: ['waiting', 'services-sheet'] } });
    // A full page load of the start page: nothing of the room is in memory any more.
    await mia.open('/');
    const card = mia.page.getByTestId('home-rooms').getByRole('button', { name: /^reload card heist$/i });
    await expect(card).toBeVisible({ timeout: 15000 });
    // The room's live channel: carrying the room (its first snapshot), then refused once the Leave commits.
    const channel = { live: false, refused: false };
    let left = false;
    const tickets: string[] = [];
    mia.page.on('request', (r) => { if (left && TICKET.test(new URL(r.url()).pathname)) tickets.push(r.method()); });
    mia.page.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => {
      const type = String(payload).match(/"type":"([^"]+)"/)?.[1];
      if (type === 'room.snapshot' || type === 'room.updated') channel.live = true;
      if (left && type === 'error') channel.refused = true;
    }));
    await watchStatus(mia);
    await mia.tap(card, { expect: { any: ['waiting', 'room-status', 'room-setup', 'services-sheet'] } });
    await mia.see({ any: ['waiting', 'services-sheet'] }, 15000, 'the room');
    expect(await statusSeen(mia), 'the room\'s opening page never showed').toBe(0);

    // Leave: the room asks for no live connection after it.
    await expect.poll(() => channel.live, { message: 'the room is live before Leave' }).toBe(true);
    if (await mia.testId('services-sheet').count()) await mia.tap(mia.button('Done'), { expect: { visible: ['waiting'] } });
    await mia.tap(mia.button(/, switch room$/));
    await mia.tap(mia.button(/, Room page$/), { expect: { visible: ['room-sheet'] } });
    await mia.tap(mia.button('Leave room'));
    // The Leave's answer comes late, as on a slow network: the gateway refuses the leaver's socket as soon as the
    // Leave commits, so the live channel's redial (~250 ms later) would come before it.
    await mia.page.route(COMMANDS, async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, LATE_LEAVE_MS));
      await route.fulfill({ response }).catch(() => undefined);
    });
    left = true;
    await mia.tap(mia.button('Leave'), { expect: { visible: ['home-rooms'] }, timeout: 15000 });
    expect(channel.refused, 'the gateway refused the leaver\'s socket before the Leave\'s answer').toBe(true);
    await mia.page.waitForTimeout(1500);
    expect(tickets, 'no live connection ticket asked for after Leave').toEqual([]);
  });
});
