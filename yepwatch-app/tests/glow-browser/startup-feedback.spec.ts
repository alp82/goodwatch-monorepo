import { expect, test } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

test('a solo Yep adds a match without a match celebration', async ({ page }) => {
  const room = choosingRoom();
  room.shared.participants = room.shared.participants.slice(0, 1);
  await fakeRoom(page, room);
  await page.route('**/commands', async (route) => {
    const { command } = route.request().postDataJSON();
    if (command.type === 'vote' && command.value === 'watch') room.shared.matches = [{ candidateId: command.candidateId, averageYepMs: null }];
    await route.fallback();
  });
  await page.goto('/room/test-room');
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { moments: string[] }).moments = seen;
    new MutationObserver(() => { if (document.querySelector('[data-testid="match-moment"]')) seen.push('match'); })
      .observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Yep', exact: true }).click();
  await expect(page.getByRole('button', { name: '1 match', exact: true })).toBeVisible();
  await expect.poll(() => room.own.votes.length).toBe(1);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { moments: string[] }).moments)).toEqual([]);
  await expect(page.getByTestId('match-moment')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled();
});
