import { test, expect, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

/**
 * GoodWatch sign-in belongs to the device, not a room. OAuth itself is a full-page round trip here
 * (the fake issuer sends the browser straight back to the page it left).
 */
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
async function watchBoot(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { bootSeen: boolean }).bootSeen = false;
    new MutationObserver(() => { if (document.querySelector('[data-testid="yepwatch-boot"]')) (window as unknown as { bootSeen: boolean }).bootSeen = true; }).observe(document, { childList: true, subtree: true });
  });
}
const bootSeen = (page: Page) => page.evaluate(() => (window as unknown as { bootSeen: boolean }).bootSeen);
function admissions(page: Page) {
  const seen = { count: 0 };
  page.on('request', (r) => { if (r.method() === 'POST' && /\/proposal\/rooms(\/[^/]+\/join)?$/.test(new URL(r.url()).pathname)) seen.count++; });
  return seen;
}

test('Continue with GoodWatch on the start page signs in, creates no room and comes back to the start page', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { member: 'return' });
  const rooms = admissions(page);
  await page.goto('/');
  await expect(button(page, 'Continue with GoodWatch')).toBeVisible();
  await watchBoot(page);
  await button(page, 'Continue with GoodWatch').click();
  // Leaving is covered by the GoodWatch transition, not a blank page.
  await expect(page.getByTestId('member-transition')).toBeVisible();
  await expect.poll(() => f.account.starts).toBe(1);
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByTestId('member-transition')).toHaveCount(0);
  await expect(page.getByTestId('landing').or(page.getByTestId('home-rooms'))).toBeVisible();
  // The returning page doesn't replay the startup word and never opens Mood or a room.
  expect(await bootSeen(page)).toBe(false);
  await expect(page.getByLabel('Mood')).toHaveCount(0);
  expect(rooms.count).toBe(0);
  await expect(button(page, 'Continue with GoodWatch')).toHaveCount(0);
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByText('Signed in with GoodWatch', { exact: true })).toBeVisible();
  await expect(button(page, 'Log out')).toBeVisible();
});

test('Log out ends the GoodWatch sign-in on this device and stays on the screen', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { member: 'signed-in' });
  await page.goto('/?open=profile');
  await expect(page.getByText('Signed in with GoodWatch', { exact: true })).toBeVisible();
  await button(page, 'Log out').click();
  await expect.poll(() => f.account.logouts).toBe(1);
  await expect(page.getByText('Signed in with GoodWatch', { exact: true })).toHaveCount(0);
  await expect(button(page, 'Continue with GoodWatch')).toBeVisible();
  await expect(page.getByTestId('profile-panel')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('signing in inside a room comes back to that room, links it and the room goes live', async ({ page }) => {
  const room = choosingRoom();
  room.shared.participants[0].nickname = 'Guest';
  room.shared.participants[0].serviceIds = null;
  const f = await fakeRoom(page, room, { member: 'return' });
  const tickets = { count: 0 };
  await page.route('**/realtime-ticket', (route) => { tickets.count++; return route.fulfill({ json: { ticket: `t${tickets.count}`, expiresAt: Date.now() + 30_000, websocketPath: '/api/yepwatch/v1/proposal/realtime' } }); });
  await page.routeWebSocket('**/realtime', (ws) => {
    ws.onMessage((raw) => { if (JSON.parse(String(raw)).type === 'authenticate') ws.send(JSON.stringify({ type: 'room.snapshot', snapshot: f.room.shared })); });
  });
  const rooms = admissions(page);
  await page.goto('/?open=profile&from=/room/test-room');
  await button(page, 'Continue with GoodWatch').click();
  await page.waitForURL((url) => url.pathname === '/room/test-room');
  await expect.poll(() => f.account.links).toBeGreaterThan(0);
  await expect.poll(() => f.room.own.member.state).toBe('linked');
  await expect(button(page, 'Yep')).toBeVisible();
  // The guest capability is replaced by an account session: one fresh ticket, then stable live.
  await page.waitForTimeout(2500);
  await expect(page.getByText(/^(Connecting…|Reconnecting…|Trying again in \d+ s|Not connected\.)$/)).toHaveCount(0);
  expect(tickets.count).toBe(2);
  expect(rooms.count).toBe(0);
});

test('a member pressing New room still creates a room as themselves', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { member: 'signed-in' });
  const rooms = admissions(page);
  await page.goto('/');
  await button(page, 'New room').click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  await expect.poll(() => f.room.own.member.state).toBe('linked');
  expect(rooms.count).toBe(1);
  expect(f.account.starts).toBe(0);
});

test('when sign-in can’t start, the screen stays and says why; no room is made', async ({ page }) => {
  await fakeRoom(page, newRoom());
  const rooms = admissions(page);
  await page.goto('/?open=profile');
  await button(page, 'Continue with GoodWatch').click();
  await expect(page.getByText('GoodWatch sign-in isn’t connected yet.')).toBeVisible();
  await expect(page.getByTestId('profile-panel')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(rooms.count).toBe(0);
});

test('pressing Continue with GoodWatch twice starts one sign-in, and the button waits meanwhile', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { member: 'return', slowStart: 1500 });
  await page.goto('/');
  const signIn = button(page, 'Continue with GoodWatch');
  await expect(signIn).toBeVisible();
  const box = (await signIn.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(signIn).toBeDisabled();
  await page.waitForTimeout(300);
  expect(f.account.starts).toBe(1);
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByTestId('member-transition')).toHaveCount(0, { timeout: 8000 });
  expect(f.account.starts).toBe(1);
});

test('a lapsed sign-in keeps the name, offers a small Reconnect on the start page and reconnects from Profile in one tap', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { member: 'lapsed' });
  await page.goto('/');
  await expect(page.getByTestId('home-rooms')).toBeVisible();
  await expect(page.getByText(/, Alex$/)).toBeVisible();
  // No big guest button mid-session: the small Reconnect GoodWatch with what it brings back.
  await expect(button(page, 'Continue with GoodWatch')).toHaveCount(0);
  await expect(page.getByTestId('start-reconnect').getByText('Brings your streaming services back', { exact: true })).toBeVisible();
  await expect(page.getByTestId('start-reconnect').getByRole('button', { name: 'Reconnect GoodWatch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByTestId('profile-lapsed')).toBeVisible();
  await expect(button(page, 'Continue with GoodWatch')).toHaveCount(0);
  await expect(button(page, 'Log out')).toBeVisible();
  await expect(page.getByTestId('profile-lapsed').getByText('Brings your streaming services back', { exact: true })).toBeVisible();
  await page.getByTestId('profile-lapsed').getByRole('button', { name: 'Reconnect GoodWatch', exact: true }).click();
  await expect.poll(() => f.account.starts).toBe(1);
  await page.waitForURL((url) => url.pathname === '/');
  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByText('Signed in with GoodWatch', { exact: true })).toBeVisible();
  await expect(page.getByTestId('profile-lapsed')).toHaveCount(0);
});

test('a room link that keeps failing says so quietly and Retry links it', async ({ page }) => {
  const room = choosingRoom();
  const f = await fakeRoom(page, room, { member: 'signed-in', linkFailures: 3 });
  await page.route('**/realtime-ticket', (route) => route.fulfill({ json: { ticket: 't1', expiresAt: Date.now() + 30_000, websocketPath: '/api/yepwatch/v1/proposal/realtime' } }));
  await page.routeWebSocket('**/realtime', (ws) => {
    ws.onMessage((raw) => { if (JSON.parse(String(raw)).type === 'authenticate') ws.send(JSON.stringify({ type: 'room.snapshot', snapshot: f.room.shared })); });
  });
  await page.goto('/room/test-room');
  await expect(page.getByText('Couldn’t connect GoodWatch to this room.')).toBeVisible({ timeout: 15_000 });
  expect(f.account.links).toBe(3);
  await button(page, 'Retry').click();
  await expect.poll(() => f.room.own.member.state).toBe('linked');
  await expect(page.getByText('Couldn’t connect GoodWatch to this room.')).toHaveCount(0);
});
