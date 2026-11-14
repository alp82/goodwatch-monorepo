// Production smoke: ONE room per run, three people.
//   host    guest            New room → Create room → name → Netflix
//   friend  guest, fresh browser through the invitation link
//   member  signed in with GoodWatch, joins by the same link ("Join as …"; a nameless account types one)
// Then Start → VOTE_ROUNDS rounds of Yep from everyone (each a match, seen on the other phones) → everyone
// leaves / the host archives. No speed checks (README "Speed and smoothness, on demand").
//
// Why one room: there's no shared cap on active rooms, but a run should stay light on the shared rate windows.
// A run costs 1 room (the guest host's own allowance of 10, held for the room's 6 h life) + 2 admissions +
// ~20 commands, far under the 20 creates/joins and 600 commands a minute.
//
// Member sign-in:
//   - production: E2E_SMOKE_MEMBER_EMAIL / E2E_SMOKE_MEMBER_PASSWORD (a dedicated GoodWatch account; run.mjs reads
//     them from ~/.config/yepwatch/smoke-member.json when unset) fill the
//     real GoodWatch sign-in form; the one-time consent was given by hand (docs/yepwatch-e2e-pipeline.md).
//     The member's browser is never traced there (lib/harness.ts person({ trace: false })).
//     It signs in once per session lifetime, not once per run: the YepWatch sign-in is kept between runs
//     (lib/smoke-session.ts; GoodWatch's OAuth authorize allows 30 requests a minute per address, and back-to-back
//     runs got 429). A kept session that no longer signs the member in is dropped and the run signs in afresh.
//   - local stack (--origin http://127.0.0.1:…): the fake issuer signs a throwaway account in.
import { randomBytes } from 'node:crypto';
import { test, eventually, issuer, ISSUER, ORIGIN, type Person, type Room } from '../lib/harness';
import { dropSession, loadSession, saveSession } from '../lib/smoke-session';
import { cardTitle, inviteLink, pickServices, readyHost } from '../web/flows';

const MEMBER_EMAIL = process.env.E2E_SMOKE_MEMBER_EMAIL ?? '';
const MEMBER_PASSWORD = process.env.E2E_SMOKE_MEMBER_PASSWORD ?? '';
const GUEST_ONLY = process.env.E2E_SMOKE_GUEST_ONLY === '1';
/**
 * E2E_SMOKE_CHANGE_BEFORE_START=1: right before Start, the friend adds a service the room doesn't have yet (a setup
 * change: the room's deck is built again), and the host presses Start the same beat after the room has it.
 */
const CHANGE_BEFORE_START = process.env.E2E_SMOKE_CHANGE_BEFORE_START === '1';
/** Voting rounds: each a match that must show on the other phones. */
const VOTE_ROUNDS = 3;
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
    p.button(/^(Continue with|Reconnect) GoodWatch$/).first().click(),
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

/** What YepWatch says about this browser's sign-in (null: unreadable). */
async function accountStatus(p: Person) {
  return p.page.evaluate(async () => {
    const r = await fetch('/api/yepwatch/v1/proposal/account', { credentials: 'include' });
    return r.ok ? (await r.json()) as { state?: string; displayName?: string | null } : null;
  }).catch(() => null);
}

/** The signed-in member's GoodWatch name as YepWatch knows it (null: the account has none). */
async function accountName(p: Person): Promise<string | null> {
  const status = await accountStatus(p);
  if (status?.state !== 'member') p.journeyFailure(`signed in, but YepWatch says the account is ${status?.state ?? 'unreadable'}`);
  return status?.displayName?.trim() || null;
}

/**
 * Production: the member signed in from the session the last run kept, when it still works; otherwise through
 * GoodWatch (signIn), and that session is kept for the next runs. Returns how it signed in.
 */
async function memberSignIn(room: Room): Promise<Person> {
  const kept = loadSession(ORIGIN!, MEMBER_EMAIL);
  const member = await room.person('Smoke member', { trace: false, storageState: kept?.state });
  if (kept) {
    await member.open('/');
    if ((await accountStatus(member))?.state === 'member') {
      console.log(`[smoke] smoke member signed in from the kept session (${Math.round((Date.now() - kept.savedAt) / 60000)} min old)`);
      await saveSession(member.context, ORIGIN!, MEMBER_EMAIL);
      return member;
    }
    console.log('[smoke] the kept smoke member session no longer signs in; signing in with GoodWatch');
    dropSession();
    // Fresh as a new browser: the kept local storage would have the start page offer "Reconnect GoodWatch".
    await member.context.clearCookies();
    await member.page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => undefined);
  }
  await signIn(member);
  await saveSession(member.context, ORIGIN!, MEMBER_EMAIL);
  return member;
}

/** The match count a person's chip shows now ("2 matches"; "Matches" before the first). */
async function shownMatches(p: Person) {
  return p.page.evaluate(() => {
    const yw = (window as unknown as { __yw: { visible(el: Element): boolean } }).__yw;
    const chip = [...document.querySelectorAll('[aria-label]')].find((e) => /^\d+ match(es)?$/.test(e.getAttribute('aria-label') ?? '') && yw.visible(e));
    return chip ? Number.parseInt(chip.getAttribute('aria-label')!, 10) : 0;
  });
}

/**
 * Best effort, never a gate: a guest leaves through the room sheet; the host archives. Everyone's journey is
 * harvested before the first tidy-up step (finalHarvest), so the screens of the tidy-up are not judged; errors still are.
 */
async function tidy(p: Person, how: 'leave' | 'archive') {
  try {
    const page = p.page;
    if (page.isClosed()) return;
    const visible = (name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' }).filter({ visible: true }).first();
    if (how === 'archive') {
      // From the start page card: works whatever screen the room was left on (match, proposal, sheet).
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
    for (const p of room.people) await p.finalHarvest();
    for (const [p, how] of people.reverse()) await tidy(p, how);
    // The newest member session for the next run: YepWatch may have renewed (rotated) it during this one.
    const member = room.people.find((p) => p.name === 'Smoke member');
    if (member && !local && !member.page.isClosed() && (await accountStatus(member))?.state === 'member')
      await saveSession(member.context, ORIGIN!, MEMBER_EMAIL).catch(() => console.log('[smoke] could not keep the member session'));
  }
});

async function journey(room: Room, people: [Person, 'leave' | 'archive'][]) {
  // Member first: sign-in is the slowest, least predictable step; fail fast before a room exists.
  // E2E_SMOKE_GUEST_ONLY=1 skips the member (until the production test account exists).
  let member: Person | null = null;
  if (!GUEST_ONLY) {
    // Never traced against a real origin: a trace keeps the typed password, the sign-in POST body and the
    // session cookies, and CI uploads the run's artifacts (.github/workflows/yepwatch-smoke.yml).
    if (local) {
      const memberAccount = `smoke-member-${randomBytes(3).toString('hex')}`;
      member = await room.person('Smoke member', { member: memberAccount });
      if (!ISSUER) member.journeyFailure('local smoke needs the stack (no issuer in .stack.json)');
      await issuer(`/_e2e/user?user=${encodeURIComponent(memberAccount)}`, { displayName: 'Smoke member' });
      await signIn(member);
    } else member = await memberSignIn(room);
  }

  const host = await readyHost(room, 'Smoke host', MARK);
  people.push([host, 'archive']);
  await host.audit('room page');
  const invite = await inviteLink(host);

  // Friend: a fresh browser opens the invitation.
  const friend = await room.person('Smoke friend');
  await friend.open(invite, { settle: false });
  await friend.firstShown(['join-screen', 'invite-head']);
  await friend.fill(friend.page.getByLabel('Your name').filter({ visible: true }), 'Smoke friend');
  await friend.tap(friend.button('Join'), { expect: { visible: ['services-sheet'] } });
  people.push([friend, 'leave']);
  await pickServices(friend, ['Netflix']);
  await friend.see({ visible: ['waiting'] }, 10000, 'friend waits for the host');

  // Member: opens the invitation and joins as the GoodWatch name. GoodWatch's email
  // sign-up asks for no name, so an account may have none: then the join form asks for one (the member's Join
  // keeps its GoodWatch mark). What the account says decides which form is right, so a named member who got
  // the nameless form still fails here.
  if (member) {
    const goodwatchName = await accountName(member);
    await member.open(invite, { settle: false });
    await member.firstShown(['join-screen', 'invite-head']);
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

  // Start: first card for the host and on both other phones.
  await host.tap(host.button('Start'), {
    expect: { visible: ['voting', 'poster'] },
    observers: [[friend, { visible: ['voting', 'poster'] }, 'voting'], ...(member ? [[member, { visible: ['voting', 'poster'] }, 'voting'] as const] : [])],
    timeout: 20000,
  });

  // Yep from everyone, round after round: everyone has the same card, so the friend's Yep (the last) makes it a
  // match. Its own screen may show the match moment instead of the next card, so that press is soft.
  for (let i = 0; i < VOTE_ROUNDS; i++) {
    for (const p of member ? [host, member] : [host]) {
      await p.page.waitForTimeout(400);
      const before = await cardTitle(p);
      await p.tap(p.button('Yep'), { expect: { cardChanged: { from: before } }, repeatable: true, timeout: 10000 });
    }
    await friend.page.waitForTimeout(400);
    const before = await cardTitle(friend);
    await friend.tap(friend.button('Yep'), { repeatable: true, soft: true, timeout: 2500, expect: { cardChanged: { from: before } } });
  }
  await eventually(() => host.latest?.matches?.length ?? 0, (n) => n > 0, 'the room has a match', host, 15000);
  for (const p of member ? [host, member] : [host]) await eventually(() => shownMatches(p), (n) => n > 0, `${p.name} shows the match`, p, 15000);
}
