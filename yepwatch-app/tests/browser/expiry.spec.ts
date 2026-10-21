import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';
import { fixtureSnapshot } from '../../src/dev/fixtures';

/** Isolated HTTP/WS protocol fixtures, never retained demo rooms or live catalog proof. */
async function roomHarness(page: Page, initialStatus = 200) {
  const snapshot = fixtureSnapshot();
  snapshot.shared.phase = 'voting';
  snapshot.shared.round = { version: 1, rosterVersion: 1, contextVersion: 1, candidateCount: 3, completed: false };
  let status = initialStatus; let commandStatus = 200; let tickets = 0; let reads = 0;
  let hold = false; let release: (() => void) | undefined;
  const sockets: WebSocketRoute[] = [];
  const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
  await page.addInitScript(({ expiresAt }) => sessionStorage.setItem('yepwatch.room.fixture-room', JSON.stringify({ roomId: 'fixture-room', participantId: 'you', token: '', expiresAt })), { expiresAt: snapshot.shared.expiresAt });
  await page.route('**/api/yepwatch/v1/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
    let result: unknown = snapshot; let code = status;
    if (path.endsWith('realtime-ticket')) { tickets++; code = 200; result = { ticket: 'isolated-one-use-fixture', expiresAt: Date.now() + 30000, websocketPath: '/api/yepwatch/v1/realtime' }; }
    else if (path.endsWith('commands')) { code = commandStatus; }
    else { reads++; const held = hold; hold = false; if (held) await new Promise<void>(resolve => { release = resolve; }); }
    if (code !== 200) result = { error: { code: code === 410 ? 'expired' : 'busy', message: code === 410 ? 'Room expired' : 'Try again', retryable: code !== 410 } };
    await route.fulfill({ status: code, json: result, headers: cors });
  });
  await page.routeWebSocket('**/api/yepwatch/v1/realtime', socket => {
    sockets.push(socket);
    socket.onMessage(raw => { const frame = JSON.parse(String(raw)); if (frame.type === 'authenticate') socket.send(JSON.stringify({ type: 'room.snapshot', snapshot: snapshot.shared })); else if (frame.type === 'ping') socket.send(JSON.stringify({ type: 'pong' })); });
  });
  await page.goto('/room/fixture-room');
  return { snapshot, sockets, get tickets() { return tickets; }, get reads() { return reads; }, setStatus: (value: number) => { status = value; }, setCommandStatus: (value: number) => { commandStatus = value; }, hold: () => { hold = true; }, release: () => release?.() };
}
async function live(page: Page) { await expect(page.getByText('Live room connected', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Would watch', exact: true })).toBeEnabled(); }
async function terminal(page: Page) { await expect(page.getByText('This room has expired', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Create another room' })).toBeVisible(); await expect(page.getByRole('button', { name: /Would watch|Pass tonight|Refresh room|Reconnect|Retry pending/ })).toHaveCount(0); }

test('cached room closes only after ambiguous WS expiry is confirmed by HTTP410', async ({ page }) => {
  const h = await roomHarness(page); await live(page); h.setStatus(410);
  h.sockets[0].send(JSON.stringify({ type: 'error', code: 'expired', message: 'Expired' }));
  await terminal(page); await page.screenshot({ path: 'artifacts/expiry-terminal-mobile.png', fullPage: true });
  const before = h.tickets; await page.waitForTimeout(1100); expect(h.tickets).toBe(before);
});
test('subscription lease expiry with live HTTP state reconnects rather than ending room', async ({ page }) => {
  const h = await roomHarness(page); await live(page); const before = h.reads;
  h.sockets[0].send(JSON.stringify({ type: 'error', code: 'expired', message: 'Lease expired' }));
  await expect.poll(() => h.tickets).toBeGreaterThan(1); await expect.poll(() => h.reads).toBeGreaterThan(before); await live(page);
  await expect(page.getByText('This room has expired', { exact: true })).toHaveCount(0);
});
test('HTTP command410 ends cached room and late successful repair cannot restore controls', async ({ page }) => {
  const h = await roomHarness(page); await live(page); await expect.poll(() => h.reads).toBeGreaterThan(1);
  h.hold(); await page.getByRole('button', { name: 'Refresh room' }).click(); await expect.poll(() => h.reads).toBeGreaterThan(2);
  h.setCommandStatus(410); await page.getByRole('button', { name: 'Would watch', exact: true }).click(); await terminal(page);
  h.release(); await page.waitForTimeout(200); await terminal(page);
});
test('initial HTTP410 is terminal while503 remains manually recoverable', async ({ page }) => {
  const h = await roomHarness(page, 503);
  await expect(page.getByText('The room could not load.', { exact: false })).toBeVisible();
  h.setStatus(200); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await live(page);
  h.setStatus(503); await page.getByRole('button', { name: 'Refresh room' }).click();
  await expect(page.getByText('Your private room state could not refresh.', { exact: false })).toBeVisible();
  h.setStatus(200); await page.getByRole('button', { name: 'Refresh room' }).click(); await live(page);
  h.setStatus(410); await page.getByRole('button', { name: 'Refresh room' }).click(); await terminal(page);
});
test('server-confirmed deadline plus missing browser credential is terminal, never a generic outage', async ({ page }) => {
  const h = await roomHarness(page); await live(page);
  await page.clock.setSystemTime(new Date(h.snapshot.shared.expiresAt + 1000));
  h.setStatus(401); h.sockets[0].send(JSON.stringify({ type: 'error', code: 'expired', message: 'Expired' }));
  await terminal(page); expect(h.tickets).toBe(1);
});
test('initial authoritative410 offers a new room without cached controls', async ({ page }) => {
  await roomHarness(page, 410); await terminal(page);
});
test('authoritative shared expired snapshot fences a delayed successful command', async ({ page }) => {
  const h = await roomHarness(page); await live(page);
  let release!: () => void;
  await page.route('**/rooms/fixture-room/commands', async route => { await new Promise<void>(resolve => { release = resolve; }); await route.fulfill({ json: h.snapshot, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true' } }); });
  await page.getByRole('button', { name: 'Would watch', exact: true }).click(); await expect.poll(() => Boolean(release)).toBe(true);
  h.sockets[0].send(JSON.stringify({ type: 'room.updated', snapshot: { ...h.snapshot.shared, revision: 2, phase: 'expired' } }));
  await terminal(page); release(); await page.waitForTimeout(200); await terminal(page);
  await page.getByRole('button', { name: 'Create another room' }).click(); await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeVisible();
});
