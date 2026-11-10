/** A new room always gets its country (friends can't pick services without one), even when the first tries don't go through. */
import { expect, test } from '@playwright/test';
import { fakeRoom, newRoom } from './room-fake';

test('a new room gets its country while the host is still on the Mood page', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  await expect.poll(() => f.room.shared.screens[0]?.country ?? null).not.toBeNull();
});

test('the room country is set even when settings changes refuse the first tries', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { refuseConfigures: 4 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  await expect.poll(() => f.room.shared.screens[0]?.country ?? null, { timeout: 15000 }).not.toBeNull();
});
