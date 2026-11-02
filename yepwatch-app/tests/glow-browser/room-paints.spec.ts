/**
 * Paint-by-paint record of the room's arrival flows (one screen change per step, nothing in
 * between), and local changes that show before the server answers.
 */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

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

test('create: the start page goes straight to Mood, the room page never shows on the way', async ({ page }) => {
  await fakeRoom(page, newRoom());
  await latency(page, 150);
  await page.goto('/');
  await button(page, 'Create a room').click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  await page.waitForTimeout(500);
  const seen = await paints(page);
  // The start page's own film shows rooms too: only what paints after it counts.
  expect(seen.filter((p) => !/Create a room/.test(p.text) && /Just you|MOOD|Connecting|Not connected/.test(p.text) && !/or try:/.test(p.text))).toEqual([]);
  // Back shows the room that was waiting underneath.
  await button(page, 'Back').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
});

test('join: from the invitation straight to Your services', async ({ page }) => {
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
  await expect(page.getByTestId('services-page')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await paints(page)).filter((p) => /Waiting for/.test(p.text))).toEqual([]);
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
  expect((await paints(page)).filter((p) => /Opening the room|Connecting|Not connected/.test(p.text))).toEqual([]);
  // A connection that stays away is still mentioned.
  await expect(page.getByText('Not connected.')).toBeVisible();
});

test('sign-in: back from GoodWatch straight to Mood', async ({ page }) => {
  await fakeRoom(page, newRoom(), { member: 'return' });
  await latency(page, 150);
  await page.goto('/');
  await button(page, 'Continue with GoodWatch').click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await paints(page)).filter((p) => !/Create a room/.test(p.text) && /Just you|MOOD|Your name/.test(p.text) && !/or try:/.test(p.text))).toEqual([]);
});

test('editing an idea shows at once, nothing dims, the room stays usable, and it goes out in order', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom());
  await page.goto('/room/test-room');
  await expect(page.getByTestId('room-setup')).toBeVisible();
  const release = f.hold('edit_idea');
  await button(page, 'cheer me up, edit').click();
  await page.getByLabel('Mood').fill('something funny');
  await page.evaluate(() => { (window as unknown as { paints: Paint[] }).paints.length = 0; });
  await button(page, 'Next').click();
  await expect(page.getByTestId('room-setup').getByText('something funny')).toBeVisible();
  // While the search runs: add another idea and switch one off. All of it shows, none of it dims.
  await button(page, 'Add an idea').click();
  await button(page, 'space adventure').click();
  await expect(page.getByTestId('room-setup').getByText('space adventure')).toBeVisible();
  await page.getByRole('switch', { name: 'Use something funny' }).click();
  await expect(page.getByRole('switch', { name: 'Use something funny' })).toHaveAttribute('aria-checked', 'false');
  expect(f.room.shared.ideas[0].text).toBe('cheer me up');
  const seen = (await paints(page)).filter((p) => /room|Just|MOOD/i.test(p.text));
  expect(seen.filter((p) => p.dim > 0 && !/Start/.test(p.text)).length).toBe(0);
  release();
  await expect.poll(() => f.sent().filter((t) => t !== 'configure')).toEqual(['edit_idea', 'add_idea', 'set_idea']);
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['something funny', false], ['space adventure', true]]);
  await expect(page.getByTestId('room-setup').getByText('space adventure')).toBeVisible();
});

test('a refused change goes back and says why', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom(), { interpretations: 24 });
  await page.goto('/room/test-room');
  await button(page, 'cheer me up, edit').click();
  await page.getByLabel('Mood').fill('something funny');
  await button(page, 'Next').click();
  await expect(page.getByTestId('room-setup').getByText('cheer me up')).toBeVisible();
  await expect(page.getByText('No more new ideas in this room')).toBeVisible();
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

test('settings show on the room page the moment their page closes', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom());
  await page.goto('/room/test-room');
  await button(page, 'Movies and shows, change').click();
  await expect(page.getByTestId('kinds-page')).toBeVisible();
  const release = f.hold('configure');
  await page.getByRole('checkbox', { name: 'Shows' }).click();
  await button(page, 'Done').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page.getByTestId('room-setup').getByRole('button', { name: 'Movies, change', exact: true })).toBeVisible();
  release();
});

test('archive: a room moves to History at once, Undo and Restore bring it back, friends never know', async ({ page }) => {
  const f = await fakeRoom(page, setupRoom());
  await page.goto('/room/test-room');
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await page.goto('/');
  await button(page, 'Archive cheer me up').click();
  await expect(page.getByText('Room archived')).toBeVisible();
  await expect(button(page, 'cheer me up')).toHaveCount(0);
  await button(page, 'Undo').click();
  await expect(button(page, 'cheer me up')).toBeVisible();
  await button(page, 'Archive cheer me up').click();
  await page.reload();
  await button(page, 'History').click();
  await expect(page.getByText('Archived rooms')).toBeVisible();
  await button(page, 'Restore').click();
  await page.getByRole('button', { name: 'Back to Your rooms' }).click();
  await expect(button(page, 'cheer me up')).toBeVisible();
  // From the Room page too.
  await button(page, 'cheer me up').click();
  await page.getByRole('button', { name: /people/ }).first().click();
  await button(page, 'Archive room').click();
  // (The page that was underneath stays mounted, hidden.)
  await expect(page.getByText('YOUR ROOMS').filter({ visible: true })).toHaveCount(0);
  expect(f.sent()).not.toContain('leave');
  // An archived room still opens from History.
  await button(page, 'History').filter({ visible: true }).click();
  await button(page, 'cheer me up').filter({ visible: true }).click();
  await expect(page.getByTestId('room-setup').filter({ visible: true })).toBeVisible();
});
