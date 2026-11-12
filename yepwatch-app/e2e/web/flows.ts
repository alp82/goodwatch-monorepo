// Reusable journey steps. Each step presses real controls through Person.tap (timed, fault-aware) and
// asserts its end state; snapshot checks also catch duplicates (rooms, ideas, votes) under rapid taps.
import { eventually, type Person, type Room } from '../lib/harness';

export async function createRoom(host: Person, mood = 'funny space heist') {
  await host.open('/');
  await host.see({ visible: ['landing'] }).catch(() => undefined);
  await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] }, moment: 'newRoomMs' });
  await host.fill(host.page.getByLabel('Mood'), mood);
  await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
  await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify([mood]), 'the room has exactly the one idea', host);
  return host.page.url();
}

export async function hostName(host: Person, name: string) {
  const field = host.page.getByLabel('Your name').filter({ visible: true });
  await host.fill(field, name);
  await field.press('Enter');
  await eventually(() => host.latest?.participants.find((p) => p.participantId === host.own?.participantId)?.nickname, (v) => v === name, 'host name saved', host);
}

/** Opens Your services (from Start or the Streaming row) and picks services, then Done. */
export async function pickServices(p: Person, services: string[], open?: () => Promise<unknown>) {
  if (open) await open();
  await p.see({ visible: ['services-sheet'] }, 10000, 'Your services sheet');
  for (const s of services) await p.tap(p.page.getByRole('checkbox', { name: s, exact: true }).filter({ visible: true }), { repeatable: true });
  await p.tap(p.button('Done'), { expect: { hidden: ['services-sheet'] } });
}

export async function inviteLink(host: Person) {
  const text = await host.button('Share').innerText();
  const path = text.match(/\/r\/[A-Za-z0-9._-]+/)?.[0];
  if (!path) host.journeyFailure(`no invitation link in the share row ("${text}")`);
  return new URL(path!, host.page.url()).href;
}

/** A friend opens the invitation in a fresh browser, names themselves, joins and picks a service. */
export async function join(friend: Person, invite: string, name: string, service = 'Disney+') {
  await friend.open(invite, { settle: false });
  await friend.see({ visible: ['join-screen', 'invite-head'] }, 15000, 'invitation join page');
  await friend.fill(friend.page.getByLabel('Your name').filter({ visible: true }), name);
  await friend.tap(friend.button('Join'), { expect: { visible: ['services-sheet'] }, moment: 'joinMs' });
  await pickServices(friend, [service]);
  await friend.see({ visible: ['waiting'] }, 10000, 'friend waits for the host');
}

/** Host has a name and Netflix; a ready room page. */
export async function readyHost(room: Room, name = 'Alp', mood?: string) {
  const host = await room.person(name);
  await createRoom(host, mood);
  await hostName(host, name);
  await pickServices(host, ['Netflix'], () => host.tap(host.button('Streaming services, add'), { expect: { visible: ['services-sheet'] } }));
  return host;
}

export async function start(host: Person, friends: Person[]) {
  await host.tap(host.button('Start'), {
    expect: { visible: ['voting', 'poster'] },
    moment: 'startToFirstCardMs',
    observers: friends.map((f) => [f, { visible: ['voting', 'poster'] }, 'startToPeerVotingMs'] as [Person, { visible: string[] }, string]),
    timeout: 20000,
  });
}

/** The current card's title, from its accessible label ("<title>. Swipe or use the choice buttons."). */
export async function cardTitle(p: Person) {
  return p.page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="poster"]')].filter((e) => (e as HTMLElement).offsetParent !== null);
    for (const card of cards) {
      const sel = '[aria-label$="Swipe or use the choice buttons."]';
      const el = card.closest(sel) ?? card.querySelector(sel);
      const label = el?.getAttribute('aria-label');
      if (label) return label.replace(/\. Swipe or use the choice buttons\.$/, '');
    }
    return '';
  });
}

/**
 * One vote; measures Yep/Nope → the next card becoming the current card. A press that does nothing
 * (card unchanged after 2 s) is a dead-button failure; the journey then presses once more to go on.
 */
export async function vote(p: Person, yes: boolean, { pace = 400 } = {}) {
  const label = yes ? 'Yep' : 'Nope';
  // Human pace: a moment after the card arrived. Faster presses are tested on their own (voting.spec.ts).
  if (pace) await p.page.waitForTimeout(pace);
  const before = await cardTitle(p);
  const r = await p.tap(p.button(label), { expect: { cardChanged: { from: before } }, moment: 'swipeNextCardMs', repeatable: true, soft: true, timeout: 2000 });
  if (r !== undefined) return;
  p.failures.push({ gate: 'dead-button', person: p.name, detail: `${label} on "${before}" did nothing: the card was unchanged 2 s later `, measured: '> 2000 ms', budget: '16 ms', at: Date.now() });
  await p.tap(p.button(label), { expect: { cardChanged: { from: before } }, repeatable: true, timeout: 10000 });
}

/** Everyone says Yep until the room has a match; returns the match count. */
export async function voteUntilMatch(people: Person[], rounds = 15) {
  for (let i = 0; i < rounds; i++) {
    for (const p of people) await vote(p, true);
    if ((people[0].latest?.matches?.length ?? 0) > 0) break;
  }
  return eventually(() => people[0].latest?.matches?.length ?? 0, (n) => n > 0, 'the room has a match', people[0], 15000);
}

/**
 * Samples a page (by test id) every 50 ms from inside it (a one-frame line or error is caught): whether the
 * "Reconnecting…" line is up and whether the page shows `error` (an error or a retry button). `stop` returns
 * the samples.
 */
export async function recordPage(p: Person, testId: string, error: RegExp) {
  await p.page.evaluate(({ testId, source, flags }) => {
    const w = window as unknown as { __pageLog?: { t: number; note: boolean; error: boolean }[]; __pageTimer?: number };
    const errorText = new RegExp(source, flags);
    w.__pageLog = [];
    const sample = () => {
      const page = document.querySelector(`[data-testid="${testId}"]`);
      if (!page) return;
      const note = document.querySelector('[data-testid="room-note"]')?.textContent ?? '';
      w.__pageLog!.push({ t: Date.now(), note: note.includes('Reconnecting'), error: errorText.test(page.textContent ?? '') });
    };
    sample();
    w.__pageTimer = window.setInterval(sample, 50);
  }, { testId, source: error.source, flags: error.flags });
  return () => p.page.evaluate(() => {
    const w = window as unknown as { __pageLog: { t: number; note: boolean; error: boolean }[]; __pageTimer: number };
    window.clearInterval(w.__pageTimer);
    return w.__pageLog;
  });
}
