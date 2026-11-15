/**
 * The rethink's first run and taste profile (rethink.md screens 1-3, rethink-picks.md items 4, 6 and 13): setup ends
 * on the start page without creating a couch, Taste answers go to the profile with the device secret, the setup chip
 * counts them, the next-day question answers once, and Taste mode opens from Profile.
 */
import { expect, test } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom, setUpDevice } from './room-fake';

const button = (page: import('@playwright/test').Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const followup = { key: 1e12 + 27205, title: 'Inception', year: 2010, posterUrl: null, mediaType: 'movie' as const, overview: null, runtimeMinutes: 148, decidedAt: Date.now() - 14 * 3600_000 };

test('first visit: setup (name, Taste cards, Undo) ends on the start page, set up, and creates nothing', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  let rooms = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/proposal/rooms')) rooms++; });
  await page.goto('/');
  await expect(page.getByTestId('landing')).toBeVisible();
  await expect(button(page, 'Continue with GoodWatch')).toBeVisible();
  await expect(button(page, 'New couch')).toHaveCount(0);
  // A first visit asks the server nothing about a profile.
  expect(f.profile.headers).toEqual([]);
  await button(page, 'Start with you').click();
  await expect(button(page, 'Continue')).toBeDisabled();
  await page.getByLabel('Your name').fill('Alp');
  await button(page, 'Continue').click();
  await expect(page.getByText('What do you like?', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 10', { exact: true })).toBeVisible();
  await expect(button(page, 'Skip for now')).toBeVisible();
  await button(page, 'Loved it').click();
  await button(page, 'Not for me').click();
  await button(page, 'Haven’t seen').click();
  await expect(page.getByText('4 of 10', { exact: true })).toBeVisible();
  await button(page, 'Undo').click();
  await expect(page.getByText('3 of 10', { exact: true })).toBeVisible();
  for (let i = 0; i < 4; i++) await button(page, 'Loved it').click();
  await expect(button(page, 'That’s enough')).toBeVisible();
  await button(page, 'That’s enough').click();
  await expect(page.getByTestId('home-rooms')).toBeVisible();
  await expect(button(page, 'New couch')).toBeVisible();
  await expect(page.getByLabel('Code or invitation link')).toBeVisible();
  // The setup chip: the name and the rated count (Loved it and Not for me; Haven't seen doesn't count).
  await expect(page.getByTestId('setup-chip')).toContainText('Alp');
  await expect(page.getByTestId('setup-chip')).toContainText('6 rated');
  // The answers went to the profile with the device secret.
  // Haven't seen, its Undo and the new answer on that card were still on the device together: one item goes.
  await expect.poll(() => f.profile.answers.length).toBe(6);
  expect(f.profile.answers.map((a) => a.answer)).toEqual(['loved', 'not_for_me', 'loved', 'loved', 'loved', 'loved']);
  expect(new Set(f.profile.answers.map((a) => a.key)).size).toBe(6);
  expect(f.profile.headers.every((h) => /^[A-Za-z0-9_-]{43}$/.test(h))).toBe(true);
  expect(new Set(f.profile.headers).size).toBe(1);
  expect(rooms).toBe(0);
});

test('set up: the next-day question answers once and leaves; Join takes a code on the start page', async ({ page }) => {
  const f = await fakeRoom(page, choosingRoom(), { profile: { answered: 10, followups: [followup] } });
  await setUpDevice(page);
  await page.goto('/');
  await expect(page.getByTestId('follow-up')).toBeVisible();
  await expect(page.getByText('How was Inception?', { exact: true })).toBeVisible();
  await expect(page.getByText('LAST NIGHT’S PICK', { exact: true })).toBeVisible();
  await expect(page.getByTestId('setup-chip')).toContainText('10 rated');
  await button(page, 'Didn’t watch it').click();
  await expect(page.getByText('How was Inception?', { exact: true })).toHaveCount(0);
  await expect.poll(() => f.profile.answers).toEqual([expect.objectContaining({ key: followup.key, answer: 'did_not_watch', source: 'followup', decidedAt: followup.decidedAt })]);
  await expect(page.getByTestId('setup-chip')).toContainText('10 rated');
  // Join right on the start page: the code, then Join as the saved name.
  await expect(button(page, 'Join as Alp')).toBeDisabled();
  await page.getByLabel('Code or invitation link').fill('K7QX');
  const resolved = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/guest/resolve-invite'));
  await button(page, 'Join as Alp').click();
  expect((await resolved).postDataJSON().code).toBe('K7QX');
  await expect(page).toHaveURL(/\/room\//);
});

test('Profile opens Taste mode; Done keeps the answers; Reset my taste deletes the profile', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { profile: { answered: 3 } });
  await setUpDevice(page);
  await page.goto('/');
  await button(page, 'Profile').click();
  await expect(page.getByTestId('profile-taste')).toContainText('Your taste profile');
  await button(page, 'Tune your taste').click();
  const mode = page.getByRole('dialog', { name: 'Taste mode' });
  await expect(mode).toBeVisible();
  await expect(mode.getByText('TASTE MODE', { exact: true })).toBeVisible();
  await mode.getByRole('button', { name: 'Loved it', exact: true }).click();
  await mode.getByRole('button', { name: 'Not for me', exact: true }).click();
  await expect(page.getByTestId('setup-chip')).toContainText('5 rated');
  await mode.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(mode).toHaveCount(0);
  await expect.poll(() => f.profile.answers.map((a) => a.answer)).toEqual(['loved', 'not_for_me']);
  await expect(page.getByTestId('profile-panel')).toBeVisible();
  await button(page, 'Reset my taste').click();
  await button(page, 'Reset').click();
  await expect.poll(() => f.profile.deletes).toBe(1);
  await expect(page.getByTestId('setup-chip')).toContainText('0 rated');
});

test('a member: the chip says From GoodWatch and Taste mode uses the GoodWatch taste', async ({ page }) => {
  await fakeRoom(page, newRoom(), { member: 'signed-in' });
  await page.goto('/');
  await expect(page.getByTestId('setup-chip')).toContainText('From GoodWatch');
  await button(page, 'Profile').click();
  await expect(page.getByTestId('profile-taste')).toContainText('Using your GoodWatch taste');
  await button(page, 'Tune your taste').click();
  await expect(page.getByRole('dialog', { name: 'Taste mode' }).getByText('Using your GoodWatch taste', { exact: true })).toBeVisible();
});
