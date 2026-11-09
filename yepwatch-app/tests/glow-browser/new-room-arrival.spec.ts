/** New room shows its Mood page while the room is made, then the Mood page itself: never a blank room. */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

const slowCreate = (page: Page, ms: number) => page.route('**/api/yepwatch/v1/**', async (route) => {
  if (route.request().method() === 'POST' && new URL(route.request().url()).pathname.endsWith('/rooms')) await new Promise((r) => setTimeout(r, ms));
  await route.fallback();
});

test('New room from inside a room: Making your room, then the Mood page', async ({ page }) => {
  const second = newRoom();
  second.shared.roomId = 'second-room';
  await fakeRoom(page, choosingRoom(), { nextRooms: [second] });
  await slowCreate(page, 1500);
  await page.goto(`/room/${choosingRoom().shared.roomId}`);
  await page.getByRole('button', { name: /switch room/ }).first().click();
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByTestId('mood-arriving')).toBeVisible();
  await expect(page.getByText('Making your room')).toBeVisible();
  await expect(page.getByLabel('Mood')).toBeVisible({ timeout: 8000 });
  await expect(page).toHaveURL(/\/room\/second-room\/mood/);
});

test('New room from the start page: Making your room, then the Mood page', async ({ page }) => {
  await fakeRoom(page, newRoom());
  await slowCreate(page, 1500);
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByText('Making your room')).toBeVisible();
  await expect(page.getByTestId('retry-panel')).toHaveCount(0);
  await expect(page.getByLabel('Mood')).toBeVisible({ timeout: 8000 });
});
