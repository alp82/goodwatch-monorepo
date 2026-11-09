/** The avatar opens Profile over the page it was pressed on: a room never turns into the start page. */
import { expect, test } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

test('Profile in a room opens over the room and closes back to it', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  await fakeRoom(page, room);
  await page.goto(`/room/${room.shared.roomId}`);
  await expect(page.getByTestId('room-setup')).toBeVisible();
  const url = page.url();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByTestId('profile-panel')).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByTestId('home-rooms')).toHaveCount(0);
  await page.getByTestId('profile-panel').getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('profile-panel')).toHaveCount(0);
  await expect(page.getByTestId('room-setup')).toBeVisible();
  expect(page.url()).toBe(url);
});

test('Profile on the Mood page keeps the Mood page underneath', async ({ page }) => {
  await fakeRoom(page, newRoom());
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  const url = page.url();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByTestId('profile-panel')).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('profile-panel')).toHaveCount(0);
  await expect(page.getByLabel('Mood')).toBeVisible();
  expect(page.url()).toBe(url);
});
