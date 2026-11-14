// The member's start page draws its final layout from the first frame while the account's rooms are read late:
// no layout shift (CLS 0) and no flash when History arrives. Production smoke 2026-11-14 10:20 UTC measured
// CLS 0.0433 after Leave: the start page showed the left room's card from the cached account read, then the
// late read swapped it for History and the tiles moved.
import { randomBytes } from 'node:crypto';
import type { Person } from '../lib/harness';
import { test, expect, issuer } from '../lib/harness';
import { inviteLink, readyHost } from './flows';

const HOME = /\/api\/yepwatch\/v1\/proposal\/account\/home$/;
const LATE_MS = 1500;

async function signedIn(p: Person, user: string, displayName: string) {
  await issuer(`/_e2e/user?user=${encodeURIComponent(user)}`, { displayName });
  await p.open('/');
  await p.roundTrip(p.button('Continue with GoodWatch').first());
  await p.see({ visible: ['avatar-goodwatch-mark'] }, 15000, 'signed in');
}

/** The account's rooms answer late from here on. */
const lateHome = (p: Person) => p.page.route(HOME, async (route) => {
  if (route.request().method() === 'GET') await new Promise((resolve) => setTimeout(resolve, LATE_MS));
  await route.continue().catch(() => undefined);
});

/** Layout shifts the page recorded so far (the harness gate judges them too; this names the journey step). */
async function shifts(p: Person) {
  await p.harvest();
  return p.recordings.at(-1)?.shifts ?? [];
}

test.describe('start page History arrives late', () => {
  test('member leaves a room: the start page shows History from the first frame', async ({ room }) => {
    const host = await readyHost(room, 'Alp', 'late history heist');
    const invite = await inviteLink(host);
    const user = `member-Mia-${randomBytes(3).toString('hex')}`;
    const mia = await room.person('Mia', { member: user });
    await signedIn(mia, user, 'Mia');
    await mia.open(invite, { settle: false });
    await mia.see({ visible: ['join-screen', 'invite-head'] });
    await mia.tap(mia.button('Join as Mia'), { expect: { any: ['waiting', 'services-sheet'] } });
    // The start page has read the room as open (its card), as it had in production before Leave. In-app Back
    // keeps the room's own read warm, so opening the card again goes straight to the room.
    await mia.tap(mia.button('Back'), { expect: { visible: ['home-rooms'] } });
    const card = mia.page.getByTestId('home-rooms').getByRole('button', { name: /^late history heist$/i });
    await expect(card).toBeVisible({ timeout: 15000 });
    await mia.tap(card, { expect: { any: ['waiting', 'room-status', 'room-setup'] } });
    await lateHome(mia);
    await mia.tap(mia.button(/, switch room$/));
    await mia.tap(mia.button(/, Room page$/), { expect: { visible: ['room-sheet'] } });
    await mia.tap(mia.button('Leave room'));
    await mia.tap(mia.button('Leave'), { expect: { visible: ['home-rooms'] }, timeout: 15000 });
    // History is there with the page, not after the late read; the room's card never shows again.
    expect(await card.count(), 'the left room\'s card is not on the start page').toBe(0);
    expect(await mia.button('History').count(), 'History is on the start page with its first frame').toBe(1);
    await mia.page.waitForResponse(HOME, { timeout: 20000 });
    await mia.page.waitForTimeout(800);
    await expect(card).toHaveCount(0);
    await expect(mia.button('History')).toBeVisible();
    expect(await shifts(mia), 'no layout shift on the start page after Leave').toEqual([]);
  });

  test('member opens the start page with History read late: one layout, no shift', async ({ room }) => {
    const host = await readyHost(room, 'Alp', 'late history heist');
    const invite = await inviteLink(host);
    const user = `member-Lee-${randomBytes(3).toString('hex')}`;
    const lee = await room.person('Lee', { member: user });
    await signedIn(lee, user, 'Lee');
    await lee.open(invite, { settle: false });
    await lee.see({ visible: ['join-screen', 'invite-head'] });
    await lee.tap(lee.button('Join as Lee'), { expect: { any: ['waiting', 'services-sheet'] } });
    await lee.tap(lee.button(/, switch room$/));
    await lee.tap(lee.button(/, Room page$/), { expect: { visible: ['room-sheet'] } });
    await lee.tap(lee.button('Leave room'));
    await lee.tap(lee.button('Leave'), { expect: { visible: ['home-rooms'] }, timeout: 15000 });
    await expect(lee.button('History')).toBeVisible({ timeout: 20000 });
    // A cold start page: nothing cached, the account's rooms answer late.
    await lateHome(lee);
    await lee.open('/', { settle: false });
    await lee.see({ visible: ['home-rooms'] }, 20000, 'start page');
    await expect(lee.button('History')).toBeVisible();
    await lee.page.waitForTimeout(800);
    expect(await shifts(lee), 'no layout shift on a cold start page').toEqual([]);
  });
});
