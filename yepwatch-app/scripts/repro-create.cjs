/** Visible UI only. Redacts invite/room capabilities from diagnostics. */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
async function main() {
  const browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 390, height: 1100 } }); const page = await context.newPage();
  const report = { landingUrl: 'http://127.0.0.1:8099/', apiOrigin: null, writes: [], cleanCreation: false, secondCreationWithExistingCookie: false, reopenedInvitePreservesHost: false, freshInviteJoin: false };
  page.on('response', response => { const request = response.request(); if (request.method() === 'POST' && response.url().includes('/api/yepwatch/v1/')) { const u = new URL(response.url()); report.apiOrigin = u.origin; report.writes.push({ path: u.pathname.replace(/\/rooms\/[^/]+/, '/rooms/<REDACTED>'), status: response.status(), origin: request.headers().origin, type: request.postDataJSON()?.command?.type ?? (u.pathname.endsWith('/join') ? 'join' : 'admission-or-ticket') }); } });
  const screenshot = async name => page.screenshot({ path: `artifacts/create-${process.env.REPRO_PHASE ?? 'before'}-${name}.png`, fullPage: true, mask: [page.getByText(/^Room code:/).locator('..')] });
  try {
    await page.goto(report.landingUrl); await screenshot('landing');
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await page.getByRole('textbox', { name: 'Your nickname', exact: true }).fill('Create tester'); await screenshot('controls');
    const created = page.waitForResponse(r => r.url().endsWith('/api/yepwatch/v1/rooms') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create a room', exact: true }).click();
    const admission = await (await created).json(); const invite = admission.invite.path;
    await expect(page.getByRole('button', { name: 'Edit screens & evening', exact: true })).toBeVisible(); report.cleanCreation = true; await screenshot('room');
    await page.goto(report.landingUrl); await page.getByRole('button', { name: 'Continue as guest', exact: true }).click(); await page.getByRole('textbox', { name: 'Your nickname' }).fill('Second room tester');
    await page.getByRole('button', { name: 'Create a room', exact: true }).click(); await expect(page.getByRole('button', { name: 'Edit screens & evening', exact: true })).toBeVisible(); report.secondCreationWithExistingCookie = true;
    await page.goto(`http://127.0.0.1:8099${invite}`);
    await expect(page.getByRole('button', { name: 'Continue as guest', exact: true }).or(page.getByText('Who’s watching where?', { exact: true }))).toBeVisible();
    // The buggy view readmits on this path; the fixed view resumes automatically.
    if (await page.getByRole('button', { name: 'Continue as guest', exact: true }).isVisible()) {
      await page.getByRole('button', { name: 'Continue as guest', exact: true }).click(); await page.getByRole('textbox', { name: 'Your nickname' }).fill('Create tester'); await page.getByRole('button', { name: 'Join room', exact: true }).click();
    }
    await expect(page.getByText('Who’s watching where?', { exact: true })).toBeVisible(); await screenshot('reopened');
    await expect(page.getByRole('button', { name: 'Edit screens & evening', exact: true })).toBeVisible({ timeout: 4000 }); report.reopenedInvitePreservesHost = true;
    expect(report.writes.filter(write => write.type === 'join')).toHaveLength(0);
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 1100 } }); const guest = await guestContext.newPage();
    await guest.goto(`http://127.0.0.1:8099${invite}`);
    await guest.getByRole('button', { name: 'Continue as guest', exact: true }).click(); await guest.getByRole('textbox', { name: 'Your nickname' }).fill('Fresh invite guest'); await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByText('Who’s watching where?', { exact: true })).toBeVisible();
    await expect(page.getByText('In the room · 2', { exact: true })).toBeVisible(); report.freshInviteJoin = true;
    await guest.screenshot({ path: `artifacts/create-${process.env.REPRO_PHASE ?? 'before'}-fresh-join.png`, fullPage: true, mask: [guest.getByText(/^Room code:/).locator('..')] }); await guestContext.close();
  } catch (error) { report.failure = error.message.replace(/http[^\s]+\/r\/[^\s]+/g, '<REDACTED>'); await screenshot('failure'); process.exitCode = 1; }
  finally { fs.writeFileSync(`artifacts/create-${process.env.REPRO_PHASE ?? 'before'}.json`, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2)); await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
