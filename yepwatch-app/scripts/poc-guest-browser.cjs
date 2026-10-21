/** Actual API/gateway/catalog UI smoke. Only fresh rooms. No invitations/credentials in artifacts. */
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
const origin = process.env.POC_APP_ORIGIN ?? 'http://127.0.0.1:8097';
async function main() {
  const browser = await chromium.launch({ headless: true });
  const errors = []; const commands = []; const sharedFrames = []; const contexts = [];
  let actions = 0; let config; let voted = 0;
  const action = async fn => { await fn(); actions++; };
  try {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', reducedMotion: 'reduce' }); contexts.push(hostContext);
    const host = await hostContext.newPage();
    host.on('pageerror', e => errors.push(e.message));
    host.on('response', async r => { if (r.url().endsWith('/commands') && r.request().method() === 'POST') { commands.push({ type: r.request().postDataJSON()?.command?.type, status: r.status() }); } });
    host.on('websocket', socket => socket.on('framereceived', event => { const f = JSON.parse(String(event.payload)); if (f.snapshot) { if ('own' in f.snapshot) throw Error('Private own on shared frame'); for (const p of f.snapshot.participants) for (const key of ['votes', 'progress', 'consent', 'currentCardId', 'candidateId', 'direction']) if (key in p) throw Error('Private activity field'); sharedFrames.push({ revision: f.snapshot.revision, phase: f.snapshot.phase }); } }));
    await host.goto(origin);
    await action(() => host.getByRole('button', { name: 'Continue as guest', exact: true }).click());
    await action(() => host.getByRole('textbox', { name: 'Your nickname', exact: true }).fill('Alex'));
    await action(() => host.getByRole('button', { name: 'Create a room', exact: true }).click());
    await expect(host.getByText('Live room connected', { exact: true })).toBeVisible();
    await expect(host.getByText('Our screen · Germany', { exact: true })).toBeVisible();
    await expect(host.getByRole('textbox', { name: 'Find a show to continue' })).toHaveCount(0);
    await expect(host.getByRole('textbox', { name: 'Time available in minutes (optional)' })).toHaveCount(0);
    const service = host.getByRole('button', { name: 'Netflix (service 8)', exact: true });
    await expect(service).toBeEnabled(); await expect(service).not.toHaveAttribute('aria-selected', 'true');
    await expect(host.getByRole('button', { name: 'Use these services', exact: true })).toBeDisabled();
    await host.screenshot({ path: 'artifacts/guest-defaults-mobile.png', fullPage: true });
    await action(() => service.click());
    const saved = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'setup');
    await action(() => host.getByRole('button', { name: 'Use these services', exact: true }).click());
    const saveResponse = await saved; expect(saveResponse.status()).toBe(200);
    const state = (await saveResponse.json()).snapshot;
    config = { kinds: state.shared.constraints.kinds, screens: state.shared.screens.map(s => ({ country: s.country, serviceIds: s.serviceIds, confirmed: s.confirmed })), hostReadyBeforeStart: state.shared.participants.find(p => p.participantId === state.own.participantId).ready };
    expect(config.kinds).toEqual(['movie', 'show_start']); expect(config.screens).toEqual([{ country: 'DE', serviceIds: [8], confirmed: true }]); expect(config.hostReadyBeforeStart).toBe(false);
    await host.screenshot({ path: 'artifacts/guest-lobby-mobile.png', fullPage: true });
    const started = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'start_round');
    await action(() => host.getByRole('button', { name: 'Start a round', exact: true }).click());
    const startResponse = await started;
    if (startResponse.status() !== 200) { const b = await startResponse.json(); fs.writeFileSync('artifacts/guest-start-failure.json', JSON.stringify({ status: startResponse.status(), code: b.error?.code, message: b.error?.message, details: b.error?.details ?? null, config, interactionsToAttempt: actions, capabilitiesRedacted: true }, null, 2) + '\n'); await host.screenshot({ path: 'artifacts/guest-start-recovery-mobile.png', fullPage: true }); throw Error(`Start failed: ${b.error?.code}, ${b.error?.message}, ${b.error?.details?.reason ?? 'no structured reason'}`); }
    await expect(host.getByRole('button', { name: 'Watch', exact: true })).toBeEnabled();
    await expect(host.getByRole('button', { name: 'No', exact: true })).toHaveCount(1);
    await expect(host.getByRole('button', { name: 'Watch', exact: true })).toHaveCount(1);
    await expect(host.getByRole('progressbar')).toHaveCount(0);
    await expect(host.getByText(/Not okay tonight|Your round ·|short round/)).toHaveCount(0);
    const noConfirmed = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
    await host.getByRole('button', { name: 'No', exact: true }).click();
    const noResponse = await noConfirmed; expect(noResponse.status()).toBe(200); expect(noResponse.request().postDataJSON().command.value).toBe('pass');
    const undoConfirmed = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
    await host.getByRole('button', { name: 'Undo my last choice', exact: true }).click();
    const undoResponse = await undoConfirmed; expect(undoResponse.status()).toBe(200); expect(undoResponse.request().postDataJSON().command.value).toBe(null);
    await host.setViewportSize({ width: 390, height: 1600 });
    await host.getByRole('button', { name: 'Watch', exact: true }).scrollIntoViewIfNeeded();
    await host.screenshot({ path: 'artifacts/guest-voting-mobile.png', fullPage: true });
    await host.screenshot({ path: 'artifacts/binary-voting-real-mobile.png', fullPage: true });
    await host.setViewportSize({ width: 390, height: 844 });
    const startState = (await startResponse.json()).snapshot;
    const kinds = [...new Set(startState.shared.candidates.map(c => c.identity.kind))];
    // One watch choice confirms real command/own-state behavior, then finish the round.
    for (let i = 0; i < startState.shared.round.candidateCount; i++) {
      const confirmed = host.waitForResponse(r => r.url().endsWith('/commands') && r.request().postDataJSON()?.command.type === 'vote');
      await host.getByRole('button', { name: 'Watch', exact: true }).click(); expect((await confirmed).status()).toBe(200); voted++;
    }
    await host.getByRole('button', { name: 'Finish my round', exact: true }).click(); await expect(host.getByText('Your shared shortlist', { exact: true })).toBeVisible();
    await host.screenshot({ path: 'artifacts/guest-shortlist-mobile.png', fullPage: true });
    // A new round restores setup. Follow the INVITE VISIBLE IN THE APP in a clean browser.
    await host.getByRole('button', { name: 'Start another round', exact: true }).click();
    await host.getByRole('button', { name: 'Invite friends', exact: true }).click();
    const invitation = await host.getByText(new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/r/`)).innerText();
    expect(new URL(invitation).origin).toBe(origin);
    await host.getByRole('button', { name: 'Hide invitation', exact: true }).click();
    const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', reducedMotion: 'reduce' }); contexts.push(guestContext);
    const guest = await guestContext.newPage(); guest.on('pageerror', e => errors.push(e.message));
    await guest.goto(invitation); await guest.getByRole('button', { name: 'Continue as guest', exact: true }).click();
    await guest.getByRole('textbox', { name: 'Your nickname', exact: true }).fill('Sam'); await guest.getByRole('button', { name: 'Join room', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Ready on Our screen', exact: true })).toBeEnabled();
    await expect(host.getByRole('button', { name: 'Start a round', exact: true })).toBeDisabled();
    await guest.getByRole('button', { name: 'Ready on Our screen', exact: true }).click();
    await expect(guest.getByText('You’re ready. Waiting for the host to start.', { exact: true })).toBeVisible();
    await expect(host.getByRole('button', { name: 'Start a round', exact: true })).toBeEnabled();
    await host.getByRole('button', { name: 'Start a round', exact: true }).click();
    await expect(guest.getByRole('button', { name: 'Watch', exact: true })).toBeEnabled();
    await expect(host.getByRole('button', { name: 'Watch', exact: true })).toBeEnabled();
    await guest.screenshot({ path: 'artifacts/guest-joined-voting-mobile.png', fullPage: true });
    expect(errors).toEqual([]);
    const report = { result: 'pass', scope: 'Actual real-catalog API15995 + gateway4319, finite36-title local sample, memory rooms. Visible UI only; fresh isolated rooms.', appOrigin: origin, interactionsToFirstRound: actions, interactionsDefinition: 'Each click or field fill counts once; country locale suggestion accepted and one actual service selected. Excludes navigation and screenshots.', beforeMinimumAttempt: { interactions: 13, evidence: 'Retained pre-simplification source: guest,nickname,create,edit,add screen,find country,select country,find service,select service,confirm screen,save,ready,start. Minimum attempt, not diagnosis of user incident.' }, config, candidateKinds: kinds, candidateCount: startState.shared.round.candidateCount, confirmedVotes: voted, hostReadySent: true, binaryChoiceUi: true, noMapsToPassConfirmed: true, undoPassConfirmed: true, votingProgressBarAbsent: true, manualProgressControls: false, freshBrowserInviteJoined: true, appOriginInvite: true, guestReadinessExplicit: true, twoClientsVoting: true, sharedFrameCount: sharedFrames.length, privateFieldsOnSharedFrames: false, commands, pageErrors: errors, capabilitiesRedacted: true };
    fs.writeFileSync('artifacts/guest-connected-poc.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ result: 'pass', interactionsToFirstRound: actions, candidateCount: report.candidateCount, confirmedVotes: voted, twoClientsVoting: true }));
  } finally { for (const context of contexts) await context.close(); await browser.close(); }
}
main().catch(error => { console.error(error.message.replace(/https?:\/\/[^\s]*\/r\/[^\s]*/g, '[redacted invitation]')); process.exitCode = 1; });
