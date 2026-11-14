import { expect } from '@playwright/test';
import { test, eventually, issuer, type Person } from '../lib/harness';
import { cardTitle, createRoom, hostName, pageTap, pickServices, recordPage, start } from './flows';

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
        // The answer takes a moment to reach the app, as over a network: going away when the route has the request
        // (not when the app has the answer) would cancel it before the app learns of the wait.
        await new Promise((r) => setTimeout(r, 200));
        return route.fulfill({ status: 429, headers: { 'Retry-After': '10' }, contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'rate_limited', message: 'Slow down', retryable: true } }) });
      }
      const response = await route.fetch();
      answered = Date.now();
      await route.fulfill({ response });
    });
    // In the page, so its time is the page's own: when the app shows a line is compared with when it went away.
    const visibility = (state: 'hidden' | 'visible') => host.page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      return Date.now();
    }, state);
    await host.open('/');
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
    await host.fill(host.page.getByLabel('Mood'), 'rate limited heist');
    const stop = await recordPage(host, 'mood-page', /Couldn|Try again|offline/i);
    // Away as soon as the app holds the server's wait: it has read the 429 and saved the deadline with its request.
    // Going away earlier (the route has the request, the answer is still on its way) cancels the request before the
    // app learns of any wait, so it rightly sends again on return and this route answers that at once. Watched in the
    // page, so the test's own scheduling can't push the moment past the quiet period.
    await host.page.evaluate(() => {
      const w = window as unknown as { __awayAt?: number };
      delete w.__awayAt;
      const watch = window.setInterval(() => {
        const saved = JSON.parse(sessionStorage.getItem('yepwatch.v3.admission.') ?? 'null') as { retryAt?: number } | null;
        if (!(saved?.retryAt && saved.retryAt > 0)) return;
        window.clearInterval(watch);
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        w.__awayAt = Date.now();
      }, 5);
    });
    await host.tap(host.button('Create room'), { expect: {} });
    const awayAt = () => host.page.evaluate(() => (window as unknown as { __awayAt?: number }).__awayAt ?? 0);
    await expect.poll(awayAt, { intervals: [10], timeout: 10000 }).toBeGreaterThan(0);
    const away = await awayAt();
    expect(tries).toBe(1);
    const tapped = await pageTap(host);
    expect(away - tapped, 'away before the quiet period ends').toBeLessThan(3000);
    // Back a second later: the saved wait resumes.
    await new Promise((r) => setTimeout(r, Math.max(0, away + 1000 - Date.now())));
    const back = await visibility('visible');
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

  // Production 2026-11-12: GoodWatch's search spend limit was reached (503 interpretation_unavailable, budget).
  // Owner rule: a failing dependency never blocks the user. The room opens with the idea kept but unmatched, a small
  // note says so, and setup and Start go on with the usual ranking: no Try again, no error gate.
  test('search over its spend limit: the room with an idea opens, sets up and starts without a tap on Try again', async ({ room }) => {
    const host = await room.person('Alp');
    const mood = `budget refused heist ${Math.random().toString(36).slice(2, 8)}`;
    const second = `${mood} sequel`;
    await issuer(`/_e2e/search-budget?prompt=${encodeURIComponent(mood)}`);
    await issuer(`/_e2e/search-budget?prompt=${encodeURIComponent(second)}`);
    try {
      await host.open('/');
      await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
      await host.fill(host.page.getByLabel('Mood'), mood);
      const stop = await recordPage(host, 'mood-page', /Couldn|Try again|unavailable/i);
      const sent = host.commandLog.length;
      await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] } });
      const samples = await stop().catch(() => null);
      expect(samples, 'the Mood page was sampled').not.toBeNull();
      expect(samples!.filter((s) => s.error), 'no error or Try again on the Mood page').toEqual([]);
      // Still one round trip: the server keeps the idea, so the app sends no add_idea after the create.
      if (room.fault === 'none') expect(host.commandLog.slice(sent).map((c) => c.path.replace(/^.*\/proposal/, '')).filter((path) => !path.endsWith('/realtime-ticket'))).toEqual(['/rooms']);
      await eventually(() => host.latest?.ideas.map((i) => [i.text, i.on, i.attributes.length]), (v) => JSON.stringify(v) === JSON.stringify([[mood, true, 0]]), 'the idea is kept, uninterpreted', host);
      await expect(host.page.getByTestId('idea-unmatched').filter({ visible: true })).toHaveText('Mood matching is unavailable for now.');
      // The author's own edit button says so too: the note is inside it, so its accessible name carries it.
      await expect(host.button(`${mood}, edit, mood matching is unavailable for now`)).toBeVisible();
      await room.point('room');
      await host.audit('room page with an unmatched idea');
      // Another idea while search is still refused is added too (the command path).
      await host.tap(host.button('Add an idea'), { expect: { visible: ['mood-page'] } });
      await host.fill(host.page.getByLabel('Mood', { exact: true }), second);
      await host.tap(host.page.getByLabel('Mood', { exact: true }), { key: 'Enter', expect: { visible: ['room-setup'] } });
      await eventually(() => host.latest?.ideas.map((i) => i.text), (v) => JSON.stringify(v) === JSON.stringify([mood, second]), 'the second idea is kept too', host);
      await hostName(host, 'Alp');
      await pickServices(host, ['Netflix'], () => host.tap(host.button('Streaming services, add'), { expect: { visible: ['services-sheet'] } }));
      await start(host, []);
    } finally {
      await issuer(`/_e2e/search-budget?prompt=${encodeURIComponent(mood)}&on=0`);
      await issuer(`/_e2e/search-budget?prompt=${encodeURIComponent(second)}&on=0`);
    }
  });

  // Owner decision Q32: Create room never waits for the idea's interpretation (GoodWatch's two Jev calls,
  // ~0.6-1.5 s). The search fake takes 1 s for this prompt: the room still opens before that answer, the idea is
  // pending (no "unavailable" note), and its matching lands a moment later and shapes the deck.
  test('create with a slow idea search: the room opens at once, the idea\'s matching lands later, no unavailable note', async ({ room }) => {
    const host = await room.person('Alp');
    const mood = `slow western ${Math.random().toString(36).slice(2, 8)}`;
    await issuer(`/_e2e/search-delay?prompt=${encodeURIComponent(mood)}&ms=1000`);
    try {
      await host.open('/');
      await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] } });
      await host.fill(host.page.getByLabel('Mood'), mood);
      const stop = await recordPage(host, 'room-setup', /Mood matching is unavailable/i);
      await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
      const created = host.samples.filter((x) => x.moment === 'createRoomMs').at(-1);
      // Behaviour, not speed: a room page before the 1 s search answered means Create room didn't wait for it.
      if (room.fault === 'none') expect(created?.ms, 'Create room → room page before the 1 s search answers').toBeLessThan(1000);
      await eventually(() => host.latest?.ideas.map((i) => [i.text, i.attributes.map((a) => a.key ?? a.text)]), (v) => JSON.stringify(v) === JSON.stringify([[mood, ['western']]]), 'the idea\'s matching lands', host, 10000);
      const samples = await stop().catch(() => null);
      expect(samples?.length, 'the room page was sampled').toBeGreaterThan(0);
      expect(samples!.filter((x) => x.error), 'no "Mood matching is unavailable" while the search runs').toEqual([]);
      await expect(host.page.getByTestId('idea-unmatched')).toHaveCount(0);
      await room.point('room');
      await hostName(host, 'Alp');
      await pickServices(host, ['Netflix'], () => host.tap(host.button('Streaming services, add'), { expect: { visible: ['services-sheet'] } }));
      await start(host, []);
      // The landed idea leads the deck: its first card is a western.
      expect(await cardTitle(host)).toMatch(/western/i);
    } finally {
      await issuer(`/_e2e/search-delay?prompt=${encodeURIComponent(mood)}&ms=0`);
    }
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
