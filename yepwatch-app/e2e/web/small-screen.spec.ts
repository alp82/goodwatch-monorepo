// Small phones (iPhone SE 1st gen 320×568, small Android 360×640): every setup step is reachable by tapping
// and by keyboard, and the control in use is on screen and not under the pinned dock or the header.
import { expect } from '@playwright/test';
import { test, eventually, type Person } from '../lib/harness';
import { inviteLink, pickServices, start } from './flows';

/** The focused (or given) element's box is inside the window and the topmost thing at its center. */
async function onScreen(p: Person, what: string, selector?: string) {
  const r = await p.page.evaluate((sel) => {
    const el = (sel ? document.querySelector(sel) : document.activeElement) as HTMLElement | null;
    if (!el || el === document.body) return { ok: false, why: 'nothing focused' };
    const b = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const top = vv?.offsetTop ?? 0;
    const bottom = top + (vv?.height ?? window.innerHeight);
    if (b.top < top - 0.5 || b.bottom > bottom + 0.5) return { ok: false, why: `outside the window (${Math.round(b.top)}..${Math.round(b.bottom)} of ${Math.round(top)}..${Math.round(bottom)})` };
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) return { ok: false, why: `covered by ${hit?.outerHTML.slice(0, 120)}` };
    return { ok: true, why: '' };
  }, selector ?? null);
  if (!r.ok) p.journeyFailure(`${what} is not reachable: ${r.why}`);
}

/** Tab until the focused element's accessible name (or label) matches; then it must be on screen. */
async function tabTo(p: Person, name: string | RegExp, max = 40) {
  for (let i = 0; i < max; i++) {
    await p.page.keyboard.press('Tab');
    const label = await p.page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('aria-label') ?? el?.getAttribute('placeholder') ?? el?.innerText ?? '';
    });
    if (typeof name === 'string' ? label === name : name.test(label)) {
      await onScreen(p, `"${label}" (keyboard focus)`);
      return;
    }
  }
  p.journeyFailure(`Tab never reached "${name}"`);
}

const savedName = (p: Person) => p.latest?.participants.find((x) => x.participantId === p.own?.participantId)?.nickname;

/** The on-screen keyboard: a browser that resizes the page for it leaves this much less height. */
const KEYBOARD = 260;

for (const device of ['se', 'android'] as const) {
  test.describe(`small phone (${device})`, () => {
    test(`whole setup by tapping: name, services, idea, Start (${device}) @core`, async ({ room }) => {
      const host = await room.person('Alp', { device });
      await host.open('/');
      await host.audit('start page (small phone)');
      await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
      await host.audit('Mood page (small phone)');
      await host.fill(host.page.getByLabel('Mood'), 'funny space heist');
      await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] } });
      await room.point('room');
      await host.audit('room page (small phone)');
      // Name: the field is below the fold. Tapping scrolls it up; it keeps focus through that scroll and
      // through the keyboard taking height away, and Enter saves the name.
      const field = host.page.getByLabel('Your name').filter({ visible: true });
      await host.tap(field, { expect: {} });
      await onScreen(host, 'Your name field (tapped)');
      const size = host.page.viewportSize()!;
      await host.page.setViewportSize({ width: size.width, height: size.height - KEYBOARD });
      await host.page.keyboard.type('Alp');
      expect(await host.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'the name field keeps focus while typing').toBe('Your name');
      await host.page.keyboard.press('Enter');
      await eventually(() => savedName(host), (v) => v === 'Alp', 'host name saved by Enter', host);
      await host.page.setViewportSize(size);
      // Services, Movies and shows.
      await pickServices(host, ['Netflix'], () => host.tap(host.button('Streaming services, add'), { expect: { visible: ['services-sheet'] } }));
      await host.tap(host.button('Movies and shows, change'), { expect: { visible: ['kinds-sheet'] } });
      await host.audit('Movies and shows sheet (small phone)');
      await host.tap(host.button('Done'), { expect: { hidden: ['kinds-sheet'] } });
      // A second idea.
      await host.tap(host.button('Add an idea'), { expect: { visible: ['mood-page'] } });
      await host.fill(host.page.getByLabel('Mood'), 'space adventure');
      await host.tap(host.button('Add idea'), { expect: { visible: ['room-setup'] } });
      await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify(['funny space heist', 'space adventure']), 'two ideas', host);
      await host.tap(host.button('Room'), { expect: { visible: ['room-sheet'] } });
      await host.audit('Room sheet (small phone)');
      await host.tap(host.button('Close').last(), { expect: { hidden: ['room-sheet'] } });
      await onScreen(host, 'Start (in the dock)', '[data-testid="frame-dock"] [aria-label="Start"]');
      await start(host, []);
      await host.audit('voting (small phone)');
    });

    test(`whole setup by keyboard: name, services, idea, Start (${device})`, async ({ room }) => {
      const host = await room.person('Alp', { device });
      await host.open('/');
      await tabTo(host, 'New room');
      await host.tap(host.page.locator(':focus'), { key: 'Enter', expect: { visible: ['mood-page'] } });
      await host.page.keyboard.type('funny space heist');
      await host.tap(host.page.getByLabel('Mood'), { key: 'Enter', expect: { visible: ['room-setup'] } });
      await room.point('room');
      // Name: Tab to it, type, Enter saves.
      await tabTo(host, 'Your name');
      await host.page.keyboard.type('Alp');
      await host.page.keyboard.press('Enter');
      await eventually(() => savedName(host), (v) => v === 'Alp', 'host name saved by Enter', host);
      // Services: Tab to the row, Enter opens the sheet, Space ticks a service, Done closes.
      await tabTo(host, 'Streaming services, add');
      await host.tap(host.page.locator(':focus'), { key: 'Enter', expect: { visible: ['services-sheet'] } });
      await tabTo(host, 'Netflix');
      await host.page.keyboard.press('Space');
      await expect(host.page.locator(':focus'), 'Space ticks the focused service').toHaveAttribute('aria-checked', 'true');
      await tabTo(host, 'Done');
      await host.tap(host.page.locator(':focus'), { key: 'Enter', expect: { hidden: ['services-sheet'] } });
      // An idea: Add an idea, type, Enter.
      await tabTo(host, 'Add an idea');
      await host.tap(host.page.locator(':focus'), { key: 'Enter', expect: { visible: ['mood-page'] } });
      await host.page.keyboard.type('space adventure');
      await host.tap(host.page.getByLabel('Mood'), { key: 'Enter', expect: { visible: ['room-setup'] } });
      await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify(['funny space heist', 'space adventure']), 'two ideas', host);
      // Space switches an idea off and on.
      await tabTo(host, 'Use space adventure');
      await host.page.keyboard.press('Space');
      await eventually(() => host.latest?.ideas.find((i) => i.text === 'space adventure')?.on, (on) => on === false, 'Space switched the idea off', host);
      await host.page.keyboard.press('Space');
      await eventually(() => host.latest?.ideas.find((i) => i.text === 'space adventure')?.on, (on) => on === true, 'Space switched the idea on again', host);
      // Start.
      await tabTo(host, 'Start');
      await host.tap(host.page.locator(':focus'), { key: 'Enter', expect: { visible: ['voting', 'poster'] }, timeout: 20000 });
    });

    test(`a friend joins by Enter and waits (${device})`, async ({ room }) => {
      const host = await room.person('Alp', { device });
      await host.open('/');
      await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
      await host.fill(host.page.getByLabel('Mood'), 'funny space heist');
      await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] } });
      const invite = await inviteLink(host);
      const friend = await room.person('Mia', { device });
      await friend.open(invite, { settle: false });
      await friend.see({ visible: ['join-screen', 'invite-head'] }, 15000, 'invitation join page');
      await friend.audit('join page (small phone)');
      await friend.tap(friend.page.getByLabel('Your name').filter({ visible: true }), { expect: {} });
      await onScreen(friend, 'Your name field on the join page (tapped)');
      await friend.page.keyboard.type('Mia');
      await friend.tap(friend.page.locator(':focus'), { key: 'Enter', expect: { visible: ['services-sheet'] } });
      await friend.audit('Your services sheet (small phone)');
      await pickServices(friend, ['Disney+']);
      await friend.see({ visible: ['waiting'] }, 10000, 'friend waits for the host');
      await friend.audit('waiting (small phone)');
      await friend.tap(friend.button('Your services'), { expect: { visible: ['services-sheet'] } });
      await friend.tap(friend.button('Done'), { expect: { hidden: ['services-sheet'] } });
    });
  });
}
