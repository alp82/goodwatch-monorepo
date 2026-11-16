/** Your Yeps: the voting bar's button and its sheet, kept after the room retires a card, and on Tonight. */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const reread = (page: Page) => page.evaluate(() => {
  for (const state of ['hidden', 'visible']) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }
});

test('the voting bar counts your Yeps, keeps a retired one, and its sheet turns a Yep into a Nope', async ({ page }) => {
  const room = choosingRoom();
  room.shared.candidates.push({ ...room.shared.candidates[1], id: 'c3', title: 'Isolated test c3', identity: { kind: 'movie', tmdbId: 3 } });
  const f = await fakeRoom(page, room);
  await page.goto(`/room/${room.shared.roomId}`);
  await expect(page.getByTestId('voting')).toBeVisible();
  const yeps = page.getByTestId('yeps-button');
  await expect(button(page, 'Your Yeps, 0')).toBeVisible();
  const before = await yeps.boundingBox();

  await button(page, 'Yep').click();
  await expect.poll(() => f.room.own.votes.length).toBe(1);
  await button(page, 'Nope').click();
  await expect.poll(() => f.room.own.votes.length).toBe(2);
  await button(page, 'Yep').click();
  await expect.poll(() => f.room.own.votes.length).toBe(3);
  await expect(button(page, 'Your Yeps, 2')).toBeVisible();
  // A Yep arriving moves nothing in the bar.
  expect(await yeps.boundingBox()).toEqual(before);

  // Mia said Nope to c1: the room retires the card and your answer to it. Your Yep stays listed.
  f.room.shared.candidates = f.room.shared.candidates.filter((c) => c.id !== 'c1');
  f.room.own.votes = f.room.own.votes.filter((v) => v.candidateId !== 'c1');
  f.push();
  await reread(page);
  await expect(button(page, 'Your Yeps, 2')).toBeVisible();

  await button(page, 'Your Yeps, 2').click();
  const sheet = page.getByTestId('yeps-sheet');
  await expect(sheet.getByText('Your 2 Yeps')).toBeVisible();
  // Newest first; the retired card can't change any more.
  await expect(sheet.getByTestId(/^yep-/)).toHaveCount(2);
  expect(await sheet.getByTestId(/^yep-/).evaluateAll((rows) => rows.map((r) => r.getAttribute('data-testid')))).toEqual(['yep-c3', 'yep-c1']);
  await expect(button(page, 'Nope instead for Isolated test c1')).toHaveCount(0);
  await button(page, 'Nope instead for Isolated test c3').click();
  await expect.poll(() => f.room.own.votes.find((v) => v.candidateId === 'c3')?.value).toBe('pass');
  // The row stays (struck) while the sheet is open, and can turn back.
  await expect(button(page, 'Yep again for Isolated test c3')).toBeVisible();
  await expect(sheet.getByText('Your 1 Yep')).toBeVisible();
  await button(page, 'Close').click();
  await expect(button(page, 'Your Yeps, 1')).toBeVisible();
});

test('Tonight shows your Yeps with the decided one tagged, nothing to change', async ({ page }) => {
  const room = choosingRoom();
  room.own.votes = [
    { candidateId: 'c1', value: 'watch', revision: 1, activeExposureMs: 1200, timingSource: 'active_exposure' },
    { candidateId: 'c2', value: 'watch', revision: 1, activeExposureMs: 1200, timingSource: 'active_exposure' },
  ];
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: 1200 }];
  room.shared.phase = 'decided';
  room.shared.decision = { candidateId: 'c1', proposalVersion: 1, decidedAt: Date.now(), availability: [] };
  await fakeRoom(page, room);
  await page.goto(`/room/${room.shared.roomId}`);
  await expect(page.getByTestId('tonight')).toBeVisible();
  await button(page, 'Your Yeps, 2').click();
  const sheet = page.getByTestId('yeps-sheet');
  await expect(sheet.getByText('Your 2 Yeps')).toBeVisible();
  await expect(sheet.getByTestId('yep-c1').getByText('Tonight', { exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /instead for/ })).toHaveCount(0);
});
