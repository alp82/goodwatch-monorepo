import { expect, test } from '@playwright/test';
import { fakeRoom, newRoom } from './room-fake';

test('browser invite offers both installed apps and still joins in the browser', async ({ page }) => {
  const f = await fakeRoom(page, newRoom(), { invite: 'ABCD12' });
  await page.route('**/guest/resolve-invite', r => r.fulfill({ json: { roomId: f.room.shared.roomId, credential: false } }));
  await page.goto('/r/ABCD12');
  await expect(page.getByRole('link', { name: 'Open in YepWatch', exact: true })).toHaveAttribute('href', 'yepwatch:///r/ABCD12');
  await expect(page.getByRole('link', { name: 'Open in YepWatch Beta (Android)', exact: true })).toHaveAttribute('href', 'yepwatch-preview:///r/ABCD12');
  await expect(page.getByText('Or continue in your browser below')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Friend');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page).toHaveURL(/\/room\//);
});
