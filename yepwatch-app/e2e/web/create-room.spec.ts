import { expect } from '@playwright/test';
import { test, eventually, type Person } from '../lib/harness';
import { createRoom, hostName, pageTap, pickServices, recordPage } from './flows';

const roomCountry = (p: Person) => (p.latest?.screens as { country: string | null }[] | undefined)?.[0]?.country;

/** Create room, untimed: the compatibility paths take extra round trips and aren't the createRoomMs moment. */
async function createWithoutTiming(host: Person, mood: string) {
  await host.open('/');
  await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
  await host.fill(host.page.getByLabel('Mood'), mood);
  await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] } });
  await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify([mood]), 'the room has exactly the one idea', host);
}

test.describe('create and set up a room', () => {
  test('create room: start page → Mood → room page @core', async ({ room }) => {
    const host = await room.person('Alp');
    await host.open('/');
    await host.see({ visible: ['landing'] });
    await host.audit('start page (first visit)');
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] }, moment: 'newRoomMs' });
    await host.audit('Mood page');
    await host.fill(host.page.getByLabel('Mood'), 'funny space heist');
    const sent = host.commandLog.length;
    await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
    // One round trip: the create request carries the country and the first idea (no configure/add_idea after it).
    if (room.fault === 'none') expect(host.commandLog.slice(sent).map((c) => c.path.replace(/^.*\/proposal/, '')).filter((path) => !path.endsWith('/realtime-ticket'))).toEqual(['/rooms']);
    expect(roomCountry(host)).toMatch(/^[A-Z]{2}$/);
    await room.point('room');
    await host.audit('room page (host, before Start)');
    await eventually(() => host.latest?.ideas.map((i) => [i.text, i.on]), (v) => JSON.stringify(v) === JSON.stringify([['funny space heist', true]]), 'exactly one idea, on', host);
  });

  // Deploy window: an older server refuses the create request's setup (400, nothing created).
  test('an older server refuses setup: the app sends the plain create and sets the room up itself', async ({ room }) => {
    const host = await room.person('Alp');
    host.expectStatus(/^400 .*\/proposal\/rooms$/);
    await host.page.route(/\/api\/yepwatch\/v1\/proposal\/rooms$/, (route) => route.request().method() === 'POST' && route.request().postDataJSON()?.setup
      ? route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'invalid_request', message: 'Invalid request shape', retryable: false } }) })
      : route.continue());
    await createWithoutTiming(host, 'cozy murder mystery');
    expect(roomCountry(host)).toMatch(/^[A-Z]{2}$/);
  });

  // Older app bundles send the plain create, then configure and add_idea.
  test('an older app (plain create, then its own setup steps) still gets a set-up room', async ({ room }) => {
    const host = await room.person('Alp');
    await host.page.route(/\/api\/yepwatch\/v1\/proposal\/rooms$/, (route) => {
      const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
      if (!body?.setup) return route.continue();
      delete body.setup;
      return route.continue({ postData: JSON.stringify(body) });
    });
    await createWithoutTiming(host, 'cozy murder mystery');
    expect(roomCountry(host)).toMatch(/^[A-Z]{2}$/);
  });

  // Production 2026-11-12: two creates in a row took longer than the app's 6 s wait (slow store writes).
  // The page keeps sending the same saved request (same command id and secret) and opens the room itself.
  test('a slow server: the create goes again by itself and the room opens without a tap', async ({ room }) => {
    const host = await room.person('Alp');
    const answers: { roomId?: string; status: number }[] = [];
    let first = 0;
    let answered = 0;
    await host.page.route(/\/api\/yepwatch\/v1\/proposal\/rooms$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const n = answers.length + 1;
      if (n === 1) first = Date.now();
      // The server gets every try (and makes the room on the first); the first two answers come after 7 s.
      const response = await route.fetch();
      answers.push({ status: response.status(), roomId: (await response.json().catch(() => null))?.credential?.roomId });
      if (n <= 2) await new Promise((r) => setTimeout(r, 7000));
      else answered = Date.now();
      await route.fulfill({ response }).catch(() => undefined); // the app stopped waiting for the slow ones
    });
    await host.open('/');
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
    await host.fill(host.page.getByLabel('Mood'), 'slow server heist');
    const stop = await recordPage(host, 'mood-page', /Couldn|Try again|offline/i);
    await host.tap(host.button('Create room'), { expect: {} });
    // Q24a: quiet at first, then one small floating line; never "Couldn't reach" or Try again.
    await expect(host.page.getByTestId('room-note').filter({ visible: true })).toHaveText('Reconnecting…', { timeout: 12000 });
    await host.see({ visible: ['room-setup'] }, 30000, 'the room opens by itself');
    // The wait starts with the press (the create's own request leaves a moment later, `first`).
    const tapped = await pageTap(host);
    const samples = await stop();
    expect(tapped).toBeLessThanOrEqual(first);
    room.noteOutage(tapped, answered);
    const firstNote = samples.find((s) => s.note)?.t ?? Infinity;
    expect(firstNote - tapped, 'quiet for the first 3 s of the outage').toBeGreaterThanOrEqual(3000);
    // The first create is still unanswered (the app waits 6 s, the answer comes after 7 s): the line shows at the
    // end of the quiet period, not when that request finally fails.
    expect(firstNote - tapped, 'the line shows at 3 s while the first request still waits').toBeLessThan(4000);
    expect(samples.some((s) => s.t < tapped + 3000 && s.t > tapped), 'sampled during the quiet period').toBe(true);
    expect(samples.filter((s) => s.error), 'no error or Try again meanwhile').toEqual([]);
    expect(answers.length).toBe(3);
    expect(answers.every((a) => a.status === 200)).toBe(true);
    expect(new Set(answers.map((a) => a.roomId)).size).toBe(1);
    expect(host.latest?.roomId).toBe(answers[0].roomId);
    await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify(['slow server heist']), 'the one room has its one idea', host);
  });

  // Q24a: an outage the server recovers from within 3 s shows nothing at all.
  test('a short outage: the create goes again and the room opens with no line, error or Try again', async ({ room }) => {
    const host = await room.person('Alp');
    host.expectStatus(/^503 .*\/proposal\/rooms$/);
    let tries = 0;
    let first = 0;
    let answered = 0;
    await host.page.route(/\/api\/yepwatch\/v1\/proposal\/rooms$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (++tries === 1) {
        first = Date.now();
        // Busy for a second (nothing created), then the same request goes again.
        return route.fulfill({ status: 503, headers: { 'Retry-After': '1' }, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'busy', message: 'Busy', retryable: true } }) });
      }
      const response = await route.fetch();
      answered = Date.now();
      await route.fulfill({ response });
    });
    await host.open('/');
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
    await host.fill(host.page.getByLabel('Mood'), 'short outage heist');
    const stop = await recordPage(host, 'mood-page', /Couldn|Try again|offline/i);
    await host.tap(host.button('Create room'), { expect: {} });
    await host.see({ visible: ['room-setup'] }, 10000, 'the room opens by itself');
    room.noteOutage(first, answered);
    const samples = await stop().catch(() => null);
    expect(tries).toBe(2);
    expect(answered - first, 'answered within the quiet period').toBeLessThan(3000);
    // The recorder lives in the page, which stays (the room replaces the Mood page in place).
    expect(samples, 'the Mood page was sampled').not.toBeNull();
    expect(samples!.filter((s) => s.note || s.error), 'nothing ever shows').toEqual([]);
    await expect(host.page.getByTestId('room-note').filter({ visible: true })).toHaveCount(0);
  });

  // A server wait resumed after the app was away is the same outage: quiet first, then "Reconnecting…".
  test('a Retry-After resumed after the background: the line comes after the quiet period and the room opens', async ({ room }) => {
    const host = await room.person('Alp');
    host.expectStatus(/^429 .*\/proposal\/rooms$/);
    let tries = 0;
    let first = 0;
    let answered = 0;
    await host.page.route(/\/api\/yepwatch\/v1\/proposal\/rooms$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (++tries === 1) {
        first = Date.now();
        return route.fulfill({ status: 429, headers: { 'Retry-After': '10' }, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down', retryable: true } }) });
      }
      const response = await route.fetch();
      answered = Date.now();
      await route.fulfill({ response });
    });
    const visibility = (state: 'hidden' | 'visible') => host.page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
    await host.open('/');
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
    await host.fill(host.page.getByLabel('Mood'), 'rate limited heist');
    const stop = await recordPage(host, 'mood-page', /Couldn|Try again|offline/i);
    await host.tap(host.button('Create room'), { expect: {} });
    await expect.poll(() => tries).toBe(1);
    // Away before the quiet period ends, back a second later: the saved wait resumes.
    await visibility('hidden');
    await new Promise((r) => setTimeout(r, 1000));
    const back = Date.now();
    await visibility('visible');
    await expect(host.page.getByTestId('room-note').filter({ visible: true })).toHaveText('Reconnecting…', { timeout: 8000 });
    await host.see({ visible: ['room-setup'] }, 15000, 'the room opens by itself after the wait');
    room.noteOutage(first, answered);
    const samples = (await stop().catch(() => null)) ?? [];
    expect(samples.some((s) => s.note), 'the line was sampled').toBe(true);
    const firstNote = samples.find((s) => s.note)?.t ?? Infinity;
    expect(firstNote - back, 'quiet for the first 3 s after the wait resumed').toBeGreaterThanOrEqual(3000);
    expect(answered - first, 'the server\'s wait held').toBeGreaterThanOrEqual(10000);
    expect(samples.filter((s) => s.error), 'no error or Try again meanwhile').toEqual([]);
    expect(tries).toBe(2);
  });

  test('create room from a preset chip ("Anything goes")', async ({ room }) => {
    const host = await room.person('Alp');
    await host.open('/');
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
    await host.tap(host.button('Anything goes'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
    await eventually(() => host.latest?.ideas.length, (n) => n === 0, 'Anything goes makes a room without ideas', host);
  });

  test('setup: name, services, movies and shows, ideas on/off, edit mood', async ({ room }) => {
    const host = await room.person('Alp');
    await createRoom(host, 'rainy day whodunit');
    await room.point('room');
    // Start opens the first missing step instead of starting.
    await host.tap(host.button('Start'), { expect: { visible: ['services-sheet'] } });
    await host.audit('Your services sheet');
    await pickServices(host, ['Netflix', 'Disney+']);
    await eventually(() => (host.latest?.screens as { serviceIds: number[]; country: string }[] | undefined)?.[0]?.serviceIds.length ?? 0, (n) => n > 0, 'services saved on the screen', host);
    // Name is the next missing step: Start focuses the field.
    await host.tap(host.button('Start'), { expect: {} });
    await hostName(host, 'Alp');
    // Movies and shows
    await host.tap(host.button(/^Movies and shows, change$|, change$/).filter({ hasText: /Movies|shows/i }).first(), { expect: { visible: ['kinds-sheet'] } });
    await host.audit('Movies and shows sheet');
    await host.tap(host.button('Done'), { expect: { hidden: ['kinds-sheet'] } });
    // A second idea, then switch it off and on.
    await host.tap(host.button('Add an idea'), { expect: { visible: ['mood-page'] } });
    await host.fill(host.page.getByLabel('Mood'), 'space adventure');
    await host.tap(host.page.getByLabel('Mood'), { key: 'Enter', expect: { visible: ['room-setup'] } });
    await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify(['rainy day whodunit', 'space adventure']), 'two ideas, no duplicates', host);
    const sw = host.page.getByRole('switch', { name: 'Use space adventure' }).filter({ visible: true });
    await host.tap(sw, { expect: {} });
    await eventually(() => host.latest?.ideas.find((i) => i.text === 'space adventure')?.on, (on) => on === false, 'idea switched off', host);
    await host.tap(sw, { expect: {} });
    await eventually(() => host.latest?.ideas.find((i) => i.text === 'space adventure')?.on, (on) => on === true, 'idea switched on again', host);
    // Edit the mood.
    await host.tap(host.button('rainy day whodunit, edit'), { expect: { visible: ['mood-page'] } });
    await host.fill(host.page.getByLabel('Mood'), 'rainy day mystery');
    await host.tap(host.page.getByLabel('Mood'), { key: 'Enter', expect: { visible: ['room-setup'] } });
    await eventually(() => host.latest?.ideas.map((i) => i.text).sort(), (v) => JSON.stringify(v) === JSON.stringify(['rainy day mystery', 'space adventure']), 'mood edited in place', host);
    // Room sheet and Streaming sheet.
    await host.tap(host.button('Room'), { expect: { visible: ['room-sheet'] } });
    await host.audit('Room sheet');
    await host.tap(host.button('Close').last(), { expect: { hidden: ['room-sheet'] } });
    await host.tap(host.button(/^Netflix.*, change$/), { expect: { visible: ['streaming-sheet'] } });
    await host.audit('Streaming sheet');
    await host.tap(host.button('Done'), { expect: { hidden: ['streaming-sheet'] } });
    await host.tap(host.button('Just you, people'), { expect: { visible: ['people-sheet'] } });
    await host.audit('People sheet');
    await host.tap(host.button('Done'), { expect: { hidden: ['people-sheet'] } });
  });
});
