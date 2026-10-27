import { expect, test, type Page } from '@playwright/test';
import { continuousFixture } from '../continuous-fixture';

/** Records, every frame from document start, how visible the boot word and the header logo are and where the word sits. */
async function recordFrames(page: Page) {
  await page.addInitScript(() => {
    const visible = (el: Element | null) => {
      let v = 1;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) v *= Number(getComputedStyle(n).opacity);
      return el ? v : 0;
    };
    const frames: { t: number; word: number; brand: number; x: number; y: number }[] = [];
    (window as unknown as { bootFrames: typeof frames }).bootFrames = frames;
    const tick = () => {
      const word = document.querySelector('[data-testid="yepwatch-boot"] .review-boot-word');
      const brand = document.querySelector('[data-home-brand]');
      const box = word?.getBoundingClientRect();
      frames.push({ t: performance.now(), word: visible(word), brand: visible(brand), x: box ? box.x + box.width / 2 : NaN, y: box ? box.y + box.height / 2 : NaN });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
async function expectOneLogoInPlace(page: Page) {
  const frames = await page.evaluate(() => (window as unknown as { bootFrames: { t: number; word: number; brand: number; x: number; y: number }[] }).bootFrames);
  expect(frames.some((f) => f.word > 0.9)).toBe(true);
  expect(frames.at(-1)!.brand).toBeGreaterThan(0.99);
  // Never two logos at once.
  expect(frames.filter((f) => f.word > 0.02 && f.brand > 0.02)).toEqual([]);
  // The word never travels: its center stays put while it is visible.
  const shown = frames.filter((f) => f.word > 0.02 && Number.isFinite(f.x));
  const xs = shown.map((f) => f.x), ys = shown.map((f) => f.y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1);
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(1);
}

test('the page is dark before the app script runs', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(7, 7, 7)');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(7, 7, 7)');
  await context.close();
});

for (const [width, height] of [[375, 667], [390, 844], [1440, 900]]) test(`boot dissolves in place into the home page, one logo at a time, at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await recordFrames(page);
  await page.goto('/');
  await expect(page.getByTestId('yepwatch-boot')).toBeVisible();
  await expect(page.getByTestId('yepwatch-boot')).toHaveCount(0, { timeout: 6000 });
  await expectOneLogoInPlace(page);
  await expect(page.getByRole('button', { name: 'Create a room', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

test('reduced motion shows the still word briefly, then plain fades with one logo at a time', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordFrames(page);
  const start = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('yepwatch-boot')).toBeVisible();
  await expect(page.getByTestId('yepwatch-boot')).toHaveCount(0, { timeout: 4000 });
  expect(Date.now() - start).toBeLessThan(2500);
  await expectOneLogoInPlace(page);
  expect(await page.locator('.review-boot-word').count()).toBe(0);
});

test('a slow home page keeps the arc circling, then dissolves into the loaded rooms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const room = continuousFixture();
  let slow = false;
  await page.route('**/api/yepwatch/v1/proposal/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/realtime-ticket')) return route.fulfill({ status: 501, json: { error: { code: 'not_implemented', message: 'Fixture', retryable: false } } });
    if (slow && path.endsWith('/rooms/test-room')) await new Promise((r) => setTimeout(r, 3200));
    return route.fulfill({ json: room });
  });
  // Visiting the room once registers it on this tab, so the home page becomes the returning rooms list.
  await page.goto('/room/test-room');
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible({ timeout: 8000 });
  slow = true;
  await page.goto('/');
  await page.waitForTimeout(2600);
  const boot = page.getByTestId('yepwatch-boot');
  await expect(boot).toBeVisible();
  expect(await page.locator('.review-boot-wait').evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
  await expect(boot).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole('button', { name: 'Open Host’s room' })).toBeVisible();
});
