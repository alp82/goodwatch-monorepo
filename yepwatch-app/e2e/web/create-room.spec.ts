import { expect } from '@playwright/test';
import { test, eventually, type Person } from '../lib/harness';
import { createRoom, hostName, pickServices } from './flows';

const roomCountry = (p: Person) => (p.latest?.screens as { country: string | null }[] | undefined)?.[0]?.country;

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
    await createRoom(host, 'cozy murder mystery');
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
    await createRoom(host, 'cozy murder mystery');
    expect(roomCountry(host)).toMatch(/^[A-Z]{2}$/);
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
