#!/usr/bin/env node
// Android E2E runner.  node e2e/native/run.mjs gate|full [--only=name,name] [--keep]
// gate: the < 3 min Android share of the overall gate. full: everything, incl. long background, mixed rooms.
// No retries: a step that fails once fails the run. Results: e2e/native/.cache/runs/<stamp>/result.json
import fs from 'node:fs';
import path from 'node:path';
import { budgetsFor } from './budgets.mjs';
import { ensureApk, PACKAGE } from './lib/build.mjs';
import { boot, install, reverse, shutdown } from './lib/device.mjs';
import { RUNS_DIR, log, mkdirp, sleep } from './lib/env.mjs';
import { Logcat, a11yAudit, blockingWords, gfxFrames, gfxReset } from './lib/gates.mjs';
import { createRoom, freshStart, toStart, fillAndSubmit, hostAction, inviteUrl, joinFromJoinScreen, measure, pickNetflix, posterTitle, roiOf, tapAction } from './lib/journey.mjs';
import { Phone } from './lib/phone.mjs';
import { resolveStack, stackPorts } from './lib/stack.mjs';

const mode = process.argv[2] ?? 'gate';
const only = (process.argv.find(a => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const keep = process.argv.includes('--keep');
const B = budgetsFor();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const RUN = mkdirp(path.join(RUNS_DIR, `${mode}-${stamp}`));
const result = { mode, startedAt: new Date().toISOString(), phases: {}, scenarios: [], gates: { timing: [], flash: [], errors: [], a11y: [], stuck: [], frames: [], journey: [] } };
const t0 = Date.now();
const phase = (name, ms) => { result.phases[name] = ms; };

// ---------- gate recorders ----------
function timing(name, budget, r, extra = {}) {
  const row = { name, budgetMs: budget, ...extra };
  if (!r?.ok) Object.assign(row, { pass: false, error: r?.error ?? 'not measured' });
  else Object.assign(row, { ms: extra.use === 'settled' ? r.settledMs : r.ms, firstMs: r.ms, settledMs: r.settledMs, pass: (extra.use === 'settled' ? r.settledMs : r.ms) <= budget, resolutionMs: r.resolutionMs, clockErrMs: r.clockErrMs, maxGapMs: r.maxGapMs, video: path.relative(RUN, r.file) });
  result.gates.timing.push(row);
  log(`  timing ${name}: ${row.ms ?? '-'} ms (first change ${row.firstMs ?? '-'}, settled ${row.settledMs ?? '-'}) budget ${budget} ${row.pass ? 'ok' : 'FAIL'}${row.error ? ' ' + row.error : ''}`);
  if (r?.ok && r.flash?.failed) {
    result.gates.flash.push({ name, blankFrames: r.flash.blank.length, spikes: r.flash.spikes, intermediate: r.flash.plateaus, frames: path.relative(RUN, r.file.replace(/\.webm$/, '-frames')) });
    log(`  flash ${name}: ${JSON.stringify({ blank: r.flash.blank.length, spikes: r.flash.spikes.length, plateaus: r.flash.plateaus.length })}`);
  }
}
const audited = new Set();
async function audit(p, screen) {
  if (audited.has(screen)) return;
  audited.add(screen);
  for (const f of a11yAudit(await p.nodes(), { screen, minDp: B.native.minTargetDp })) result.gates.a11y.push(f);
}
async function notStuck(p, where) {
  const words = blockingWords(await p.nodes());
  if (words.length) { result.gates.stuck.push({ where, phone: p.name, words }); log(`  stuck ${where}: ${words.join(' | ')}`); }
}

// ---------- scenario runner ----------
let phones = []; let logcats = [];
async function scenario(name, fn, { modes = ['gate', 'full'] } = {}) {
  if (!modes.includes(mode) || (only.length && !only.includes(name))) return;
  for (const l of logcats) l.mark(name);
  const started = Date.now(); log(`▶ ${name}`);
  const row = { name, pass: true };
  try { await fn(); } catch (e) {
    row.pass = false; row.error = e.message; if (e.screen) row.screen = e.screen;
    for (const p of phones) { try { row[`shot${p.name}`] = path.relative(RUN, p.screenshot(path.join(RUN, `fail-${name}-${p.name}.png`))); } catch { /* best effort */ } }
    log(`✖ ${name}: ${e.message}`);
  }
  row.ms = Date.now() - started; result.scenarios.push(row);
  if (row.pass) log(`✔ ${name} (${row.ms} ms)`);
  return row.pass;
}
function journeyFail(name, detail, phone) {
  const row = { name, detail };
  if (phone) { try { row.shot = path.relative(RUN, phone.screenshot(path.join(RUN, `journey-${name.replace(/\W+/g, '-')}-${phone.name}.png`))); } catch { /* best effort */ } }
  result.gates.journey.push(row); log(`  journey ${name}: ${detail}`);
}

// ---------- shared state between scenarios ----------
const S = {};

async function main() {
  const stack = resolveStack();
  result.stack = { source: stack.source, api: stack.api, ws: stack.ws, app: stack.app, capabilities: stack.capabilities };
  log('stack', JSON.stringify(result.stack));
  let t = Date.now();
  const apk = await ensureApk(stack);
  phase('apk', Date.now() - t); result.apk = apk; log('apk', apk.gradle ? 'gradle' : apk.repack ? 'repacked js' : 'cached', apk.ms, 'ms');
  t = Date.now();
  const devs = await boot(2);
  phase('boot', Date.now() - t); result.devices = devs;
  t = Date.now();
  const ports = stackPorts(stack);
  await Promise.all(devs.map(async (d, i) => { reverse(d.serial, ports); install(d.serial, apk.apk); }));
  phones = [];
  for (const [i, d] of devs.entries()) phones.push(await new Phone(d.serial, i, i ? 'B' : 'A').start());
  logcats = phones.map(p => new Logcat(p).start());
  phase('install', Date.now() - t);
  const [A, Bp] = phones;
  const vid = name => path.join(RUN, 'video', `${name}.webm`);

  // ---- cold start (first visit, then returning) ----
  await scenario('cold-start', async () => {
    A.forceStop(); A.sh(`pm clear ${PACKAGE}`);
    let am;
    const first = await measure({ actor: A, phones: [A], file: vid('cold-first'), targets: { A: roiOf(A, 'New room', 20000) },
      action: hostAction(() => { am = A.launch(); }), settleMs: 800 });
    timing('cold start, first visit -> start page usable', B.native.coldStartUsableMs, first.A, { amStartTotalTime: am.totalTime, use: 'settled' });
    await audit(A, 'start page (first visit)');
    A.forceStop(); await sleep(500);
    const again = await measure({ actor: A, phones: [A], file: vid('cold-again'), targets: { A: roiOf(A, 'New room', 20000) },
      action: hostAction(() => { am = A.launch(); }), settleMs: 800 });
    timing('cold start, returning -> start page usable', B.native.coldStartUsableMs, again.A, { amStartTotalTime: am.totalTime, use: 'settled' });
  });

  // ---- create room on A, with New room / Create room timings, a11y, back priority ----
  await scenario('create-room', async () => {
    const tile = await A.find('New room', { timeout: 15000 });
    const nr = await measure({ actor: A, phones: [A], file: vid('new-room'), action: tapAction(A, tile), targets: { A: roiOf(A, 'Mood') } });
    timing('New room -> Mood page', B.newRoomMs, nr.A);
    await audit(A, 'mood page');
    await A.tap('cheer me up');
    const create = await A.find('Create room');
    const cr = await measure({ actor: A, phones: [A], file: vid('create-room'), action: tapAction(A, create), targets: { A: roiOf(A, 'share-row', 10000) } });
    timing('Create room -> room page', B.createRoomMs, cr.A);
    await notStuck(A, 'room page after create');
    await audit(A, 'room page (host, before start)');
    await A.tap(/^Streaming services/);
    await A.waitFor('services-sheet');
    await audit(A, 'services sheet');
    A.back(); // back priority: the sheet closes, the room stays
    await A.waitGone('services-sheet', { timeout: 3000 });
    if (!(await A.has('room-setup'))) journeyFail('back priority', 'Back on the services sheet left the room page');
    await A.tap(/^Streaming services/);
    await pickNetflix(A);
    // Android: typing a name then hiding the keyboard with Back must still save it.
    await A.fill('Your name', 'Ann'); await sleep(150); A.back(); await sleep(1500);
    const field = (await A.nodes()).find(n => n.desc === 'Your name' && /EditText/.test(n.cls));
    if (field && field.text === 'Ann') {
      journeyFail('host name lost on keyboard Back', 'Typed "Ann", hid the keyboard with Back: the name stays an uncommitted draft (friends see "?" and "Waiting for the host to start") until Enter/blur');
      await A.tap('Your name'); A.key('KEYCODE_ENTER'); await sleep(400);
    }
    S.code = (await (await import('./lib/journey.mjs')).inviteCode(A));
  });

  // ---- B: invitation link with the app installed and backgrounded ----
  await scenario('invite-installed', async () => {
    if (!S.code) throw new Error('no room from create-room');
    await freshStart(Bp); Bp.home(); await sleep(800);
    let am;
    const r = await measure({ actor: Bp, phones: [Bp], file: vid('invite-installed'), targets: { B: roiOf(Bp, 'Join', 10000) },
      action: hostAction(() => { am = Bp.openLink(inviteUrl(S.code)); }) });
    timing('invite link (app in background) -> join page', B.native.inviteInstalledMs, r.B, { amStart: am, use: 'settled' });
    await audit(Bp, 'join page');
    await joinFromJoinScreen(Bp, 'Bob');
    await audit(Bp, 'room page (friend, waiting)');
    await A.waitFor('2 people, people', { timeout: 5000 });
  });

  // ---- Start -> first card on host and friend ----
  await scenario('start-round', async () => {
    const start = await A.find('Start');
    const r = await measure({ actor: A, phones: [A, Bp], file: vid('start'), action: tapAction(A, start),
      targets: { A: roiOf(A, 'poster', 10000), B: roiOf(Bp, 'poster', 10000) } });
    timing('Start -> first card (host)', B.startToFirstCardMs, r.A);
    timing('Start -> first card (friend)', B.startToPeerVotingMs, r.B);
    await audit(A, 'voting');
    S.firstCard = { A: await posterTitle(A), B: await posterTitle(Bp) };
    if (!S.firstCard.A || !S.firstCard.B) journeyFail('empty deck', JSON.stringify(S.firstCard));
  });

  // ---- vote on one phone -> other phone; frame pacing while voting ----
  await scenario('vote-to-peer', async () => {
    // B says Yep to its next cards; A skips (Nope) to one of them, then its Yep makes the match.
    const bYeps = new Set();
    for (let i = 0; i < 4; i++) { const t = await posterTitle(Bp); if (t) bYeps.add(t); await Bp.tap('Yep'); await sleep(350); }
    for (let i = 0; i < 12 && !bYeps.has(await posterTitle(A)); i++) { const t = await posterTitle(A); await A.tap('Nope'); const end = Date.now() + 3000; while (Date.now() < end && (await posterTitle(A)) === t) await sleep(60); }
    if (!bYeps.has(await posterTitle(A))) throw new Error(`decks never overlapped: B said Yep to ${[...bYeps].join(', ')}`);
    await sleep(600);
    const yep = await A.find('Yep');
    const r = await measure({ actor: A, phones: [A, Bp], file: vid('vote-to-peer'), action: tapAction(A, yep),
      targets: { B: async () => (await Bp.waitFor(/^\d+ match(es)?$/, { timeout: 5000 })).bounds } });
    timing('Yep on A -> match shows on B', B.voteToPeerMs, r.B);
    // Frame pacing: swipe 6 cards on A with real drags (Yep/Nope effects animate).
    await A.waitFor('poster');
    gfxReset(A);
    for (let i = 0; i < 6; i++) {
      const before = await posterTitle(A);
      await A.swipe(540, 1300, i % 2 ? 100 : 980, 1250, 180);
      const end = Date.now() + 3000;
      while (Date.now() < end && (await posterTitle(A)) === before) await sleep(60);
      if ((await posterTitle(A)) === before) { journeyFail('swipe', `card "${before}" did not leave after a swipe`); break; }
      if (!(await posterTitle(A))) journeyFail('empty deck', `no card after swipe ${i + 1}`);
    }
    const gfx = gfxFrames(A);
    result.gates.frames.push({ name: 'voting swipes (A)', budgetMs: B.native.frameMaxMs, ...gfx.summary, pass: gfx.summary.over20 === 0 });
    log(`  frames: ${JSON.stringify(gfx.summary)}`);
    await notStuck(A, 'voting'); await notStuck(Bp, 'voting');
  });

  // ---- match -> Matches -> proposal -> Tonight on both ----
  await scenario('decide', async () => {
    await A.tap(/^\d+ match(es)?$/);
    await A.waitFor('matches');
    await audit(A, 'matches');
    await A.tap('Propose this');
    await Bp.waitFor('Agree', { timeout: 5000 });
    await audit(Bp, 'proposal (friend)');
    const agree = await Bp.find('Agree');
    const r = await measure({ actor: Bp, phones: [A, Bp], file: vid('agree'), action: tapAction(Bp, agree),
      targets: { A: roiOf(A, 'tonight-poster', 8000), B: roiOf(Bp, 'tonight-poster', 8000) } });
    timing('Agree on B -> Tonight on A (peer)', B.voteToPeerMs, r.A, { informational: true });
    await audit(A, 'tonight (host)');
  });

  // ================= full only =================
  await scenario('restart-round', async () => {
    await A.tap('Start again');
    await A.waitFor('room-setup', { timeout: 8000 });
    await A.tap('Start');
    await A.waitFor('poster', { timeout: 8000 });
    await Bp.waitFor('poster', { timeout: 8000 });
  }, { modes: ['full'] });

  await scenario('details-and-back', async () => {
    await A.tap(/^Details about /);
    await A.waitFor('details-panel', { timeout: 5000 });
    await audit(A, 'details');
    A.back();
    await A.waitGone('details-panel', { timeout: 3000 });
    if (!(await A.has('poster'))) journeyFail('back priority', 'Back on details did not return to the card');
  }, { modes: ['full'] });

  await scenario('back-everywhere', async () => {
    // Each sheet: Back closes the sheet and keeps the screen under it.
    for (const [open, sheet] of [['Profile', 'profile-panel'], [/switch room$/, 'rooms-sheet']]) {
      await A.tap(open); await A.waitFor(sheet, { timeout: 4000 });
      await audit(A, `sheet ${sheet}`);
      A.back(); await A.waitGone(sheet, { timeout: 3000 });
      if (!(await A.has('voting'))) journeyFail('back priority', `Back on ${sheet} left voting`);
    }
    // Screen level: Back from voting goes to the start page (app stays open).
    A.back(); await sleep(800);
    const top = A.foreground();
    if (!top.includes(PACKAGE)) journeyFail('back', `Back from voting left the app: ${top}`);
    else { await A.waitFor('New room', { timeout: 4000 }).catch(() => journeyFail('back', 'Back from voting did not reach the start page')); }
    await audit(A, 'start page (returning)');
    // Return to the room through the open-room card.
    await A.tap(/cheer me up/);
    await A.waitFor('voting', { timeout: 6000 });
  }, { modes: ['full'] });

  await scenario('rapid-taps', async () => {
    const yep = await A.find('Yep'); const before = await posterTitle(A);
    for (let i = 0; i < 8; i++) { A.tapXY(yep.cx, yep.cy).catch(() => {}); await sleep(40); }
    await sleep(2000);
    if ((await posterTitle(A)) === before) journeyFail('rapid taps', 'eight fast Yep taps did not move past the card');
    await notStuck(A, 'after rapid taps');
    if (!A.foreground().includes(PACKAGE)) journeyFail('rapid taps', 'app left the foreground');
  }, { modes: ['full'] });

  await scenario('kill-relaunch-mid-vote', async () => {
    const before = await posterTitle(A);
    A.forceStop(); await sleep(500);
    A.launch();
    const back = await A.waitFor('poster', { timeout: 15000 }).then(() => true, () => false);
    if (!back) {
      const seen = (await A.nodes()).map(n => n.desc || n.text).filter(Boolean).slice(0, 25).join(' | ');
      journeyFail('kill+relaunch', `relaunch mid-vote did not return to the room's card within 15 s; screen: ${seen}`, A);
      await A.tap(/cheer me up/); await A.waitFor('poster', { timeout: 8000 });
    }
    const after = await posterTitle(A);
    await sleep(2500); await notStuck(A, 'after relaunch');
    result.notes = [...(result.notes ?? []), `kill+relaunch: card before "${before}", after "${after}"`];
  }, { modes: ['full'] });

  await scenario('background-resume', async () => {
    const minutes = Number(process.env.YW_E2E_BACKGROUND_MIN ?? B.native.backgroundMinutesFull);
    A.home(); log(`  backgrounded ${minutes} min`);
    await sleep(minutes * 60000);
    A.sh(`am start -n ${PACKAGE}/.MainActivity`);
    if (!(await A.waitFor('voting', { timeout: 8000 }).then(() => true, () => false))) journeyFail('background resume', `not on voting after resuming from ${minutes} min in background`, A);
    await sleep(3000); await notStuck(A, `resume after ${minutes} min`);
    // Live again? B votes Yep on its current card; A has to see its own matches chip stay consistent and no error.
    await Bp.tap('Yep'); await sleep(1500); await notStuck(A, 'after peer vote post-resume');
  }, { modes: ['full'] });

  await scenario('cold-invite-link', async () => {
    // A makes another room; B's app is killed; the link cold-starts it.
    await toStart(A);
    const code = await createRoom(A, { name: '' });
    Bp.forceStop(); await sleep(500);
    let am;
    const r = await measure({ actor: Bp, phones: [Bp], file: vid('invite-cold'), targets: { B: roiOf(Bp, 'Join', 20000) },
      action: hostAction(() => { am = Bp.openLink(inviteUrl(code)); }) });
    timing('invite link (app not running) -> join page', B.native.inviteColdMs, r.B, { amStart: am, use: 'settled' });
    await joinFromJoinScreen(Bp, 'Bob');
    S.code2 = code;
  }, { modes: ['full'] });

  await scenario('leave-archive-restore', async () => {
    // B leaves through the room sheet.
    await Bp.tap(/switch room$/); await Bp.tap(/Room page$/); await Bp.waitFor('room-sheet');
    await audit(Bp, 'room sheet (friend)');
    await Bp.tap('Leave room');
    if (await Bp.has('leave-confirm')) { await audit(Bp, 'leave confirm'); await Bp.tap({ desc: 'Leave room', index: 1 }).catch(() => Bp.tap('Leave')); }
    await Bp.waitFor('New room', { timeout: 8000 });
    // A archives, then restores from History.
    await A.tap(/switch room$/); await A.tap(/Room page$/); await A.waitFor('room-sheet');
    await A.tap('Archive room');
    await A.waitFor('New room', { timeout: 8000 });
    await A.tap(/^Decided, |History/, { timeout: 5000 }).catch(() => journeyFail('archive', 'no History entry on the start page after archiving'));
    if (await A.has('history-panel')) { await audit(A, 'history'); await A.tap(/^Restore/).catch(() => journeyFail('archive', 'no Restore in History')); }
  }, { modes: ['full'] });

  await scenario('mixed-android-host-web-guest', async () => {
    const { mixedHostAndroid } = await import('./lib/mixed.mjs');
    await mixedHostAndroid({ phone: A, stack, runDir: RUN, timing, journeyFail });
  }, { modes: ['full'] });
  await scenario('mixed-web-host-android-guest', async () => {
    const { mixedHostWeb } = await import('./lib/mixed.mjs');
    await mixedHostWeb({ phone: Bp, stack, runDir: RUN, timing, journeyFail });
  }, { modes: ['full'] });

  await scenario('maestro-flows', async () => {
    const { runFlows } = await import('./lib/maestro.mjs');
    const r = await runFlows(A, ['smoke-create-room.yaml'], RUN);
    result.maestro = r;
    if (!r.pass) throw new Error(`maestro flows failed: ${r.failed.join(', ')}`);
  }, { modes: ['full'] });

  await scenario('maestro-two-phone-journey', async () => {
    // The same journey through the YAML flows only (what iOS runs on EAS), two phones in sequence.
    const { runFlows } = await import('./lib/maestro.mjs');
    const steps = [];
    const flow = async (p, f, env) => { const r = await runFlows(p, [f], RUN, env); steps.push(...r.results.map(x => ({ phone: p.name, ...x }))); if (!r.pass) throw new Error(`maestro ${f} failed on ${p.name}`); };
    try {
      await flow(A, 'smoke-create-room.yaml', { NAME: 'Ann' });
      const code = await (await import('./lib/journey.mjs')).inviteCode(A);
      Bp.home();
      await flow(Bp, 'join-by-link.yaml', { INVITE_URL: inviteUrl(code), NAME: 'Bob' });
      await flow(A, 'host-start-and-vote.yaml');
      await flow(Bp, 'guest-vote-yep.yaml');
      await flow(A, 'host-propose.yaml');
      await flow(Bp, 'guest-agree.yaml');
    } finally { result.maestro = steps; }
  }, { modes: ['maestro'] });

  for (const [i, l] of logcats.entries()) for (const f of l.stop(path.join(RUN, `logcat-${phones[i].name}.txt`))) result.gates.errors.push({ phone: phones[i].name, ...f });
  for (const p of phones) p.close();
  if (!keep && process.env.YW_E2E_SHUTDOWN === '1') shutdown();
}

try { await main(); } catch (e) { result.fatal = e.stack; log('FATAL', e.message); }
result.wallMs = Date.now() - t0;
const g = result.gates;
result.summary = {
  scenarios: `${result.scenarios.filter(s => s.pass).length}/${result.scenarios.length}`,
  timingFails: g.timing.filter(x => !x.pass && !x.informational).length, flash: g.flash.length, errors: g.errors.length,
  a11y: g.a11y.length, stuck: g.stuck.length, frames: g.frames.filter(f => !f.pass).length, journey: g.journey.length,
};
result.pass = !result.fatal && result.scenarios.every(s => s.pass) && Object.entries(result.summary).every(([k, v]) => k === 'scenarios' || v === 0);
fs.writeFileSync(path.join(RUN, 'result.json'), JSON.stringify(result, null, 2));
log(`${result.pass ? 'PASS' : 'FAIL'} ${mode} in ${(result.wallMs / 1000).toFixed(1)} s ${JSON.stringify(result.summary)} phases ${JSON.stringify(result.phases)}`);
log('result', path.join(RUN, 'result.json'));
process.exit(result.pass ? 0 : 1);
