import { expect, test } from '@playwright/test';

test('beta page keeps unavailable native installs honest and feedback contains only explicit build details', async ({ page }) => {
  const requests: string[] = [];
  await page.route('**/api/yepwatch/**', route => { requests.push(route.request().url()); return route.abort(); });
  await page.addInitScript(() => {
    (window as any).__opened = [];
    window.open = ((url: string) => { (window as any).__opened.push(url); return null; }) as typeof window.open;
  });
  await page.goto('/beta');
  await expect(page.getByText('Test YepWatch', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Android invitations coming soon' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'iPhone invitations coming soon' })).toBeDisabled();
  await page.getByRole('button', { name: 'Send feedback' }).click();
  const opened = await page.evaluate(() => (window as any).__opened as string[]);
  expect(opened).toHaveLength(1);
  const mail = new URL(opened[0]);
  expect(mail.protocol).toBe('mailto:');
  expect(mail.pathname).toBe('hello@goodwatch.app');
  expect(mail.searchParams.get('body')).toContain('What happened?');
  expect(mail.searchParams.get('body')).toContain('YepWatch 0.1.0 · web');
  expect(mail.searchParams.get('body')).not.toMatch(/room\/|cookie|token|invite/i);
  expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Try in your browser' }).click();
  await expect(page.getByRole('button', { name: 'Create a room', exact: true })).toBeVisible();
});
