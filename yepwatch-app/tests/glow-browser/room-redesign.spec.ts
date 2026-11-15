import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom, reading } from './room-fake';

const shot = (page: Page, name: string) => page.screenshot({ path: `artifacts/room-redesign/${name}.png` });
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

test('guest host: New room opens Mood at once, a preset then Create room, name and services before Start', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  // A host without a name (a device that never set up opens /new from Your couches): the room asks for it.
  await page.goto('/');
  await page.goto('/new');
  await expect(page.getByLabel('Mood')).toBeVisible();
  await expect(page).toHaveURL(/\/new$/);
  expect(f.room.shared.participants[0].nickname).toBe('');
  await shot(page, '01-mood');
  // Create room waits for a mood; a preset fills the field (and shows it picked), Create room continues.
  // Moods, themes and plots (not titles): two balanced lines on a phone.
  await expect(page.getByText('Describe a mood,', { exact: true })).toBeVisible();
  await expect(page.getByText('a theme, or a plot…', { exact: true })).toBeVisible();
  await expect(button(page, 'Create couch')).toBeDisabled();
  await page.getByLabel('Mood').fill('cheer me up');
  await expect(button(page, 'Create couch')).toBeEnabled();
  await page.getByLabel('Mood').fill('');
  await button(page, 'cheer me up').click();
  await expect(page.getByLabel('Mood')).toHaveValue('cheer me up');
  await expect(button(page, 'cheer me up')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Create couch').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page).toHaveURL(/\/room\/test-room$/);
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['cheer me up', true]]);
  await shot(page, '02-room-setup');
  // Streaming: Start without services opens the picker (the room gets a country), back on the room page.
  await button(page, 'Start on my own').click();
  await expect(page.getByTestId('services-sheet')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Netflix' }).click();
  await page.getByRole('checkbox', { name: 'Prime Video' }).click();
  await shot(page, '03-your-services');
  await button(page, 'Done').click();
  await expect(page.getByTestId('services-sheet')).toHaveCount(0);
  // The room gets its country right after creation, before anyone picks services.
  await expect.poll(() => [...f.sent()].sort()).toEqual(['add_idea', 'configure', 'set_services']);
  expect(f.sent().indexOf('configure')).toBeLessThan(f.sent().indexOf('set_services'));
  expect(f.commands.find((c) => c.command.type === 'configure')?.command).toMatchObject({ country: 'US' });
  await expect(button(page, 'Netflix, Prime Video, change')).toBeVisible();
  // The name, then Start (alone: no count).
  await page.getByLabel('Your name').fill('Alp');
  await page.getByLabel('Your name').press('Enter');
  await expect.poll(() => f.room.shared.participants[0].nickname).toBe('Alp');
  await expect(button(page, 'Start on my own')).toBeEnabled();
  await button(page, 'Start on my own').click();
  await expect(page.getByTestId('voting')).toBeVisible();
  await expect(button(page, 'Yep')).toBeVisible();
  await shot(page, '04-voting');
  // Browser back from the room returns to the start page, where the room stays listed with LIVE.
  await page.goBack();
  await expect(page.getByText('Your couches', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Live')).toBeVisible();
  await shot(page, '05-your-rooms');
});

test('Mood on a desktop window: the placeholder on one row, the underline never narrower than the words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fakeRoom(page, newRoom());
  await page.goto('/room/test-room/mood?idea=new');
  const placeholder = page.getByText('Describe a mood, a theme, or a plot…', { exact: true });
  await expect(placeholder).toBeVisible();
  const line = page.getByTestId('mood-underline');
  const words = (await placeholder.boundingBox())!;
  expect(words.height).toBeLessThan(100);
  expect((await line.boundingBox())!.width).toBeGreaterThanOrEqual(words.width);
  // Create room sits in the content (no phone dock) and the presets are two rows of four.
  await expect(page.getByTestId('frame-dock')).toHaveCount(0);
  const tops = new Set(await Promise.all(['cheer me up', 'family night', 'space adventure', 'something short'].map(async (n) => Math.round((await button(page, n).boundingBox())!.y))));
  expect(tops.size).toBe(2);
});

test('a friend’s wish arrives on in the host’s ideas; the Room sheet shows it NEW and switches it off, nothing moves', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.shared.ideas.push({ id: 'i2', text: 'space adventure', authorId: 'mia', on: true, attributes: reading('space adventure') });
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  // One row per person: the friend's wish carries their name and arrives switched on.
  const ideas = page.getByTestId('room-setup').getByTestId('idea-list');
  await expect(ideas.getByRole('switch', { name: 'space adventure. Mia’s wish' })).toHaveAttribute('aria-checked', 'true');
  await expect(ideas.getByText('2 ideas, 2 on', { exact: true })).toBeVisible();
  // The header pill counts it; its Your rooms sheet opens the Room sheet.
  await button(page, 'cheer me up +1, 1 new, switch couch').click();
  await button(page, 'cheer me up +1, Couch page').click();
  const sheet = page.getByTestId('room-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('NEW', { exact: true })).toBeVisible();
  await shot(page, '06-room-sheet');
  const row = sheet.getByText('space adventure', { exact: true });
  const before = await row.boundingBox();
  const sw = sheet.getByRole('switch', { name: 'Use space adventure' });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(sheet.getByText('NEW', { exact: true })).toHaveCount(0);
  const after = await row.boundingBox();
  expect(after!.y).toBe(before!.y);
  expect(f.commands.at(-1)?.command).toEqual({ type: 'set_idea', ideaId: 'i2', on: false });
  await button(page, 'Close').click();
  await expect(sheet).toHaveCount(0);
  await expect(button(page, 'cheer me up, switch couch')).toBeVisible();
  // The duplicated room label row is gone from the room page.
  await expect(page.getByTestId('screen-bar')).toHaveCount(0);
});

test('a new wish counts in the header while the host looks at the couch and is seen the next time', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.shared.ideas.push({ id: 'i2', text: 'space adventure', authorId: 'mia', on: true, attributes: reading('space adventure') });
  await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(button(page, 'cheer me up +1, 1 new, switch couch')).toBeVisible();
  await button(page, 'Back').click();
  await button(page, 'cheer me up +1').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(button(page, 'cheer me up +1, switch couch')).toBeVisible();
});

test('Start carries the wait: Try again after a failed start, its words while the deck is built, voting the moment the round arrives', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('room-setup')).toBeVisible();
  f.refuseStarts(1);
  await button(page, 'Start with 2').click();
  await expect(button(page, 'Try again')).toBeEnabled();
  await expect(page.getByText('Couldn’t start the round', { exact: true })).toBeVisible();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  // Try again starts again; the server takes its time building the deck.
  const release = f.hold('start');
  await button(page, 'Try again').click();
  await expect(button(page, 'Starting…')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]').filter({ has: button(page, 'Starting…') })).toHaveCount(1);
  await expect(page.getByText('Couldn’t start the round', { exact: true })).toHaveCount(0);
  await expect(button(page, 'Finding titles…')).toBeVisible({ timeout: 5000 });
  release();
  // No Ready hold: the first card is there and answerable at once.
  await expect(page.getByTestId('voting')).toBeVisible();
  await expect(page.getByTestId('room-setup')).toHaveCount(0);
  await expect(button(page, 'Yep')).toBeEnabled();
  expect(f.sent().filter((t) => t === 'start')).toHaveLength(2);
});

test('a friend sees the host’s start arrive as voting, with no hold on the room', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.own.participantId = 'mia';
  room.own.canHost = false;
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByText('Waiting for Alp to start', { exact: true })).toBeVisible();
  f.room.shared.phase = 'choosing';
  f.room.shared.generation++;
  f.push();
  await page.evaluate(() => {
    for (const state of ['hidden', 'visible']) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });
  await expect(page.getByTestId('voting')).toBeVisible();
  await expect(page.getByTestId('waiting')).toHaveCount(0);
  await expect(page.getByText('Alp started', { exact: true })).toHaveCount(0);
});

test('friends see the same ideas without switches and can add a wish, then replace it', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.own.participantId = 'mia';
  room.own.canHost = false;
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('waiting')).toBeVisible();
  await expect(page.getByText('Waiting for Alp to start', { exact: true })).toBeVisible();
  // Only the host switches ideas.
  await expect(page.getByTestId('waiting').getByRole('switch')).toHaveCount(0);
  await expect(page.getByTestId('waiting').getByLabel('cheer me up. Alp’s idea. On', { exact: true })).toBeVisible();
  await expect(page.getByText('Got a wish?', { exact: true })).toBeVisible();
  await shot(page, '07-waiting');
  const field = page.getByLabel('Describe what you want to watch');
  await field.fill('rainy day whodunit');
  await expect(page.getByText('One wish each. You can replace yours later.', { exact: true })).toBeVisible();
  await field.press('Enter');
  await expect(field).toHaveValue('');
  // A friend's wish arrives switched on (the host can switch it off).
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['cheer me up', true], ['rainy day whodunit', true]]);
  await expect(page.getByLabel('rainy day whodunit. Your wish. On', { exact: true })).toBeVisible();
  // One wish each: the field now replaces it, in place, with edit_idea.
  await expect(field).toHaveAttribute('placeholder', 'Replace your wish');
  await field.fill('space adventure');
  await expect(page.getByText('Replaces your wish, “rainy day whodunit”.', { exact: true })).toBeVisible();
  await button(page, 'Replace').click();
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['cheer me up', true], ['space adventure', true]]);
  expect(f.sent().filter((t) => t === 'add_idea')).toHaveLength(1);
  expect(f.sent().filter((t) => t === 'edit_idea')).toHaveLength(1);
});

test('streaming: yours and the room’s, who brings what, host switches off', async ({ page }) => {
  const f = await fakeRoom(page, choosingRoom());
  // The old address opens the room with the Streaming sheet over it.
  await page.goto('/room/test-room/streaming');
  await expect(page.getByTestId('streaming-sheet')).toBeVisible();
  await expect(page).toHaveURL(/\/room\/test-room$/);
  await expect(page.getByText('Disney+', { exact: true })).toBeVisible();
  await shot(page, '08-streaming');
  // Netflix is the last switched-on... no: Disney+ is on too, so Netflix can go off.
  await page.getByRole('switch', { name: 'Use Netflix' }).click();
  await expect.poll(() => f.room.shared.disabledServiceIds).toEqual([8]);
  await expect(page.getByRole('switch', { name: 'Use Disney+' })).toBeDisabled();
});

test('matches, proposal for everyone (no names), Keep swiping per version, the matches chip shows it as a card', async ({ page }) => {
  const room = choosingRoom();
  room.shared.matches = [{ candidateId: 'c2', averageYepMs: null }];
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await button(page, '1 match').click();
  await expect(page.getByTestId('matches')).toBeVisible();
  await shot(page, '09-matches');
  await button(page, 'Propose this').click();
  await expect(page.getByTestId('proposal').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('YOUR PROPOSAL', { exact: true })).toBeVisible();
  await expect(page.getByText('You proposed this', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 2 agree', { exact: true })).toBeVisible();
  // A friend's view: someone proposes, no faces.
  f.room.own.agreement = { ...f.room.own.agreement, isProposer: false, agreed: false };
  f.push();
  await page.reload();
  await expect(page.getByText('SOMEONE PROPOSES', { exact: true })).toBeVisible();
  // The header's setup chip carries your own name; the proposal itself names nobody.
  await expect(page.getByTestId('frame-body').getByText(/Alp|Mia/)).toHaveCount(0);
  await shot(page, '10-proposal');
  await button(page, 'Agree').click();
  await expect(page.getByText('You agree', { exact: true })).toBeVisible();
  await button(page, 'Keep swiping').click();
  await expect(page.getByTestId('voting')).toBeVisible();
  // Set aside: the matches chip opens Matches, with the proposal as a compact card on top.
  await button(page, '1 match').click();
  await expect(page.getByTestId('matches')).toBeVisible();
  const card = page.getByTestId('proposal-card');
  await expect(card).toBeVisible();
  await expect(card.getByText('2 of 2 agree')).toBeVisible();
  await expect(card.getByText(/Alp|Mia/)).toHaveCount(0);
});

test('Tonight: scores, watch button for the first switched-on service, no Cheer button, host Start again', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'decided';
  room.shared.candidates[0].posterUrl = null;
  room.shared.decision = {
    candidateId: 'c1', proposalVersion: 1, decidedAt: Date.now(),
    availability: [{ screenId: 'room', state: 'watchable', scope: 'title', checkedAt: 1, offers: [{ serviceId: 8, name: 'Netflix', kind: 'provider', url: 'https://www.netflix.com/title/1', offerType: 'flatrate' }] }],
  } as unknown as typeof room.shared.decision;
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('tonight')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Watch on Netflix' })).toHaveAttribute('href', 'https://www.netflix.com/title/1');
  // Cheering is the poster's easter egg: no button, no hint.
  await expect(button(page, 'Cheer')).toHaveCount(0);
  await expect(page.getByText(/hold|tap the poster|🎉/i)).toHaveCount(0);
  await expect(page.getByTestId('tonight-scores').getByLabel('GoodWatch score 84')).toBeVisible();
  await expect(page.getByTestId('tonight-scores').getByLabel('IMDb 8.1')).toBeVisible();
  await shot(page, '11-tonight');
  await button(page, 'Start again').click();
  await expect.poll(() => f.sent()).toEqual(['restart']);
  await expect(page.getByTestId('room-setup')).toBeVisible();
});

test('an empty deck shows Finding more, never an end', async ({ page }) => {
  const room = choosingRoom();
  room.shared.stream = { version: 2, state: 'capacity', reason: 'room_capacity' };
  room.own.votes = room.shared.candidates.map((c) => ({ candidateId: c.id, value: 'pass', revision: 1, activeExposureMs: null, timingSource: 'unavailable' }));
  room.own.nextCandidateId = null;
  await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('finding-more')).toBeVisible();
  await expect(page.getByText(/limit|caught up|no more/i)).toHaveCount(0);
  await shot(page, '12-finding-more');
});

test('a friend opens the link: name, Join, then their services, then the waiting screen', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  const f = await fakeRoom(page, room);
  // Before admission the friend can't read the room yet.
  await page.route('**/proposal/rooms/test-room', (route) => (f.room.shared.participants.some((p) => p.participantId === 'guest')
    ? route.fallback()
    : route.fulfill({ status: 401, json: { error: { code: 'unauthorized', message: 'Not a member yet', retryable: false } } })));
  await page.goto('/r/K7QX');
  await expect(page.getByLabel('Couch code or invitation')).toHaveCount(0);
  await expect(button(page, 'Join')).toBeDisabled();
  await page.getByLabel('Your name').fill('Sam');
  await shot(page, '13-join');
  await button(page, 'Join').click();
  await expect(page.getByTestId('services-sheet')).toBeVisible();
  await expect(page.getByTestId('waiting')).toBeVisible();
  await page.getByRole('checkbox', { name: 'HBO Max' }).click();
  await button(page, 'Done').click();
  await expect(page.getByTestId('services-sheet')).toHaveCount(0);
  await expect.poll(() => f.room.shared.participants.find((p) => p.participantId === 'guest')?.serviceIds).toEqual([1899]);
  await button(page, 'Netflix, Disney+ +1, change').click();
  await expect(page.getByTestId('services-sheet').getByRole('checkbox', { name: 'HBO Max' })).toHaveAttribute('aria-checked', 'true');
});

test('nobody brings a service: the room asks for services instead of showing an error', async ({ page }) => {
  const room = choosingRoom();
  room.shared.participants.forEach((p) => { p.serviceIds = []; });
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByText('Pick a streaming service', { exact: true })).toBeVisible();
  await expect(page.getByText(/country|screen/i)).toHaveCount(0);
  await shot(page, '14-pick-services');
  await button(page, 'Your services').click();
  await expect(page.getByTestId('services-sheet')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Netflix' }).click();
  await button(page, 'Done').click();
  await expect.poll(() => f.room.shared.participants[0].serviceIds).toEqual([8]);
});

test('the room’s idea budget is used up: a plain line, the idea isn’t replaced', async ({ page }) => {
  const f = await fakeRoom(page, choosingRoom(), { interpretations: 24 });
  await page.goto('/room/test-room/room');
  await button(page, 'Add an idea').click();
  await page.getByLabel('Mood').fill('space adventure');
  await page.getByLabel('Mood').press('Enter');
  await expect(page.getByText('No more new ideas in this couch', { exact: true })).toBeVisible();
  expect(f.room.shared.ideas.map((i) => i.text)).toEqual(['cheer me up']);
});

test('the host replaces their idea from the console: Replace sends edit_idea and switches it back on', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.shared.ideas[0].on = false;
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  const field = page.getByLabel('Describe what you want to watch');
  await expect(field).toHaveAttribute('placeholder', 'Replace your idea');
  await field.fill('twist ending');
  await expect(page.getByText('Replaces your idea, “cheer me up”.', { exact: true })).toBeVisible();
  await button(page, 'Replace').click();
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.id, i.text, i.on])).toEqual([['i1', 'twist ending', true]]);
  expect(f.sent()).toEqual(['edit_idea']);
  await expect(page.getByRole('switch', { name: 'twist ending. Your idea' })).toHaveAttribute('aria-checked', 'true');
});

test('a Try example writes itself into the field, cursor at the end, and sends nothing', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.shared.ideas = [];
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByText('Leave it empty for well-liked picks, or add an idea to steer the cards.', { exact: true })).toBeVisible();
  const example = page.getByTestId('try').getByRole('button', { name: /^Try / });
  const name = (await example.getAttribute('aria-label'))!.replace(/^Try /, '');
  // The hit area is a full 48 px tall.
  expect((await example.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await example.click();
  const field = page.getByLabel('Describe what you want to watch');
  await expect(field).toHaveValue(name);
  await expect(field).toBeFocused();
  expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([name.length, name.length]);
  expect(f.sent()).toEqual([]);
});

test.describe('the join screen shows the room from the invite preview', () => {
  /** A friend on the link before admission: the room itself can't be read yet. */
  async function openInvite(page: Page, room = choosingRoom(), preview?: 'fail') {
    room.shared.phase = 'setup';
    const f = await fakeRoom(page, room, { preview });
    await page.route('**/proposal/rooms/test-room', (route) => (f.room.shared.participants.some((p) => p.participantId === 'guest')
      ? route.fallback()
      : route.fulfill({ status: 401, json: { error: { code: 'unauthorized', message: 'Not a member yet', retryable: false } } })));
    await page.goto('/r/K7QX');
    return f;
  }

  test('one idea is the headline under the host’s room label', async ({ page }) => {
    await openInvite(page);
    const head = page.getByTestId('invite-head');
    await expect(head.getByText('ALP’S COUCH')).toBeVisible();
    await expect(head.getByTestId('invite-ideas')).toHaveText('cheer me up');
    await expect(head.getByText('Movies and shows')).toBeVisible();
    await expect(head.getByLabel('2 people')).toBeVisible();
    await expect(page.getByText('Join the couch', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Your name')).toBeVisible();
    await shot(page, '13-join-one-idea');
  });

  test('several switched-on ideas stack; switched-off ones stay hidden; no name says your friend', async ({ page }) => {
    const room = choosingRoom();
    room.shared.participants[0].nickname = '';
    room.shared.constraints.kinds = ['movie'];
    room.shared.ideas.push(
      { id: 'i2', text: 'rainy day whodunit', authorId: 'mia', on: true, attributes: reading('rainy day whodunit') },
      { id: 'i3', text: 'something long and sad', authorId: 'mia', on: false, attributes: reading('something long and sad') },
    );
    await openInvite(page, room);
    const head = page.getByTestId('invite-head');
    await expect(head.getByText('YOUR FRIEND’S COUCH')).toBeVisible();
    const ideas = head.getByTestId('invite-ideas').locator('> *');
    await expect(ideas).toHaveText(['cheer me up', 'rainy day whodunit']);
    await expect(head.getByText('Movies', { exact: true })).toBeVisible();
    await shot(page, '13-join-ideas');
  });

  test('no ideas says what the host wants, never Anything', async ({ page }) => {
    const room = choosingRoom();
    room.shared.ideas = [];
    await openInvite(page, room);
    await expect(page.getByTestId('invite-ideas')).toHaveText('Alp wants to pick something to watch with you');
  });

  test('a failed preview keeps Join the room and the form still joins', async ({ page }) => {
    const f = await openInvite(page, choosingRoom(), 'fail');
    await expect(page.getByTestId('join-screen').getByText('Join the couch', { exact: true })).toBeVisible();
    await expect(page.getByTestId('invite-head')).toHaveCount(0);
    await expect(page.getByTestId('invite-head-pending')).toHaveCount(0);
    await page.getByLabel('Your name').fill('Sam');
    await button(page, 'Join').click();
    await expect(page.getByTestId('services-sheet')).toBeVisible();
    expect(f.room.shared.participants.some((p) => p.participantId === 'guest')).toBe(true);
  });
});
