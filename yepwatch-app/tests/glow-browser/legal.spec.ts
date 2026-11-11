import { test, expect } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

test('privacy, support and deletion are reachable from Profile without joining a room', async ({ page }) => {
  await fakeRoom(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Privacy policy', exact: true }).click();
  await expect(page.getByText('Who operates YepWatch', { exact: true })).toBeVisible();
  await expect(page.getByText('Delete and recover your YepWatch data', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete YepWatch account', exact: true }).click();
  await expect(page.getByTestId('delete-account-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete this device’s YepWatch data', exact: true })).toBeDisabled();
});
test('deletion requested on another device hides cached account history and requires explicit restore', async ({ page }) => {
  const room = choosingRoom();
  await fakeRoom(page, room, { member: 'signed-in' });
  let pending = false;
  await page.route('**/account/deletion', route => route.fulfill({ json: { accountTag: 'fixture-account-alex', deletion: pending ? { requestedAt: Date.now(), purgeAfter: Date.now() + 86400_000, phase: 'pending', recoveryId: 'remote-deletion' } : null } }));
  await page.route('**/account/restore', route => { pending = false; return route.fulfill({ json: { restored: true } }); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New room', exact: true })).toBeVisible();
  pending = true;
  await page.reload();
  await expect(page).toHaveURL(/\/delete-account$/);
  await expect(page.getByText('Deletion scheduled', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore YepWatch data', exact: true }).click();
  await expect(page.getByText('Your YepWatch data is restored. Expired rooms stay expired.', { exact: true })).toBeVisible();
});
test('guest deletion requires confirmation, hides device data and offers explicit recovery', async ({ page }) => {
  await fakeRoom(page);
  await page.goto('/delete-account');
  await page.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
  await page.getByRole('button', { name: 'Delete this device’s YepWatch data', exact: true }).click();
  await expect(page.getByText('Deletion scheduled', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Deletion scheduled', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/delete-account$/);
  await page.getByRole('button', { name: 'Restore YepWatch data', exact: true }).click();
  await expect(page.getByText('Your YepWatch data is restored. Expired rooms stay expired.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Type DELETE to confirm', { exact: true })).toBeVisible();
});
