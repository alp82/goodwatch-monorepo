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

export async function cardTitle(p: Person) {
  return (await p.testId('poster').getAttribute('aria-label').catch(() => null)) ?? (await p.testId('poster').innerText().catch(() => ''));
}

/** One vote; measures Yep/Nope → next card. */
export async function vote(p: Person, yes: boolean) {
  const before = await cardTitle(p);
  await p.tap(p.button(yes ? 'Yep' : 'Nope'), { expect: { textChanged: { id: 'poster', from: before } }, moment: 'swipeNextCardMs', repeatable: true });
}

/** Everyone says Yep until the room has a match; returns the match count. */
export async function voteUntilMatch(people: Person[], rounds = 15) {
  for (let i = 0; i < rounds; i++) {
    for (const p of people) await vote(p, true);
    if ((people[0].latest?.matches?.length ?? 0) > 0) break;
  }
  return eventually(() => people[0].latest?.matches?.length ?? 0, (n) => n > 0, 'the room has a match', people[0], 15000);
}
