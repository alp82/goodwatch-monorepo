import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

// This browser has never voted: the first-round how-to plays (the suite's other tests start with it seen).
test.use({ storageState: { cookies: [], origins: [] } });

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const SEEN = 'yepwatch.v3.tonight-howto-seen';

test('first round: the how-to guides the real card until the person acts, then never again on this device', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const f = await fakeRoom(page, choosingRoom());
  await page.goto('/room/test-room');
  await expect(page.getByTestId('voting')).toBeVisible();
  await expect(page.getByText('Would you watch this tonight?', { exact: true })).toBeVisible();
  // The hand drags the real card (its looks are off: the stamp markers stay dark) and the tips explain.
  await expect(button(page, 'Skip the how-to')).toBeVisible();
  await expect(page.getByText('You’d watch it tonight', { exact: true })).toBeVisible({ timeout: 6000 });
  const box = await page.getByTestId('poster').boundingBox();
  expect(box).not.toBeNull();
  await expect.poll(async () => Number(await page.getByTestId('stamp-yep').evaluate((e) => getComputedStyle(e).opacity))).toBe(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), SEEN)).toBeNull();
  // A vote is acting: the how-to ends and is remembered.
  await button(page, 'Yep').click();
  await expect(button(page, 'Skip the how-to')).toHaveCount(0);
  await expect.poll(() => f.sent().filter((t) => t === 'vote').length).toBe(1);
  expect(await page.evaluate((k) => localStorage.getItem(k), SEEN)).toBe('1');
  await page.reload();
  await expect(page.getByTestId('voting')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(button(page, 'Skip the how-to')).toHaveCount(0);
});

test('Skip ends the how-to; reduced motion shows the tips without the hand', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await fakeRoom(page, choosingRoom());
  await page.goto('/room/test-room');
  await expect(page.getByTestId('tonight-question')).toBeVisible();
  await expect(page.getByText('Not tonight', { exact: true })).toBeVisible();
  await expect(page.getByText('You’d watch it tonight', { exact: true })).toBeVisible();
  await button(page, 'Skip the how-to').click();
  await expect(button(page, 'Skip the how-to')).toHaveCount(0);
  await expect(page.getByText('Not tonight', { exact: true })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), SEEN)).toBe('1');
});

test('someone who already answered cards in this round never gets the how-to', async ({ page }) => {
  const room = choosingRoom();
  room.own.votes = [{ candidateId: 'c1', value: 'pass', revision: 1, activeExposureMs: null, timingSource: 'unavailable' }];
  room.own.nextCandidateId = 'c2';
  await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('voting')).toBeVisible();
  await page.waitForTimeout(800);
  await expect(button(page, 'Skip the how-to')).toHaveCount(0);
});

test('wide windows: the question column beside the card, the poster’s Details and Trailer move into it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const room = choosingRoom();
  room.shared.candidates[0].trailerUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  room.shared.matches = [{ candidateId: 'c2', averageYepMs: null }];
  await fakeRoom(page, room);
  await page.addInitScript((k) => localStorage.setItem(k, '1'), SEEN);
  await page.goto('/room/test-room');
  const column = page.getByTestId('tonight-question');
  await expect(column).toBeVisible();
  await expect(column.getByText('CARD 1 OF 2', { exact: true })).toBeVisible();
  await expect(column.getByText('Would you watch this tonight?', { exact: true })).toBeVisible();
  await expect(column.getByRole('button', { name: /^Details about / })).toHaveCount(1);
  await expect(column.getByRole('link', { name: 'Watch trailer on YouTube' })).toHaveCount(1);
  await expect(page.getByTestId('poster').getByRole('button', { name: /^Details about / })).toHaveCount(0);
  // The card is left of the column; the matches peek is in it and opens Matches.
  const card = (await page.getByTestId('poster').boundingBox())!;
  const aside = (await column.boundingBox())!;
  expect(card.x + card.width).toBeLessThan(aside.x);
  await column.getByRole('button', { name: '1 match', exact: true }).click();
  await expect(page.getByTestId('matches')).toBeVisible();
});
