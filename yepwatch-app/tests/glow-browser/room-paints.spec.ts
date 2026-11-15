/**
 * Paint-by-paint record of the room's arrival flows (one screen change per step, nothing in
 * between), and local changes that show before the server answers.
 */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom, setUpDevice } from './room-fake';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
type Paint = { t: number; text: string; dim: number };

/** Every frame's visible text and dimmed controls (the first frame of each change), from page start. */
const recorder = () => {
  const log: Paint[] = [];
  (window as unknown as { paints: Paint[] }).paints = log;
  const frame = () => {
    const text = (document.body?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const dim = [...document.querySelectorAll('[role=switch],[role=button]')].filter((e) => e.getAttribute('aria-disabled') === 'true' && Number(getComputedStyle(e).opacity) < 0.9).length;
    const last = log[log.length - 1];
    if (last?.text !== text || last.dim !== dim) log.push({ t: Math.round(performance.now()), text, dim });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};
const paints = (page: Page) => page.evaluate(() => (window as unknown as { paints: Paint[] }).paints);
const latency = (page: Page, ms: number) => page.route('**/api/yepwatch/v1/proposal/**', async (route) => { await new Promise((r) => setTimeout(r, ms)); await route.fallback(); });
const setupRoom = () => { const room = choosingRoom(); room.shared.phase = 'setup'; return room; };

test.beforeEach(async ({ page }) => { await page.addInitScript(recorder); });

test('create: New couch goes straight to the couch setup, no connection words on the way', async ({ page }) => {
  await fakeRoom(page, newRoom());
  await setUpDevice(page);
  await latency(page, 150);
  await page.goto('/');
  await button(page, 'New couch').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await page.waitForTimeout(500);
  const seen = await paints(page);
  expect(seen.filter((p) => /Connecting|Not connected|Couldn|Try again/.test(p.text))).toEqual([]);
});

test('join: from the invitation straight to Your services, open over the room from its first paint', async ({ page }) => {
  const room = setupRoom();
  await fakeRoom(page, room, { invite: 'K7QX' });
  await latency(page, 150);
  let joined = false;
  await page.route('**/api/yepwatch/v1/proposal/**', (route) => {
    const { pathname } = new URL(route.request().url());
    if (!joined && route.request().method() === 'GET' && pathname.endsWith('/rooms/test-room')) return route.fulfill({ status: 401, json: { error: { code: 'unauthorized', message: 'No', retryable: false } } });
    if (pathname.endsWith('/join')) joined = true;
    return route.fallback();
  });
  await page.goto('/r/K7QX');
  await page.getByLabel('Your name').fill('Mia');
  await button(page, 'Join').click();
  await expect(page.getByTestId('services-sheet')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await paints(page)).filter((p) => /Waiting for/.test(p.text) && !/Done/.test(p.text))).toEqual([]);
});

test('an invitation to a room you’re already in never shows the join form', async ({ page }) => {
  await fakeRoom(page, choosingRoom(), { invite: 'K7QX' });
  await latency(page, 150);
  await page.goto('/r/K7QX');
  await expect(page.getByTestId('voting')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('join-screen')).toHaveCount(0);
  const form = await page.evaluate(() => (window as unknown as { paints: Paint[] }).paints.map((p) => p.text).filter((t) => /Restoring your place/.test(t)));
  expect(form).toEqual([]);
});

test('reopening a room: no opening words and no connection line while it connects', async ({ page }) => {
  await fakeRoom(page, choosingRoom());
  await latency(page, 150);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('voting')).toBeVisible();
  await page.waitForTimeout(1200);
  expect((await paints(page)).filter((p) => /Opening the couch|Connecting|Not connected/.test(p.text))).toEqual([]);
  // A connection that stays away is still mentioned, in one line, once the quiet period is over.
  await expect(page.getByText('Reconnecting…', { exact: true })).toBeVisible({ timeout: 6000 });
});

test('sign-in: back from GoodWatch to the start page, no room screen ever paints', async ({ page }) => {
  await fakeRoom(page, newRoom(), { member: 'return' });
  await latency(page, 150);
  await page.goto('/');
  await button(page, 'Continue with GoodWatch').click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.getByTestId('member-transition')).toHaveCount(0);
  await expect(button(page, 'New couch')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await paints(page)).filter((p) => /Who’s here|Opening the couch|What are you in the mood for/.test(p.text))).toEqual([]);
});

test('a replaced idea stays in the field until accepted, then the confirmed room stays usable', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom());
  await page.goto('/room/test-room');
  const field = page.getByLabel('Describe what you want to watch');
  const release = f.hold('edit_idea');
  await field.fill('something funny');
  await button(page, 'Replace').click();
  await expect(field).toHaveValue('something funny');
  expect(f.room.shared.ideas[0].text).toBe('cheer me up');
  release();
  await expect(field).toHaveValue('');
  const row = page.getByRole('switch', { name: 'something funny. Your idea', exact: true });
  await expect(row).toHaveAttribute('aria-checked', 'true');
  await row.click();
  await expect(row).toHaveAttribute('aria-checked', 'false');
  await expect.poll(() => f.sent().filter((t) => t !== 'configure')).toEqual(['edit_idea', 'set_idea']);
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['something funny', false]]);
});

test('a refused replacement stays in the field (with the room’s one line) and preserves the confirmed room', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom(), { interpretations: 24 });
  await page.goto('/room/test-room');
  const field = page.getByLabel('Describe what you want to watch');
  await field.fill('something funny');
  await button(page, 'Replace').click();
  await expect(page.getByTestId('field-line').getByText('No more new ideas in this couch')).toBeVisible();
  await expect(field).toHaveValue('something funny');
  await expect(page.getByTestId('room-setup').getByTestId('idea-list').getByText('cheer me up', { exact: true })).toBeVisible();
  expect(f.room.shared.ideas[0].text).toBe('cheer me up');
});

test('voting never waits: the next card shows at once and fast answers go out in order', async ({ page }) => {
  const room = choosingRoom();
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('voting')).toBeVisible();
  const release = f.hold('vote');
  await button(page, 'Yep').click();
  await expect(button(page, 'Yep')).toBeEnabled();
  await button(page, 'Undo').click();
  await button(page, 'Nope').click();
  release();
  await expect.poll(() => f.commands.filter((c) => c.command.type === 'vote').map((c) => (c.command as { value: string | null }).value)).toEqual(['watch', null, 'pass']);
});

test('Movies or shows shows the choice the moment it’s made, before the server answers', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom());
  await page.goto('/room/test-room');
  const shows = page.getByTestId('room-setup').getByRole('radio', { name: 'Shows', exact: true });
  await expect(shows).toHaveAttribute('aria-checked', 'false');
  const release = f.hold('configure');
  await shows.click();
  await expect(shows).toHaveAttribute('aria-checked', 'true');
  expect(f.room.shared.constraints.kinds).not.toEqual(['show_start']);
  release();
  await expect.poll(() => f.room.shared.constraints.kinds).toEqual(['show_start']);
  await expect(shows).toHaveAttribute('aria-checked', 'true');
});

test('archive: a room moves to History at once, Undo and Restore bring it back, friends never know', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom());
  await page.goto('/room/test-room');
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await page.goto('/');
  await button(page, 'Archive cheer me up').click();
  await expect(page.getByText('Couch archived')).toBeVisible();
  await expect(button(page, 'cheer me up')).toHaveCount(0);
  await button(page, 'Undo').click();
  await expect(button(page, 'cheer me up')).toBeVisible();
  await button(page, 'Archive cheer me up').click();
  await page.reload();
  await button(page, 'History').click();
  await expect(page.getByText('Archived couches')).toBeVisible();
  await button(page, 'Restore').click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(button(page, 'cheer me up')).toBeVisible();
  // From the Room page too.
  await button(page, 'cheer me up').click();
  await button(page, 'Couch').click();
  await button(page, 'Archive couch').click();
  // (The page that was underneath stays mounted, hidden.)
  await expect(page.getByText('YOUR ROOMS').filter({ visible: true })).toHaveCount(0);
  expect(f.sent()).not.toContain('leave');
  // An archived room still opens from History.
  await button(page, 'History').filter({ visible: true }).click();
  await button(page, 'cheer me up').filter({ visible: true }).click();
  await expect(page.getByTestId('room-setup').filter({ visible: true })).toBeVisible();
});
