// Production smoke: ONE room per run, three people.
//   host    guest, throttled (fast 4G)   New room → Create room → name → Netflix          (newRoomMs, createRoomMs)
//   friend  guest, throttled, fresh browser through the invitation link                    (inviteOpenMs, startToPeerVotingMs, voteToPeerMs)
//   member  signed in with GoodWatch, NOT throttled, joins by the same link ("Join as …"; a nameless account types one)
//           (unthrottled_* moments: reported, never gated)
// Then Start → 20 rounds of Yep from everyone (each a match: vote → peer sampled 20 times) → everyone leaves /
// the host archives. Create and Start happen once: run.mjs takes their p95 over this and earlier runs.
//
// Why one room: there's no shared cap on active rooms, but a run should stay light on the shared rate windows.
// A run costs 1 room (the guest host's own allowance of 10, held for the room's 6 h life) + 2 admissions +
// ~80 commands, far under the 20 creates/joins and 600 commands a minute.
//
// Member sign-in:
//   - production: E2E_SMOKE_MEMBER_EMAIL / E2E_SMOKE_MEMBER_PASSWORD (a dedicated GoodWatch account; run.mjs reads
//     them from ~/.config/yepwatch/smoke-member.json when unset) fill the
//     real GoodWatch sign-in form; the one-time consent was given by hand (docs/yepwatch-e2e-pipeline.md).
//     The member's browser is never traced there (lib/harness.ts person({ trace: false })).
//   - local stack (--origin http://127.0.0.1:…): the fake issuer signs a throwaway account in.
import { randomBytes } from 'node:crypto';
import { test, eventually, issuer, ISSUER, ORIGIN, type Person, type Room } from '../lib/harness';
import { cardTitle, inviteLink, pickServices, readyHost } from '../web/flows';

const MEMBER_EMAIL = process.env.E2E_SMOKE_MEMBER_EMAIL ?? '';
const MEMBER_PASSWORD = process.env.E2E_SMOKE_MEMBER_PASSWORD ?? '';
const GUEST_ONLY = process.env.E2E_SMOKE_GUEST_ONLY === '1';
/**
 * E2E_SMOKE_CHANGE_BEFORE_START=1: right before Start, the friend adds a service the room doesn't have yet (a setup
 * change: the room's deck is built again), and the host presses Start the same beat after the room has it. Same
 * moments, same budgets: Start must not wait visibly for that build.
 */
const CHANGE_BEFORE_START = process.env.E2E_SMOKE_CHANGE_BEFORE_START === '1';
/** Voting rounds: one vote → peer sample each (run.mjs takes a p95 from one run at 20 samples). */
const VOTE_ROUNDS = 20;
const local = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(ORIGIN ?? '');
/** Smoke rooms are recognisable in the store and in History: "e2e smoke 2026-11-11T21:04". */
const MARK = `e2e smoke ${new Date().toISOString().slice(0, 16)}`;

/**
 * Runs a step that hands Playwright a credential. Playwright's action errors quote the value (`fill("…")` in the
 * call log), and a failed test's error lands in error-context.md and report-raw.json, which CI uploads. So a
 * failure comes out as a new error naming only the step, without the original as its cause.
 */
async function secretly(what: string, run: () => Promise<unknown>) {
  let failed = false;
  try {
    await run();
  } catch {
    failed = true;
  }
  if (failed) throw new Error(`${what} failed (the original error is withheld: it may quote the credential)`);
}

/** Lifts the harness's fast-4G emulation for one person (unthrottled reference numbers). */
async function unthrottle(p: Person) {
  const cdp = await p.cdpSession();
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

/** Continue with GoodWatch → (sign-in form → consent, when GoodWatch asks) → back on YepWatch, signed in. */
async function signIn(p: Person) {
  await p.open('/');
  await p.see({ visible: ['landing'] }, 15000, 'start page');
  const origin = new URL(p.page.url()).origin;
  await p.harvest();
  // The click starts a top-level navigation (to GoodWatch, or straight through redirects when the session is
  // remembered, as with the local fake issuer).
  await Promise.all([
    p.page.waitForEvent('framenavigated', { predicate: (f) => f === p.page.mainFrame(), timeout: 15000 }),
    p.button('Continue with GoodWatch').first().click(),
  ]).catch((e) => p.journeyFailure(`Continue with GoodWatch did not navigate: ${String(e).split('\n')[0]} (${p.network()})`));
  const here = () => new URL(p.page.url());
  const back = async () => here().origin === origin && !here().pathname.includes('/callback')
    && await p.page.getByTestId('avatar-goodwatch-mark').first().isVisible().catch(() => false);
  const deadline = Date.now() + 30000;
  let filled = false;
  while (!(await back())) {
    if (Date.now() > deadline) p.journeyFailure(`GoodWatch sign-in did not come back signed in (at ${here().origin}${here().pathname}; ${p.network()})`);
    if (here().origin !== origin) {
      const email = p.page.getByLabel(/^email/i).first();
      const allow = p.page.getByRole('button', { name: /^Allow / }).first();
      if (!filled && await email.isVisible().catch(() => false)) {
        if (!MEMBER_EMAIL || !MEMBER_PASSWORD) p.journeyFailure('GoodWatch asked for a sign-in but E2E_SMOKE_MEMBER_EMAIL / E2E_SMOKE_MEMBER_PASSWORD are not set');
        // GoodWatch's scripts start after paint, and a Sign in pressed before they run posts the bare form,
        // which only comes back to it (routes/sign-in.tsx action). Wait until React owns the form.
        await email.evaluate((el) => new Promise<void>((done) => {
          const owned = () => Object.keys(el).some((k) => k.startsWith('__reactProps$'));
          const check = () => (owned() ? done() : setTimeout(check, 25));
          check();
        }), undefined, { timeout: 15000 }).catch(() => p.journeyFailure('GoodWatch sign-in form never became interactive'));
        await secretly('typing the smoke member\'s email', () => email.fill(MEMBER_EMAIL));
        await secretly('typing the smoke member\'s password', () => p.page.getByLabel(/^password/i).first().fill(MEMBER_PASSWORD));
        await p.page.getByRole('button', { name: 'Sign in', exact: true }).click();
        filled = true;
      } else if (await allow.isVisible().catch(() => false)) {
        // Consent is given once by hand; seeing it again means the grant was revoked or changed. Allowing is
        // what a member does, so go on, but it shows up in the run log.
        console.log('[smoke] GoodWatch asked for consent again; allowing');
        await allow.click();
      }
    }
    await p.page.waitForTimeout(150);
  }
  await p.settle();
}

/** The signed-in member's GoodWatch name as YepWatch knows it (null: the account has none). */
async function accountName(p: Person): Promise<string | null> {
  const status = await p.page.evaluate(async () => {
    const r = await fetch('/api/yepwatch/v1/proposal/account', { credentials: 'include' });
    return r.ok ? (await r.json()) as { state?: string; displayName?: string | null } : null;
  });
  if (status?.state !== 'member') p.journeyFailure(`signed in, but YepWatch says the account is ${status?.state ?? 'unreadable'}`);
  return status?.displayName?.trim() || null;
}

/** The match count the host's chip shows now ("2 matches"; "Matches" before the first). */
async function shownMatches(p: Person) {
  return p.page.evaluate(() => {
    const yw = (window as unknown as { __yw: { visible(el: Element): boolean } }).__yw;
    const chip = [...document.querySelectorAll('[aria-label]')].find((e) => /^\d+ match(es)?$/.test(e.getAttribute('aria-label') ?? '') && yw.visible(e));
    return chip ? Number.parseInt(chip.getAttribute('aria-label')!, 10) : 0;
  });
}

/** Best effort, never a gate: a guest leaves through the room sheet; the host archives. */
async function tidy(p: Person, how: 'leave' | 'archive') {
  try {
    const page = p.page;
    if (page.isClosed()) return;
    const visible = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).first();
    if (how === 'archive') {
      // From the start page card: works whatever screen the room was left on (match, proposal, sheet).
      // Harvested first: the navigation drops the room page's recording, and with it the host's whole journey
      // (create, Start, every Yep) from the gates.
      await p.harvest();
      await page.goto(new URL('/', page.url()).href);
      await visible(`Archive ${MARK}`).click({ timeout: 10000 });
      await page.getByRole('button', { name: MARK, exact: true }).filter({ visible: true }).waitFor({ state: 'detached', timeout: 8000 });
      return;
    } else {
      await visible(/, switch room$/).click({ timeout: 5000 });
      await visible(/, Room page$/).click({ timeout: 5000 });
      await visible('Leave room').click({ timeout: 5000 });
      await visible('Leave').click({ timeout: 5000 });
    }
    await page.getByTestId(/^(landing|home-rooms)$/).first().waitFor({ timeout: 8000 });
  } catch (e) {
    console.log(`[smoke] tidy (${how}) for ${p.name} did not finish: ${String(e).split('\n')[0]}`);
  }
}

test('smoke: guest room, friend by link, member by link, start, vote to a match, leave', async ({ room }) => {
  test.setTimeout(150_000);
  const people: [Person, 'leave' | 'archive'][] = [];
  try {
    await journey(room, people);
  } finally {
    // Leave/archive so the smoke room drops off every account and start page (it still expires on its own).
    for (const [p, how] of people.reverse()) await tidy(p, how);
  }
});

async function journey(room: Room, people: [Person, 'leave' | 'archive'][]) {
  // Member first: sign-in is the slowest, least predictable step; fail fast before a room exists.
  // E2E_SMOKE_GUEST_ONLY=1 skips the member (until the production test account exists).
  let member: Person | null = null;
  if (!GUEST_ONLY) {
    const memberAccount = `smoke-member-${randomBytes(3).toString('hex')}`;
    // Never traced against a real origin: a trace keeps the typed password, the sign-in POST body and the
    // session cookies, and CI uploads the run's artifacts (.github/workflows/yepwatch-smoke.yml).
    member = await room.person('Smoke member', local ? { member: memberAccount } : { trace: false });
    await unthrottle(member);
    if (local) {
      if (!ISSUER) member.journeyFailure('local smoke needs the stack (no issuer in .stack.json)');
      await issuer(`/_e2e/user?user=${encodeURIComponent(memberAccount)}`, { displayName: 'Smoke member' });
    }
    await signIn(member);
  }

  const host = await readyHost(room, 'Smoke host', MARK); // newRoomMs, createRoomMs
  people.push([host, 'archive']);
  await host.audit('room page');
  const invite = await inviteLink(host);

  // Friend: a fresh, throttled browser opens the invitation.
  const friend = await room.person('Smoke friend');
  await friend.open(invite, { settle: false });
  const shown = await friend.firstShown(['join-screen', 'invite-head']);
  if (shown.at) friend.record('inviteOpenMs', shown.at - shown.origin, 'navigation start → join page', [shown.origin, shown.at]);
  await friend.fill(friend.page.getByLabel('Your name').filter({ visible: true }), 'Smoke friend');
  await friend.tap(friend.button('Join'), { expect: { visible: ['services-sheet'] } });
  people.push([friend, 'leave']);
  await pickServices(friend, ['Netflix']);
  await friend.see({ visible: ['waiting'] }, 10000, 'friend waits for the host');

  // Member: unthrottled reference for the invitation open, then join as the GoodWatch name. GoodWatch's email
  // sign-up asks for no name, so an account may have none: then the join form asks for one (the member's Join
  // keeps its GoodWatch mark). What the account says decides which form is right, so a named member who got
  // the nameless form still fails here.
  if (member) {
    const goodwatchName = await accountName(member);
    await member.open(invite, { settle: false });
    const mShown = await member.firstShown(['join-screen', 'invite-head']);
    if (mShown.at) member.record('unthrottled_inviteOpenMs', mShown.at - mShown.origin, 'navigation start → join page (signed in)', [mShown.origin, mShown.at]);
    if (goodwatchName) {
      await member.tap(member.button(`Join as ${goodwatchName}`), { expect: { any: ['waiting', 'services-sheet'] } });
    } else {
      await member.fill(member.page.getByLabel('Your name').filter({ visible: true }), 'Smoke member');
      await member.tap(member.button('Join'), { expect: { any: ['waiting', 'services-sheet'] } });
    }
    people.push([member, 'leave']);
    if (await member.testId('services-sheet').isVisible().catch(() => false)) await pickServices(member, ['Netflix']);
    await member.see({ visible: ['waiting'] }, 10000, 'member waits for the host');
  }
  const expected = member ? 3 : 2;
  await eventually(() => host.latest?.participants.length, (n) => n === expected, `host sees ${expected} people`, host);
  if (CHANGE_BEFORE_START) {
    const services = () => new Set(host.latest?.screens.flatMap((s) => s.serviceIds) ?? []).size;
    const before = services();
    await pickServices(friend, ['Disney+'], () => friend.tap(friend.button('Your services'), { expect: { visible: ['services-sheet'] } }));
    await eventually(services, (n) => n > before, 'the host\'s room has the friend\'s new service', host);
  }
  // The host presses Start a beat after the last person is in the room, as people do (web journeys do the same):
  // the member's room screen lasts exactly until the round arrives, and since Start stopped reading seen titles
  // from GoodWatch (~250 ms faster), a Start right on the member's arrival showed it for less than a flash.
  await host.page.waitForTimeout(300);

  // Start: first card for the host (gated) and on both other phones.
  await host.tap(host.button('Start'), {
    expect: { visible: ['voting', 'poster'] },
    moment: 'startToFirstCardMs',
    observers: [[friend, { visible: ['voting', 'poster'] }, 'startToPeerVotingMs'], ...(member ? [[member, { visible: ['voting', 'poster'] }, 'unthrottled_startToPeerVotingMs'] as const] : [])],
    timeout: 20000,
  });

  // Yep from everyone, round after round: everyone has the same card, so the friend's Yep (the last) makes it
  // a match, timed until the host's (and member's) match chip counts it. VOTE_ROUNDS rounds give vote → peer a
  // real p95 from this run alone (20 samples; run.mjs). 3 people × 20 votes in ~45 s: under the 60 commands
  // per person a minute. A round whose card was no match for everyone (the deck refilled between votes) is
  // no sample; the run needs a match at the end either way.
  const chip = (n: number) => ({ label: { text: `^${n} ${n === 1 ? 'match' : 'matches'}$` } });
  for (let i = 0; i < VOTE_ROUNDS; i++) {
    for (const p of member ? [host, member] : [host]) {
      await p.page.waitForTimeout(400);
      const before = await cardTitle(p);
      await p.tap(p.button('Yep'), { expect: { cardChanged: { from: before } }, moment: 'swipeNextCardMs', repeatable: true, timeout: 10000 });
    }
    await friend.page.waitForTimeout(400);
    const before = await cardTitle(friend);
    // A round is a sample only once the host's chip shows every match the room has (a late match from a round
    // before can't count for this vote; the harness also drops an observation already true before the press).
    // The next count is read from the chip itself (not the snapshot, which can run ahead of the paint). Not in
    // step within 3 s: the round is voted but not sampled.
    const settled = async () => await shownMatches(host) === (host.latest?.matches?.length ?? -1);
    let inStep = false;
    for (const end = Date.now() + 3000; !(inStep = await settled()) && Date.now() < end;) await host.page.waitForTimeout(50);
    const next = chip(await shownMatches(host) + 1);
    await friend.tap(friend.button('Yep'), {
      repeatable: true, soft: true, timeout: 2500, moment: 'swipeNextCardMs',
      expect: { cardChanged: { from: before } },
      observers: inStep ? [[host, next, 'voteToPeerMs'], ...(member ? [[member, next, 'unthrottled_voteToPeerMs']] : [])] as [Person, typeof next, string][] : [],
    });
  }
  await eventually(() => host.latest?.matches?.length ?? 0, (n) => n > 0, 'the room has a match', host, 15000);
}
