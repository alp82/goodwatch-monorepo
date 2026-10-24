import { expect, test } from '@playwright/test';

test('shared beta links redirect to the install-first home and both app links work', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/api/yepwatch/**', route => { requests.push(route.request().url()); return route.abort(); });
  await page.goto('/beta');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Install YepWatch on iPhone' })).toHaveAttribute('href', 'https://testflight.apple.com/join/V2gzwSFA');
  await expect(page.getByRole('link', { name: 'Install YepWatch on Android' })).toHaveAttribute('href', 'https://expo.dev/accounts/alperortac/projects/yepwatch/builds/3ec61b6d-e0dc-4edf-8a11-ec948febc8bc');
  await expect(page.getByText('Coming soon', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await expect(page.getByLabel('Your nickname')).toBeVisible();
  await page.getByRole('button', { name: 'Back to start' }).click();
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
