import { expect, test, type Page, type Route, type WebSocketRoute } from '@playwright/test';
import type { GuestAdmissionRequest } from '@goodwatch/yepwatch-contracts/proposal';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

const busy = (route: Route) =>
  route.fulfill({ status: 503, headers: { 'Retry-After': '1' }, json: { error: { code: 'busy', message: 'Service unavailable', retryable: true } } });

/** A realtime gateway the test can drop, and a ticket endpoint it can fail (503 busy) or hold. */
async function live(page: Page) {
  const f = await fakeRoom(page, choosingRoom());
  const control = { mode: 'ok' as 'ok' | 'busy' | 'hold', tickets: 0, held: [] as Route[], sockets: [] as WebSocketRoute[], reads: 0 };
  const ticket = (route: Route) =>
    route.fulfill({ json: { ticket: `t${++control.tickets}`, expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' } });
  await page.route('**/realtime-ticket', (route) => {
    if (control.mode === 'busy') return busy(route);
    if (control.mode === 'hold') { control.held.push(route); return; }
    return ticket(route);
  });
  page.on('request', (r) => { if (r.method() === 'GET' && r.url().endsWith('/rooms/test-room')) control.reads++; });
  await page.routeWebSocket('**/realtime', (ws) => {
    control.sockets.push(ws);
    ws.onMessage((raw) => {
      if (JSON.parse(String(raw)).type === 'authenticate') ws.send(JSON.stringify({ type: 'room.snapshot', snapshot: f.room.shared }));
    });
  });
  const release = async () => { control.mode = 'ok'; for (const r of control.held.splice(0)) await ticket(r); };
  return { f, control, release };
}
const banner = (page: Page) => page.getByText(/^(Connecting…|Reconnecting…|Trying again in \d+ s|Not connected\.)$/);

test('a dropped connection reconnects by itself through busy answers, reads the room again, and the banner goes away', async ({ page }) => {
  const { control } = await live(page);
  await page.goto('/room/test-room');
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await expect.poll(() => control.sockets.length).toBeGreaterThan(0);
  const reads = control.reads;
  // The server restarts: the socket drops and the next tickets answer 503 busy.
  control.mode = 'busy';
  const before = control.sockets.length;
  await control.sockets.at(-1)!.close();
  await expect(page.getByText(/^Trying again in \d+ s$/)).toBeVisible();
  expect(control.sockets.length).toBe(before);
  control.mode = 'ok';
  await expect.poll(() => control.sockets.length, { timeout: 15_000 }).toBe(before + 1);
  await expect(banner(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
  await expect.poll(() => control.reads).toBeGreaterThan(reads);
});

test('Refresh tries at once, shows that it is working, and the banner goes away when it connects', async ({ page }) => {
  const { control, release } = await live(page);
  await page.goto('/room/test-room');
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  control.mode = 'busy';
  const before = control.sockets.length;
  await control.sockets.at(-1)!.close();
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  await expect(page.getByText(/^Trying again in \d+ s$/)).toBeVisible();
  await expect(refresh).toBeEnabled();
  control.mode = 'hold';
  await refresh.click();
  await expect(page.getByText('Reconnecting…', { exact: true })).toBeVisible();
  await expect(page.getByTestId('note-spinner')).toBeVisible();
  await expect(refresh).toBeDisabled();
  await expect.poll(() => control.held.length).toBeGreaterThan(0);
  await release();
  await expect.poll(() => control.sockets.length).toBe(before + 1);
  await expect(banner(page)).toHaveCount(0);
  await expect(refresh).toHaveCount(0);
});

test('Create during a restart: two 503s are retried with the same request, showing Connecting…, then the room opens', async ({ page }) => {
  await fakeRoom(page, newRoom());
  const bodies: GuestAdmissionRequest[] = [];
  await page.route('**/proposal/rooms', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    bodies.push(route.request().postDataJSON());
    return bodies.length <= 2 ? busy(route) : route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connecting…', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/room\/test-room\/mood/, { timeout: 15_000 });
  expect(bodies).toHaveLength(3);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2]).toEqual(bodies[0]);
  await expect(page.getByLabel('Mood')).toBeVisible();
});
