/** New couch makes the couch by itself: a slow admission shows no error or retry, and the couch's setup opens when it lands. */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom, setUpDevice } from './room-fake';

const slowCreate = (page: Page, ms: number) => page.route('**/api/yepwatch/v1/**', async (route) => {
  if (route.request().method() === 'POST' && new URL(route.request().url()).pathname.endsWith('/rooms')) await new Promise((r) => setTimeout(r, ms));
  await route.fallback();
});

test('New couch from inside a room makes the second couch and opens its setup', async ({ page }) => {
  const second = newRoom();
  second.shared.roomId = 'second-room';
  await fakeRoom(page, choosingRoom(), { nextRooms: [second] });
  await slowCreate(page, 1500);
  await page.goto(`/room/${choosingRoom().shared.roomId}`);
  await page.getByRole('button', { name: /switch couch/ }).first().click();
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('room-setup')).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL(/\/room\/second-room/);
});

test('New couch from the start page waits out a slow create without a retry panel', async ({ page }) => {
  await fakeRoom(page, newRoom());
  await setUpDevice(page);
  await slowCreate(page, 1500);
  await page.goto('/');
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByTestId('retry-panel')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('room-setup')).toBeVisible({ timeout: 10000 });
});
