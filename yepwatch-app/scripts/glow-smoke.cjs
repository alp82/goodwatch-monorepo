const { chromium } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:8131');
    await page.getByLabel('Your nickname').fill('Glow Host');
    await page.getByRole('button', { name: 'Create a room', exact: true }).click();
    await page.getByRole('button', { name: 'Choose our services', exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, '../artifacts/glow/first-lobby.png') });
    await page.getByRole('button', { name: 'Choose our services', exact: true }).click();
    await page.getByRole('button', { name: 'Change country', exact: true }).click();
    await page.getByLabel('Find country').fill('Germany');
    await page.getByRole('button', { name: 'Germany', exact: true }).click();
    await page.getByLabel('Find usable services').fill('Fixture');
    await page.getByRole('button', { name: 'Fixture service (service 1)', exact: true }).click();
    await page.getByRole('button', { name: 'Use these services', exact: true }).click();
    await page.getByRole('button', { name: 'Start choosing', exact: true }).click();
    await page.getByRole('button', { name: 'Yep', exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, '../artifacts/glow/first-voting.png') });
    fs.writeFileSync(
      path.join(__dirname, '../artifacts/glow/first-smoke.json'),
      JSON.stringify(
        {
          errors,
          pathname: new URL(page.url()).pathname,
          body: (await page.locator('body').innerText()).slice(0, 3000),
        },
        null,
        2
      )
    );
  } catch (e) {
    console.error(e);
    await page.screenshot({ path: path.join(__dirname, '../artifacts/glow/first-error.png') });
    console.error((await page.locator('body').innerText()).slice(0, 3000));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
