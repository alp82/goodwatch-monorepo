/** A new room always gets its country (friends can't pick services without one), even when the first tries don't go through. */
import { expect, test } from '@playwright/test';
import { fakeRoom, newRoom, setUpDevice } from './room-fake';

test('a new room gets its country when the host presses New couch', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  await setUpDevice(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
  await expect.poll(() => f.room.shared.screens[0]?.country ?? null).not.toBeNull();
});

test('the room country is set even when settings changes refuse the first tries', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { refuseConfigures: 4 });
  await setUpDevice(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
  await expect.poll(() => f.room.shared.screens[0]?.country ?? null).not.toBeNull();
});
