import { test, expect } from '@playwright/test';
import { fixtureSnapshot } from '../../src/dev/fixtures';
import { API_PREFIX } from '../../../goodwatch-webapp/packages/yepwatch-contracts/index';

test('invitation intent, optional sign-in failure, browser guest admission and honest transport state', async ({ page }) => {
  const snapshot = fixtureSnapshot(); snapshot.shared.candidates = []; let admitted = false; const requests: { path: string; body: unknown; headers: Record<string, string> }[] = [];
  await page.route(`**${API_PREFIX}/**`, async route => {
    const request = route.request(); const url = new URL(request.url()); const body = request.postDataJSON();
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' } }); return; }
    requests.push({ path: url.pathname, body, headers: request.headers() });
    let status = 200; let response: unknown = {};
    if (url.pathname.endsWith('/member/start')) { status = 501; response = { error: { code: 'not_implemented', message: 'Not connected', retryable: false } }; }
    else if (url.pathname.endsWith('/resolve-invite')) response = { roomId: 'fixture-room' };
    else if (url.pathname.endsWith('/join')) { admitted = true; response = { credential: { roomId: 'fixture-room', participantId: 'you', token: '', expiresAt: snapshot.shared.expiresAt }, invite: { code: 'JOIN-THIS', path: '/r/JOIN-THIS' }, snapshot }; }
    else if (url.pathname.endsWith('/realtime-ticket')) { status = 501; response = { error: { code: 'not_implemented', message: 'No transport', retryable: false } }; }
    else if (url.pathname.endsWith('/fixture-room')) { if (admitted) response = snapshot; else { status = 401; response = { error: { code: 'unauthorized', message: 'No room cookie', retryable: false } }; } }
    await route.fulfill({ status, json: response, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true' } });
  });
  await page.goto('/r/JOIN-THIS');
  await page.getByRole('button', { name: 'Sign in with GoodWatch' }).click();
  await expect(page.getByText('GoodWatch sign-in is not connected yet.', { exact: false })).toBeVisible();
  expect(requests.find(r => r.path.endsWith('/member/start'))?.body).toEqual({ returnTo: '/r/JOIN-THIS' });
  await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Room code or invitation link' })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Your nickname' }).fill('Alex');
  await page.getByRole('button', { name: 'Join room', exact: true }).click();
  await expect(page.getByText('Live connection unavailable', { exact: false })).toBeVisible();
  await expect(page.getByText('Ready to pick?')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Find a show to continue' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use movies & new shows' })).toBeVisible();
  expect(requests.some(r => r.path.endsWith('/commands'))).toBe(false);
  expect(requests.find(r => r.path.endsWith('/join'))?.headers.authorization).toBeUndefined();
  expect(requests.find(r => r.path.endsWith('/join'))?.body).toMatchObject({ inviteCode: 'JOIN-THIS' });
  const stored = await page.evaluate(() => sessionStorage.getItem('yepwatch.room.fixture-room'));
  expect(JSON.parse(stored!).token).toBe('');
  const before = requests.length; await page.waitForTimeout(1200); expect(requests.length).toBe(before);
  await page.screenshot({ path: 'artifacts/room-fixture-mobile.png', fullPage: true });
});

test('fixture components cover mixed screens, all media kinds, accessible voting, shortlist and episode caveat', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/preview');
  await expect(page.getByText('Fixture data only.', { exact: false })).toBeVisible();
  await expect(page.getByText('Our TV', { exact: true })).toBeVisible();
  await expect(page.getByText('Jo’s screen', { exact: true })).toBeVisible();
  await expect(page.getByText('Movies · New shows', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Voting', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pass tonight', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Would watch', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Fixture action: vote.', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'artifacts/voting-fixture-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect(page.getByText('Your shared shortlist', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choice', exact: true }).click();
  await expect(page.getByText('These offers cover the show.', { exact: false })).toBeVisible();
  await page.screenshot({ path: 'artifacts/choice-fixture-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('entry fits mobile and desktop without a forced account or horizontal scrolling', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Continue as guest', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/entry-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: 'artifacts/entry-desktop.png', fullPage: true });
});
