/** Visible one-operator proof against retained local app/API, FRESH demo rooms only. */
const { chromium, expect } = require('../../yepwatch-app/node_modules/@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../artifacts');
const origin = process.env.YEPWATCH_SIM_ORIGIN ?? 'http://127.0.0.1:8120';
const safe = value => String(value).replace(/https?:\/\/[^\s]*\/r\/[^\s]*/g, '[redacted invitation]');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1150 }, locale: 'de-DE', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], frames = [];
  page.on('pageerror', error => errors.push(safe(error.message)));
  page.on('websocket', ws => ws.on('framereceived', event => {
    const frame = JSON.parse(String(event.payload));
    if (!frame.snapshot) return;
    if ('own' in frame.snapshot) throw Error('Private own reached main-app socket');
    for (const actor of frame.snapshot.participants) for (const key of ['candidateId', 'currentCardId', 'value', 'direction', 'votes', 'progress', 'preference', 'consent']) if (key in actor) throw Error('Private association in shared activity');
    frames.push({ phase: frame.snapshot.phase, revision: frame.snapshot.revision });
  }));
  const actor = index => page.locator('.actor').nth(index);
  const action = (index, name) => actor(index).getByRole('button', { name, exact: true });
  async function fresh(scenario) {
    await page.locator('#scenario').selectOption(scenario);
    await page.locator('#pace').selectOption('700');
    await page.getByRole('button', { name: 'Create fresh demo + open host app', exact: true }).click();
    await expect(page.locator('#notice')).toContainText('Fresh demo ready', { timeout: 20_000 });
    const host = page.frameLocator('#host');
    await expect(host.getByRole('button', { name: 'Start a round', exact: true })).toBeEnabled({ timeout: 15_000 });
    await host.getByRole('button', { name: 'Start a round', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Watch', exact: true })).toBeEnabled({ timeout: 20_000 });
    return host;
  }
  async function hostFinish(host) {
    let votes = 0;
    while (await host.getByRole('button', { name: 'Watch', exact: true }).count()) {
      const response = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
      await host.getByRole('button', { name: 'Watch', exact: true }).click();
      expect((await response).status()).toBe(200); votes++;
    }
    await host.getByRole('button', { name: 'Finish my round', exact: true }).click();
    return votes;
  }
  try {
    fs.mkdirSync(directory, { recursive: true });
    await page.goto(origin);
    let host = await fresh('agreement');
    const startingCards = await page.locator('.private-card strong').allTextContents();
    expect(new Set(startingCards).size).toBe(2);
    await action(0, 'Step').click(); await expect(actor(0).locator('.last')).toHaveText('Artificial Watch');
    const afterStep = await page.locator('.private-card strong').allTextContents();
    expect(afterStep[1]).toBe(startingCards[1]);
    await action(0, 'Step').click(); await expect(actor(0)).toContainText('Private controls: 2 answers');
    expect((await page.locator('.private-card strong').allTextContents())[1]).toBe(startingCards[1]);
    await host.getByRole('button', { name: 'Watch', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(directory, 'simulator-independent-cards.png'), fullPage: true });
    await action(1, 'Disconnect').click(); await expect(actor(1)).toContainText('Disconnected · still required');
    const hostVotes = await hostFinish(host);
    await expect(host.getByText('Your round is finished', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Run automatically', exact: true }).click();
    await expect(actor(0)).toContainText('Finished', { timeout: 20_000 });
    await expect(page.locator('#phase')).toHaveText('Room · voting');
    await expect(host.getByText('Your shared shortlist', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, 'simulator-disconnected-wait.png'), fullPage: true });
    await action(1, 'Reconnect').click(); await expect(actor(1).locator('.last')).toHaveText('Fresh ticket + private state recovered');
    await expect(host.getByText('Your shared shortlist', { exact: true })).toBeVisible({ timeout: 20_000 });
    await host.getByRole('button', { name: 'Propose this', exact: true }).first().click();
    await host.getByRole('button', { name: 'Yes, let’s watch this', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Confirm the group’s choice', exact: true })).toBeEnabled({ timeout: 15_000 });
    await host.getByRole('button', { name: 'Confirm the group’s choice', exact: true }).click();
    await expect(page.locator('#phase')).toHaveText('Room · decided', { timeout: 20_000 });
    await page.screenshot({ path: path.join(directory, 'simulator-agreement-decision.png'), fullPage: true });
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    host = await fresh('disagreement');
    await page.getByRole('button', { name: 'Run automatically', exact: true }).click();
    await hostFinish(host);
    await expect(host.getByText('No choice everyone accepted yet. Start a new round or revisit your evening together. No one’s vote or screen will be dropped.', { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('#phase')).toHaveText('Room · shortlist');
    await expect(host.getByRole('button', { name: 'Propose this', exact: true })).toHaveCount(0);
    await page.screenshot({ path: path.join(directory, 'simulator-disagreement-empty.png'), fullPage: true });
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    host = await fresh('slow');
    await action(1, 'Pause person').click(); await expect(actor(1)).toContainText('Paused');
    await page.getByRole('button', { name: 'Run automatically', exact: true }).click();
    await hostFinish(host);
    await expect(actor(0)).toContainText('Finished', { timeout: 20_000 });
    await expect(actor(1)).toContainText('Paused');
    await expect(page.locator('#phase')).toHaveText('Room · voting');
    await page.screenshot({ path: path.join(directory, 'simulator-slow-paused-wait.png'), fullPage: true });
    await action(1, 'Resume person').click();
    await expect(host.getByText('Your shared shortlist', { exact: true })).toBeVisible({ timeout: 40_000 });
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    expect(errors).toEqual([]);
    const report = { result: 'PASS', scope: 'One operator, localhost controller + actual app8101/API15995/WS4319; finite real sample, fresh memory rooms only.',
      simulatedPeople: 2, scenarios: ['S02 independent cards, no early shortlist', 'S03 agreement through consent/decision', 'S04 disagreement produces empty shortlist', 'S05 slow/pause/disconnect wait', 'S14 fresh-ticket reconnect/private recovery'],
      visibleUiOnly: true, hostVotes, independentPrivateCards: true, onePersonStepDoesNotAdvanceAnother: true,
      disconnectedRequiredVoterPreserved: true, pauseResume: true, freshTicketReconnect: true, noInventedActivity: true,
      disagreementNoMajorityOverride: true, sharedFrameCount: frames.length, privateFieldsOnSharedFrames: false,
      javascriptErrors: errors, capabilitiesAndInvitesRedacted: true };
    fs.writeFileSync(path.join(directory, 'simulator-proof.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(safe(error.message)); process.exitCode = 1; });
