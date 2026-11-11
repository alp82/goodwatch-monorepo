/** New room's editor works while admission is pending; its draft survives the room taking over. */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

const slowCreate = (page: Page, ms: number) => page.route('**/api/yepwatch/v1/**', async (route) => {
  if (route.request().method() === 'POST' && new URL(route.request().url()).pathname.endsWith('/rooms')) await new Promise((r) => setTimeout(r, ms));
  await route.fallback();
});

test('New room from inside a room accepts a mood before admission finishes', async ({ page }) => {
  const second = newRoom();
  second.shared.roomId = 'second-room';
  await fakeRoom(page, choosingRoom(), { nextRooms: [second] });
  await slowCreate(page, 1500);
  await page.goto(`/room/${choosingRoom().shared.roomId}`);
  await page.getByRole('button', { name: /switch room/ }).first().click();
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await page.getByLabel('Mood', { exact: true }).fill('space adventure');
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByLabel('Mood', { exact: true })).toHaveValue('space adventure');
});

test('New room from the start page offers presets before admission finishes', async ({ page }) => {
  await fakeRoom(page, newRoom());
  await slowCreate(page, 1500);
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await page.getByRole('button', { name: 'cheer me up', exact: true }).click();
  await expect(page.getByTestId('retry-panel')).toHaveCount(0);
  await expect(page).toHaveURL(/\/new$/);
  await expect(page.getByLabel('Mood', { exact: true })).toHaveValue('cheer me up');
});
