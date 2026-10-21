import { test, expect } from '@playwright/test';
import { fixtureSnapshot } from '../../src/dev/fixtures';

test('public deck errors give plain distinct recovery, without raw counters or progress entry', async ({ page }) => {
  const snapshot = fixtureSnapshot(); snapshot.shared.constraints.kinds = ['movie', 'show_start'];
  let reason = 'scan_limit'; const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  await page.addInitScript(({ expiresAt }) => sessionStorage.setItem('yepwatch.room.fixture-room', JSON.stringify({ roomId: 'fixture-room', participantId: 'you', token: '', expiresAt })), { expiresAt: snapshot.shared.expiresAt });
  await page.route('**/api/yepwatch/v1/**', async route => {
    const request = route.request(); if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/commands')) {
      const details = reason === 'catalog_loading' ? { type: 'catalog', reason, actions: ['retry'] } : { type: 'deck', reason, reasons: [reason], actions: ['retry', 'review_screen_services'], scannedTitles: 12345, poolSize: 54321, scanComplete: reason === 'verified_no_intersection', uncertainTitles: 1, noMatchTitles: 2, missingMetadataTitles: 3, missingEpisodeTitles: 4, screens: [] };
      await route.fulfill({ status: 503, headers: cors, json: { error: { code: 'catalog_unavailable', message: 'Raw diagnostic 12345 should stay out of the flow', retryable: true, details } } });
    } else if (path.endsWith('/realtime-ticket')) await route.fulfill({ status: 501, headers: cors, json: { error: { code: 'not_implemented', message: 'Fixture transport unavailable', retryable: false } } });
    else await route.fulfill({ headers: cors, json: snapshot });
  });
  await page.goto('/room/fixture-room');
  const start = page.getByRole('button', { name: 'Start a round', exact: true });
  await start.click(); await expect(page.getByText('The search did not finish.', { exact: false })).toBeVisible();
  await expect(page.getByText('12345', { exact: false })).toHaveCount(0);
  reason = 'availability_unknown'; await start.click(); await expect(page.getByText('Availability could not be verified yet.', { exact: false })).toBeVisible();
  reason = 'verified_no_intersection'; await start.click(); await expect(page.getByText('No titles matched across', { exact: false })).toBeVisible();
  reason = 'catalog_loading'; await start.click(); await expect(page.getByText('The catalog is still loading.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change services or settings' })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Find a show to continue' })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/guest-recovery-fixture-mobile.png', fullPage: true });
});
