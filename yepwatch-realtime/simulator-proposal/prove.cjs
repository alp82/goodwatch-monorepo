// Ordinary visible UI proof. Own ephemeral controller; never uses retained8126.
const { chromium, expect } = require('../../yepwatch-app/node_modules/@playwright/test');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const reserve = net.createServer(); await new Promise(r => reserve.listen(0, '127.0.0.1', r)); const port = reserve.address().port;
  await new Promise(r => reserve.close(r));
  const child = spawn(process.execPath, ['--import', 'tsx', 'simulator-proposal/server.ts'], { cwd: root,
    env: { ...process.env, YEPWATCH_SIM_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let started = false; child.stdout.on('data', b => { if (b.toString().includes('proposal simulator:')) started = true; }); child.stderr.resume();
  const browser = await chromium.launch({ headless: true });
  const controls = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const guest = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], shared = [], activity = [];
  for (const page of [controls, guest]) page.on('pageerror', e => errors.push(e.message));
  const privateKeys = new Set(['own', 'votes', 'pickCount', 'isProposer', 'activeExposureMs', 'timingSource', 'nextCandidateId', 'currentCard', 'agreedBy', 'proposerParticipantId']);
  function clean(value) { if (!value || typeof value !== 'object') return true; return Object.entries(value).every(([k, v]) => !privateKeys.has(k) && clean(v)); }
  guest.on('websocket', ws => ws.on('framereceived', e => {
    try { const frame = JSON.parse(e.payload.toString()); if (frame.type === 'room.snapshot' || frame.type === 'room.updated') shared.push(frame.snapshot); else if (frame.type === 'activity') activity.push(frame); } catch {}
  }));
  const base = `http://127.0.0.1:${port}`;
  async function state() { return controls.evaluate(async () => { const r = await fetch('/simulator/events'); const reader = r.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; while (!buffer.includes('\n\n')) buffer += decoder.decode((await reader.read()).value); await reader.cancel(); return JSON.parse(buffer.slice('data: '.length, buffer.indexOf('\n\n'))); }); }
  async function button(page, name) { await page.getByRole('button', { name, exact: true }).click(); }
  async function peer(index, name) { const response = controls.waitForResponse(r => r.url() === `${base}/simulator/action`); await controls.locator('article.actor').nth(index).getByRole('button', { name, exact: true }).click(); expect((await response).status()).toBe(200); }
  async function shot(name) { await controls.screenshot({ path: path.join(root, 'artifacts', `proposal-simulator-${name}.png`), fullPage: true, mask: [controls.locator('#invite')] }); }
  try {
    await expect.poll(() => started, { timeout: 5000 }).toBe(true); fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
    await controls.goto(base); await controls.locator('#count').selectOption('2'); await button(controls, 'Create fresh room');
    await expect.poll(async () => (await state()).actors.length).toBe(2);
    const invite = (await state()).inviteCode;
    await guest.goto('http://127.0.0.1:8133');
    await guest.getByLabel('Your nickname').fill('Manual phone UI surrogate');
    await button(guest, 'Join with an invitation'); await guest.getByLabel('Room code or invitation').fill(invite); await button(guest, 'Join room');
    await guest.getByRole('button', { name: 'Ready to watch', exact: true }).click();
    await expect.poll(async () => (await state()).people).toBe(3);
    await button(controls, 'Ready artificial peers + start choosing');
    await expect(guest.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled({ timeout: 15000 });
    const initial = await state(); expect(initial.actors[0].privateCard.id).not.toBe(initial.actors[1].privateCard.id);
    await peer(0, 'Yep'); expect((await state()).actors[1].privateCard.id).toBe(initial.actors[1].privateCard.id);
    await shot('independent');
    const count = (await state()).shared.candidates.length;
    for (let n = 0; n < count; n++) {
      const response = guest.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
      await button(guest, 'Yep'); expect((await response).status()).toBe(200);
    }
    for (let n = 0; n < count; n++) for (let p = 0; p < 2; p++) await peer(p, 'Yep');
    await expect.poll(async () => (await state()).matches.length).toBeGreaterThan(1);
    const matches = (await state()).matches; expect(matches.every(m => m.averageYepMs === null)).toBe(true);
    await guest.getByRole('button', { name: /^Inspect \d+ matches/ }).click();
    await peer(0, `Propose / replace: ${matches[0].title}`); await peer(1, 'Agree to confirmed proposal');
    expect((await state()).proposal.agreeCount).toBe(2); await peer(1, 'Withdraw own agreement'); expect((await state()).proposal.agreeCount).toBe(1);
    await peer(0, `Propose / replace: ${matches[1].title}`); expect((await state()).proposal.previousCandidateId).toBe(matches[0].candidateId);
    await shot('replacement-withdrawal');
    await button(controls, 'Add late peer'); await expect.poll(async () => (await state()).actors.length).toBe(3);
    expect((await state()).proposal.requiredCount).toBe(4); expect((await state()).matches.length).toBe(0);
    await shot('latejoin');
    await peer(2, 'Agree to confirmed proposal');
    await peer(0, `Inspect shared poster: ${matches[1].title}`); await peer(0, 'Actual simulated lens interaction');
    await peer(0, 'Actual simulated dice interaction');
    await expect.poll(() => activity.some(a => a.inspection?.kind === 'dice')).toBe(true);
    await peer(2, 'Disconnect'); expect((await state()).people).toBe(4);
    await peer(1, 'Agree to confirmed proposal');
    expect((await state()).phase).toBe('choosing');
    await peer(2, 'Reconnect');
    const agree = guest.getByRole('button', { name: /^Agree to .+\. \d+ of \d+ agree$/ });
    await agree.click(); await expect.poll(async () => (await state()).phase, { timeout: 15000 }).toBe('decided');
    await shot('done'); await guest.screenshot({ path: path.join(root, 'artifacts', 'proposal-simulator-manual-browser-done.png') });
    expect(errors).toEqual([]); expect(shared.every(clean)).toBe(true); expect(activity.every(clean)).toBe(true); expect((await state()).privacyFailures).toBe(0);
    const report = { result: 'PASS', completedAt: new Date().toISOString(), api: 'http://127.0.0.1:15992', gateway: 'ws://127.0.0.1:4324', app: 'http://127.0.0.1:8133',
      controller: 'Own ephemeral process, no retained8126 access', catalog: 'Finite real sample over new disposable Crate; not full catalog',
      manualClient: 'Actual browser UI surrogate; not Android/USB proof', candidates: count, sharedFrames: shared.length, activityFrames: activity.length, javaScriptErrors: errors.length,
      checks: ['Fresh native controlled peers and independent ordinary browser admission', 'Independent cards and one-person isolation', 'Actual UI votes and complete-roster timing honestly unavailable',
        'Propose/agree/withdraw/replacement', 'Pending proposal retained across latejoin', 'Current shared-match poster/lens/dice actions', 'Disconnected participant remains required', 'Reconnect and automatic fresh-check Done'],
      credentialsInvitationsAndRoomIdentifiersRedacted: true, privateFieldsOnProductFrames: false };
    fs.writeFileSync(path.join(root, 'artifacts', 'proposal-simulator-visible.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  } catch (error) { await controls.screenshot({ path: path.join(root, 'artifacts', 'proposal-simulator-failure.png'), fullPage: true, mask: [controls.locator('#invite')] }).catch(() => {}); console.error(error.message); process.exitCode = 1; }
  finally { await browser.close(); await new Promise(resolve => { if (child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill('SIGTERM'); }); }
})();
