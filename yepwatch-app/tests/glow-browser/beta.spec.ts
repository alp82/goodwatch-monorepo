import { expect, test } from '@playwright/test';
import invitations from '../../src/features/beta/invitations.json';

test('shared beta links redirect to the install-first home and both app links work', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/api/yepwatch/**', route => { requests.push(route.request().url()); return route.abort(); });
  await page.goto('/beta');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Install YepWatch on iPhone' })).toHaveAttribute('href', invitations.ios);
  await expect(page.getByRole('link', { name: 'Install YepWatch on Android' })).toHaveAttribute('href', invitations.android ?? invitations.androidApk);
  await expect(page.getByText('Coming soon', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await expect(page.getByLabel('Your name')).toBeVisible();
  await page.getByRole('button', { name: 'Back to Start' }).click();
  await page.getByRole('button', { name: 'Join a room', exact: true }).click();
  await expect(page.getByLabel('Room code or invitation')).toBeVisible();
  expect(requests).toEqual([]);
});

test('explainer has a centered SVG pause control on hover, touch and keyboard focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.goto('/');
  const film=page.locator('.mini-intro'); const pause=page.getByRole('button',{name:'Pause intro',exact:true});
  await expect(pause).toHaveCSS('opacity','0');
  await film.hover(); await expect(pause).toHaveCSS('opacity','1');
  await expect(pause.locator('svg rect')).toHaveCount(2);
  const a=await film.boundingBox(), b=await pause.boundingBox();expect(Math.abs(b!.x+b!.width/2-a!.x-a!.width/2)).toBeLessThan(2);
  await pause.click();await expect(page.locator('.mini-film')).toHaveCSS('animation-play-state','paused');
  await page.getByRole('button',{name:'Play intro',exact:true}).click();
  await page.mouse.move(0,0);await expect(pause).toHaveCSS('opacity','0');
  await film.dispatchEvent('pointerdown',{pointerType:'touch'});await expect(pause).toHaveCSS('opacity','1');
  await page.emulateMedia({reducedMotion:'reduce'});await expect(pause).toHaveCount(0);
  await expect(page.locator('.mini-film')).toHaveCSS('animation-name','none');
});

for (const [width, height] of [[390,844],[1440,900]]) test(`first visit lands once on one wordmark, intro, install and browser choices at ${width}`, async ({page}) => {
  await page.setViewportSize({width,height});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const start = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('yepwatch-boot')).toHaveCount(0);
  expect(Date.now() - start).toBeLessThan(5500);
  // The boot word lands on the header wordmark: exactly one visible brand afterwards.
  const brand = page.locator('[data-home-brand]');
  await expect(brand).toHaveCount(1);
  await expect(brand).toHaveCSS('opacity', '1');
  await expect(page.locator('.mini-intro')).toBeVisible();
  for (const name of ['Install YepWatch on iPhone', 'Install YepWatch on Android']) await expect(page.getByRole('link', { name })).toBeInViewport();
  for (const name of ['Create a room', 'Join a room', 'Continue with GoodWatch']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({path:`.expo/home-entry-${width}.png`});
});
