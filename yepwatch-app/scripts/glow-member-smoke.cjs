const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const checks = [];
  const errors = [];
  let admission;
  let latest;
  page.on('pageerror', () => errors.push('JavaScript error'));
  page.on('response', async (response) => {
    try {
      if (
        new URL(response.url()).pathname.includes('/continuous/rooms') &&
        response.headers()['content-type']?.includes('application/json')
      ) {
        const value = await response.json();
        const snapshot = value.snapshot ?? (value.shared && value.own ? value : null);
        if (value.credential && snapshot) admission = snapshot;
        if (snapshot) latest = snapshot;
      }
    } catch {}
  });
  try {
    await page.goto('http://127.0.0.1:8132');
    await page.getByLabel('Your nickname').fill('Member host');
    await page.getByRole('button', { name: 'Create a room', exact: true }).click();
    await page.getByRole('button', { name: 'Choose our services', exact: true }).waitFor();
    const roomPath = new URL(page.url()).pathname;
    await page.getByRole('button', { name: 'Open room', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in with GoodWatch', exact: true }).click();
    await page.getByRole('button', { name: 'Sign in to local GoodWatch', exact: true }).click();
    await page.getByRole('button', { name: 'Allow read access', exact: true }).click();
    await page.waitForURL(
      (url) => url.origin === 'http://127.0.0.1:8132' && url.pathname === roomPath && !url.search
    );
    await page.getByRole('button', { name: 'Open room', exact: true }).click();
    await page.getByText('GoodWatch connected', { exact: true }).waitFor();
    await expect(page.getByRole('button', { name: 'Share invitation', exact: true })).toBeEnabled();
    if (
      !admission ||
      !latest ||
      admission.own.participantId !== latest.own.participantId ||
      !latest.own.canHost
    )
      throw new Error('Actor retention failed');
    checks.push(
      'Existing central issuer local login and signed read consent return to the exact app room without code/state in app URL'
    );
    checks.push(
      'Same participant, host authority and room cookie retained; invitation survives OAuth reload'
    );
    await page.getByRole('button', { name: 'Close panel', exact: true }).last().click();
    await page.getByRole('button', { name: 'Choose our services', exact: true }).click();
    await page.getByRole('button', { name: 'Review GoodWatch services', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Netflix (service 8)', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Optional screens and filters', exact: true }).click();
    await page.getByRole('button', { name: 'Movies', exact: true }).click();
    await page.getByRole('button', { name: 'New shows', exact: true }).click();
    await page.getByRole('button', { name: 'Continue my shows', exact: true }).click();
    await expect(page.getByLabel(/last watched|watched episode|episode progress/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Use these services', exact: true }).click();
    await expect.poll(() => latest?.shared.screens[0]?.serviceIds.includes(8)).toBe(true);
    await page.getByRole('button', { name: 'Start choosing', exact: true }).click();
    await expect(page.getByTestId('poster')).toContainText('S1 E2');
    checks.push(
      'DE/Netflix prefill explicitly confirmed and continuation uses saved canonical S1 E2 without manual progress'
    );
    await page.screenshot({
      path: path.join(__dirname, '../artifacts/glow/real/member-continuation.png'),
    });
    await page.getByRole('button', { name: 'Yep', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect 1 matches', exact: true }).click();
    await page.getByRole('button', { name: 'Pick this', exact: true }).click();
    await page.getByText('Everyone picked it. Enjoy your watch.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, '../artifacts/glow/real/member-done.png') });
    await page.getByRole('button', { name: 'Where to watch', exact: true }).click();
    await page
      .getByText('Series availability checked. The specific episode has not been verified.', {
        exact: true,
      })
      .waitFor();
    checks.push(
      'Saved continuation Yep/pick reaches fresh-check automatic Done; title-only entitlement remains explicit'
    );
    if (errors.length) throw new Error('Browser errors');
    fs.writeFileSync(
      path.join(__dirname, '../artifacts/glow/real/member-browser.json'),
      JSON.stringify(
        {
          checks,
          errors,
          identitySource:
            'Disposable local identity and tracking data with existing central GoodWatch issuer, signed consent, live grant verification and real public catalog reads; no production user writes',
          physicalNativeReturn: 'Not tested',
        },
        null,
        2
      )
    );
    console.log(checks.join('\n'));
  } catch (error) {
    console.error('Member browser integration failed at checkpoint', checks.length, String(error.message).replace(/https?:\/\/\S+/g, '[url]').slice(0, 500));
    if (new URL(page.url()).origin === 'http://127.0.0.1:8132') console.error((await page.locator('body').innerText()).replace(/https?:\/\/[^\s]+\/r\/[^\s]+/g, '[invitation redacted]').slice(0, 3500));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
