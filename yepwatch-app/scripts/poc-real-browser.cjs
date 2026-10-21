/** Connected POC: actual API + WS gateway, real finite catalog sample/memory repository. */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const contexts = []; const pages = []; const frames = []; const errors = []; const transportFailures = [];
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); contexts.push(context);
      const page = await context.newPage(); pages.push(page); page.on('pageerror', error => errors.push(error.message));
      page.on('response', async response => { if (response.status() >= 400 && response.url().includes('/api/yepwatch/v1/')) { const body = await response.json().catch(() => ({})); transportFailures.push({ client: i, status: response.status(), command: response.request().postDataJSON()?.command?.type ?? 'read-or-admission', code: body.error?.code, message: body.error?.message }); } });
      page.on('websocket', socket => socket.on('framereceived', event => { const frame = JSON.parse(String(event.payload)); if (frame.snapshot) { if ('own' in frame.snapshot) throw new Error('Private own snapshot on WS'); for (const p of frame.snapshot.participants) for (const key of ['votes', 'progress', 'consent', 'currentCardId', 'candidateId', 'direction']) if (key in p) throw new Error('Private participant activity on WS'); frames.push({ client: i, revision: frame.snapshot.revision, phase: frame.snapshot.phase }); } }));
    }
    const [host, couch, remote] = pages;
    await host.goto('http://127.0.0.1:8100/');
    await host.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await host.getByRole('textbox', { name: 'Your nickname' }).fill('Alex');
    const ownRead = /\/api\/yepwatch\/v1\/rooms\/[^/?]+$/;
    await host.route(ownRead, route => route.request().method() === 'GET' ? route.abort() : route.continue());
    const admission = host.waitForResponse(r => r.url().endsWith('/api/yepwatch/v1/rooms') && r.request().method() === 'POST');
    await host.getByRole('button', { name: 'Create a room', exact: true }).click();
    const admitted = await (await admission).json(); const invite = admitted.invite.path;
    await expect(host.getByText('Live room connected', { exact: true })).toBeVisible();
    await expect(host.getByText('Your private room state could not refresh.', { exact: false })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Edit screens & evening', exact: true })).toBeDisabled();
    await host.unroute(ownRead); await host.getByRole('button', { name: 'Refresh room', exact: true }).click();
    await expect(host.getByText('Your private room state could not refresh.', { exact: false })).toHaveCount(0);
    await expect(host.getByRole('button', { name: 'Edit screens & evening', exact: true })).toBeEnabled();
    await host.getByRole('button', { name: 'Edit screens & evening', exact: true }).click();
    await host.getByRole('button', { name: 'Add first screen', exact: true }).click();
    await host.getByRole('textbox', { name: 'Screen name' }).fill('Our TV');
    await host.getByRole('textbox', { name: 'Find a country' }).fill('Germany');
    await host.getByRole('button', { name: 'Germany', exact: true }).click();
    for (const service of ['Netflix', 'Disney Plus']) { await host.getByRole('textbox', { name: 'Find usable streaming services' }).fill(service); await host.getByRole('button', { name: service, exact: true }).click(); }
    await host.getByRole('button', { name: 'Confirm this screen', exact: true }).click();
    await host.getByRole('button', { name: 'Watching elsewhere', exact: true }).click();
    await host.getByRole('textbox', { name: 'Screen name' }).fill('Jo’s screen');
    await host.getByRole('textbox', { name: 'Find a country' }).fill('Germany');
    await host.getByRole('button', { name: 'Germany', exact: true }).click();
    for (const service of ['Netflix', 'Disney Plus']) { await host.getByRole('textbox', { name: 'Find usable streaming services' }).fill(service); await host.getByRole('button', { name: service, exact: true }).click(); }
    await host.getByRole('button', { name: 'Confirm this screen', exact: true }).click();
    await host.getByRole('button', { name: 'Our TV', exact: true }).click();
    await host.getByRole('button', { name: 'Save evening', exact: true }).click();
    for (const [page, nickname, screen] of [[couch, 'Sam', 'Our TV'], [remote, 'Jo', 'Jo’s screen']]) {
      await page.goto(`http://127.0.0.1:8100${invite}`); await page.getByRole('button', { name: 'Continue as guest', exact: true }).click();
      await page.getByRole('textbox', { name: 'Your nickname' }).fill(nickname); await page.getByRole('button', { name: 'Join room', exact: true }).click();
      await expect(page.getByText('Live room connected', { exact: true })).toBeVisible();
      const panel = page.getByText(screen, { exact: true }).locator('..');
      await panel.getByRole('button', { name: 'Watch on this screen', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Watching here', exact: true })).toBeVisible();
    }
    await expect(host.getByText('In the room · 3', { exact: true })).toBeVisible();
    for (let i = 0; i < contexts.length; i++) {
      const cookies = (await contexts[i].cookies()).filter(cookie => cookie.name.startsWith('yepwatch_'));
      expect(cookies).toHaveLength(1); expect(cookies[0].httpOnly).toBe(true); expect(cookies[0].sameSite).toBe('Lax');
      const routing = await pages[i].evaluate(() => JSON.parse(sessionStorage.getItem(Object.keys(sessionStorage).find(key => key.startsWith('yepwatch.room.')))));
      expect(routing.token).toBe('');
    }
    for (const page of pages) {
      await page.getByRole('textbox', { name: 'Find a show to continue' }).fill('Breaking Bad'); await page.getByRole('button', { name: 'Find show', exact: true }).click();
      await page.getByRole('button', { name: 'Breaking Bad (2008)', exact: true }).click();
      await page.getByRole('textbox', { name: 'Find your next episode' }).fill('Season 1, episode 1');
      await page.getByRole('button', { name: /^Season 1, episode 1(?: ·|$)/ }).click();
      if (page === host) { const proposed = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'propose_episode'); await page.getByRole('button', { name: 'Propose this episode to group', exact: true }).click(); expect((await proposed).status()).toBe(200); }
      await page.getByRole('button', { name: 'I accept the proposed episode for this group, including any rewind or spoilers', exact: true }).click();
      const saved = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'show_progress');
      await page.getByRole('button', { name: 'Save my room progress', exact: true }).click(); expect((await saved).status()).toBe(200);
    }
    for (const page of pages) await page.getByRole('button', { name: 'I’m ready', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Start a short round', exact: true })).toBeEnabled();
    const started = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'start_round');
    await host.getByRole('button', { name: 'Start a short round', exact: true }).click();
    const startedResponse = await started; const startedBody = await startedResponse.json(); if (startedResponse.status() !== 200) throw new Error(`start_round ${startedResponse.status()}: ${startedBody.error?.code}: ${startedBody.error?.message}`); const startedState = startedBody.snapshot;
    const deck = startedState.shared.candidates; const kinds = [...new Set(deck.map(candidate => candidate.identity.kind))];
    expect(kinds).toEqual(expect.arrayContaining(['movie', 'show_start', 'show_continue']));
    for (const page of pages) await expect(page.getByText('Would you watch this?', { exact: true })).toBeVisible();
    const firstTitle = deck[0].title;
    const firstVote = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
    await host.getByRole('button', { name: 'Would watch', exact: true }).click(); expect((await firstVote).status()).toBe(200);
    await expect(couch.getByText(firstTitle, { exact: true })).toBeVisible();
    await couch.reload(); await expect(couch.getByText('Live room connected', { exact: true })).toBeVisible(); await expect(couch.getByText(firstTitle, { exact: true })).toBeVisible();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]; const count = deck.length - (i === 0 ? 1 : 0);
      for (let j = 0; j < count; j++) { const voted = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote'); await page.getByRole('button', { name: 'Would watch', exact: true }).click(); expect((await voted).status()).toBe(200); }
      await page.getByRole('button', { name: 'Finish my round', exact: true }).click();
      if (i < 2) { await expect(page.getByText('Your round is finished', { exact: true })).toBeVisible(); await expect(page.getByText('Your shared shortlist', { exact: true })).toHaveCount(0); }
    }
    for (const page of pages) await expect(page.getByText('Your shared shortlist', { exact: true })).toBeVisible();
    await host.setViewportSize({ width: 390, height: 1800 }); await host.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight) e.scrollTop = 0; });
    await host.screenshot({ path: 'artifacts/real-catalog-poc-shortlist-mobile.png', fullPage: true });
    const continuation = deck.find(candidate => candidate.identity.kind === 'show_continue');
    await host.getByText(continuation.title, { exact: true }).locator('..').getByRole('button', { name: 'Propose this', exact: true }).click();
    for (const page of pages) { await expect(page.getByText('One last check', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Yes, let’s watch this', exact: true }).click(); }
    await expect(host.getByRole('button', { name: 'Confirm the group’s choice', exact: true })).toBeEnabled();
    await host.getByRole('button', { name: 'Confirm the group’s choice', exact: true }).click();
    for (const page of pages) { await expect(page.getByText('You chose something good.', { exact: true })).toBeVisible(); await expect(page.getByText(continuation.title, { exact: true })).toBeVisible(); }
    for (const page of [host, remote]) { await page.setViewportSize({ width: 390, height: 1800 }); await page.evaluate(() => { for (const e of document.querySelectorAll('*')) if (e.scrollHeight > e.clientHeight) e.scrollTop = 0; }); }
    await host.screenshot({ path: 'artifacts/real-catalog-poc-choice-mobile.png', fullPage: true });
    await remote.screenshot({ path: 'artifacts/real-catalog-poc-remote-choice-mobile.png', fullPage: true });
    expect(errors).toEqual([]); expect(new Set(frames.map(f => f.client)).size).toBe(3);
    const report = { result: 'pass', clients: 3, viewingScreens: 2, setting: 'mixed', server: 'Actual YepWatch HTTP handler/domain + actual WS gateway + disposable Valkey', storage: 'Memory repository, not Crate', catalog: 'Real GoodWatch adapters; finite 36-title local snapshot, full country/service choice lists; no full-catalog coverage claim', kinds: ['movie', 'show_start', 'show_continue'], chosen: 'show_continue', episodeApproval: 'Host explicitly published canonical episode proposal; all three clients privately supplied progress and approved it', chosenEpisode: continuation.identity.episode, deckCount: deck.length, observedKinds: kinds, assertions: ['Visible landing-page create and fresh browser invitation joins', 'HttpOnly browser admissions', 'Explicit public host episode proposal, separate private history/approval', 'Realtime joins/readiness/progress', 'Own vote does not advance other client card', 'Browser reload restores own state and authenticates fresh socket', 'No early shortlist before all complete_round confirmations', 'Server shortlist, fenced proposal, all-client consent and confirmed decision', 'No private own or participant choice fields in received WS frames'], receivedSharedFrames: frames.length, javascriptErrors: errors.length };
    fs.writeFileSync('artifacts/real-catalog-poc.json', `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
  } catch (error) { fs.writeFileSync('artifacts/real-catalog-failure.json', JSON.stringify({ error: error.message, transportFailures }, null, 2) + '\n'); for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `artifacts/real-catalog-failure-${i}.png`, fullPage: true, mask: [pages[i].getByText(/^Room code:/).locator('..')] }).catch(() => {}); throw error; } finally { await Promise.all(contexts.map(c => c.close())); await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
