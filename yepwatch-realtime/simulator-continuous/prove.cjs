/** Fresh-room visible proof. Starts/stops ONLY its own ephemeral controller. */
const { chromium, expect } = require('../../yepwatch-app/node_modules/@playwright/test');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(__dirname, '../artifacts');
const real = process.env.YEPWATCH_SIM_CATALOG === 'real-sample';
const prefix = real ? 'continuous-simulator-real' : 'continuous-simulator';
const config = Object.fromEntries(['YEPWATCH_SIM_API_ORIGIN', 'YEPWATCH_SIM_WS_ORIGIN', 'YEPWATCH_SIM_APP_ORIGIN', 'YEPWATCH_SIM_SERVICE_ID', 'YEPWATCH_SIM_CATALOG'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const safe = value => String(value).replace(/https?:\/\/[^\s]*\/r\/[^\s]*/g, '[redacted invitation]');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const reservation = createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['--import', 'tsx', 'simulator-continuous/server.ts'], { cwd: path.resolve(__dirname, '..'),
    env: { PATH: process.env.PATH, YEPWATCH_SIM_PORT: String(port), ...config }, stdio: ['ignore', 'pipe', 'pipe'] });
  let started = false; child.stdout.on('data', raw => { if (raw.toString().includes('continuous simulator:')) started = true; }); child.stderr.resume();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), errors = [], snapshots = [], activity = [];
  page.on('pageerror', error => errors.push(safe(error.message)));
  page.on('websocket', socket => socket.on('framereceived', raw => {
    const frame = JSON.parse(String(raw.payload));
    if (frame.type === 'room.snapshot' || frame.type === 'room.updated') {
      for (const key of ['own', 'votes', 'pick', 'receipt', 'history', 'currentCard']) if (key in frame.snapshot) throw Error('Private shared field');
      for (const p of frame.snapshot.participants) for (const key of ['candidateId', 'value', 'direction', 'votes', 'pick', 'currentCard', 'completedCount']) if (key in p) throw Error('Private participation field');
      for (const m of frame.snapshot.matches) for (const key of Object.keys(m)) if (!['candidateId', 'pickCount'].includes(key)) throw Error('Private match ownership');
      snapshots.push({ phase: frame.snapshot.phase, revision: frame.snapshot.revision });
    }
    if (frame.type === 'activity') {
      const allowed = ['type', 'roomId', 'participantId', 'sessionId', 'sequence', 'serverTime', 'expiresAt', 'view', 'gesture', 'beat'];
      if (Object.keys(frame).some(k => !allowed.includes(k))) throw Error('Unsafe activity field');
      activity.push({ view: frame.view, gesture: frame.gesture, beat: frame.beat });
    }
  }));
  const actor = index => page.locator('.actor').nth(index);
  const action = (index, label) => actor(index).getByRole('button', { name: label, exact: true });
  const state = () => page.evaluate(() => current);
  const shot = name => page.screenshot({ path: path.join(directory, name.replace('continuous-simulator', prefix)), fullPage: true });
  let cardCount = 0;
  async function clickAction(index, label) {
    await expect(action(index, label)).toBeEnabled();
    const response = page.waitForResponse(r => r.url().endsWith('/simulator/action'));
    await action(index, label).click(); expect((await response).status()).toBe(200);
    await expect.poll(async () => (await state()).actors.filter(a => !a.host)[index].busy).toBe(false);
    await expect(page.locator('#error')).toBeHidden();
  }
  async function fresh(scenario) {
    await expect.poll(async () => !(await state())?.actors?.some(a => a.busy || a.pending)).toBe(true);
    await page.locator('#scenario').selectOption(scenario); await page.locator('#pace').selectOption('700');
    await page.getByRole('button', { name: 'Create fresh demo + open host app', exact: true }).click();
    await expect(page.locator('#notice')).toContainText('Fresh real continuous room', { timeout: 20000 });
    const host = page.frameLocator('#host');
    await expect(host.getByRole('button', { name: 'Start choosing', exact: true })).toBeEnabled({ timeout: 15000 });
    await host.getByRole('button', { name: 'Start choosing', exact: true }).click();
    await expect(host.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled({ timeout: 15000 });
    await expect.poll(async () => (await state()).actors.filter(a => !a.host).every(a => a.privateCard && a.privateCaughtUp)).toBe(true);
    cardCount = (await state()).shared.candidates.length;
    return host;
  }
  async function hostVoteAll(host) {
    let count = 0;
    const expected = (await state()).shared.candidates.length;
    for (let limit = 0; limit < expected; limit++) {
      await expect(host.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled();
      const response = page.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
      await host.getByRole('button', { name: 'Yep', exact: true }).click();
      expect((await response).status()).toBe(200); count++;
      await expect.poll(async () => (await state()).actors.find(a => a.host).privateAnswered).toBe(count);
    }
    return count;
  }
  try {
    await expect.poll(() => started, { timeout: 5000 }).toBe(true); fs.mkdirSync(directory, { recursive: true });
    await page.goto(`http://127.0.0.1:${port}`);
    let host = await fresh('agreement');
    let before = (await state()).actors.filter(a => !a.host);
    expect(before[0].privateCard.id).not.toBe(before[1].privateCard.id);
    await clickAction(0, 'Step');
    expect((await state()).actors.filter(a => !a.host)[1].privateCard.id).toBe(before[1].privateCard.id);
    await clickAction(1, 'Simulate trailer');
    await expect.poll(() => activity.some(a => a.view === 'trailer')).toBe(true);
    await shot('continuous-simulator-independent-cards.png');
    await clickAction(1, 'Disconnect');
    const hostVotes = await hostVoteAll(host);
    await page.getByRole('button', { name: 'Run automatically', exact: true }).click();
    await expect.poll(async () => (await state()).actors.filter(a => !a.host)[0].privateAnswered, { timeout: 10000 }).toBe(cardCount);
    expect((await state()).shared.matches.length).toBe(0); expect((await state()).shared.phase).toBe('choosing');
    await shot('continuous-simulator-disconnected-wait.png');
    await clickAction(1, 'Reconnect'); await clickAction(1, 'Resume person');
    await expect.poll(async () => (await state()).actors.filter(a => !a.host).every(a => a.privatePick), { timeout: 15000 }).toBe(true);
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    await page.getByRole('button', { name: 'Add late guest', exact: true }).click();
    await expect.poll(async () => (await state()).actors.length).toBe(4);
    await expect.poll(async () => (await state()).shared.matches.length).toBe(0);
    expect((await state()).actors.every(a => !a.privatePick)).toBe(true);
    await shot('continuous-simulator-latejoin-invalidation.png');
    await page.getByRole('button', { name: 'Run automatically', exact: true }).click();
    await expect.poll(async () => (await state()).actors.filter(a => !a.host).every(a => a.privatePick), { timeout: 15000 }).toBe(true);
    const picked = (await state()).actors.filter(a => !a.host)[0].privatePick;
    const title = (await state()).shared.candidates.find(c => c.id === picked).title;
    await host.getByRole('button', { name: /Inspect \d+ (?:shared )?matches/ }).click();
    await host.getByRole('button', { name: `Inspect ${title}`, exact: true }).click();
    await host.getByRole('button', { name: 'Pick this', exact: true }).click();
    await expect(page.locator('#phase')).toHaveText('Room · decided', { timeout: 15000 });
    await expect(host.getByText('Everyone picked it. Enjoy your watch.', { exact: true })).toBeVisible();
    await shot('continuous-simulator-agreement-done.png');
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    host = await fresh('disagreement');
    await page.getByRole('button', { name: 'Run automatically', exact: true }).click(); await hostVoteAll(host);
    await expect.poll(async () => (await state()).actors.filter(a => !a.host).every(a => a.privateAnswered === cardCount), { timeout: 15000 }).toBe(true);
    expect((await state()).shared.matches.length).toBe(0); expect((await state()).shared.phase).toBe('choosing');
    await shot('continuous-simulator-disagreement.png');
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    host = await fresh('slow');
    await clickAction(1, 'Pause person'); await page.getByRole('button', { name: 'Run automatically', exact: true }).click(); await hostVoteAll(host);
    await expect.poll(async () => (await state()).actors.filter(a => !a.host)[0].privateAnswered, { timeout: 15000 }).toBe(cardCount);
    expect((await state()).actors.filter(a => !a.host)[1].privateAnswered).toBe(0); expect((await state()).shared.matches.length).toBe(0);
    await shot('continuous-simulator-slow-paused.png');
    await clickAction(1, 'Resume person');
    await expect.poll(async () => (await state()).shared.matches.length, { timeout: 15000 }).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause automatic guests', exact: true }).click();
    expect(errors).toEqual([]); expect((await state()).privacyFailures).toBe(0);
    const report = { result: 'PASS', scope: 'Ephemeral controller using current fixed source; actual configured Glow/API/WS; fresh rooms only',
      api: config.YEPWATCH_SIM_API_ORIGIN || 'http://127.0.0.1:15994', gateway: config.YEPWATCH_SIM_WS_ORIGIN || 'ws://127.0.0.1:4321', app: config.YEPWATCH_SIM_APP_ORIGIN || 'http://127.0.0.1:8131',
      catalog: real ? 'Finite real-catalog sample over actual durable disposable Crate' : 'Explicitly synthetic catalog over actual durable disposable Crate', cardCount, independentInitialClients: 3, clientsAfterLateJoin: 4,
      scenarios: ['Independent cards and one-person action isolation', 'Neutral trailer view cue', 'Disconnect/reconnect retains required voter',
        'Immediate matches and private picks', 'Latejoin invalidates matches/picks', 'All current picks automatic Done', 'Disagreement keeps choosing/no majority substitute', 'Slow/pause/resume waits'],
      hostVotes, sharedFrames: snapshots.length, activityFrames: activity.length, privateFieldsOnSharedFrames: false,
      javascriptErrors: errors, retained8122Accessed: false, retainedAppsApisGatewaysRestarted: false, invitesCredentialsAndPrivateVotesRedacted: true };
    fs.writeFileSync(path.join(directory, `${prefix}-proof.json`), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } catch (error) { await shot('continuous-simulator-proof-failure.png').catch(() => {}); throw error; }
  finally {
    await context.close(); await browser.close(); child.kill('SIGTERM');
    for (let n = 0; n < 30 && child.exitCode === null; n++) await wait(50);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
})().catch(error => { console.error(safe(error.message)); process.exitCode = 1; });
