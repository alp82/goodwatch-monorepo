import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom, reading } from './room-fake';

const shot = (page: Page, name: string) => page.screenshot({ path: `artifacts/room-redesign/${name}.png` });
const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });

test('guest host: New room opens Mood at once, a preset then Create room, name and services before Start', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  await page.goto('/');
  await button(page, 'New room').click();
  await expect(page.getByLabel('Mood')).toBeVisible();
  await expect(page).toHaveURL(/\/new$/);
  expect(f.room.shared.participants[0].nickname).toBe('');
  await shot(page, '01-mood');
  // Create room waits for a mood; a preset fills the field (and shows it picked), Create room continues.
  // Moods, themes and plots (not titles): two balanced lines on a phone.
  await expect(page.getByText('Describe a mood,', { exact: true })).toBeVisible();
  await expect(page.getByText('a theme, or a plot…', { exact: true })).toBeVisible();
  await expect(button(page, 'Create room')).toBeDisabled();
  await page.getByLabel('Mood').fill('cheer me up');
  await expect(button(page, 'Create room')).toBeEnabled();
  await page.getByLabel('Mood').fill('');
  await button(page, 'cheer me up').click();
  await expect(page.getByLabel('Mood')).toHaveValue('cheer me up');
  await expect(button(page, 'cheer me up')).toHaveAttribute('aria-pressed', 'true');
  await button(page, 'Create room').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page).toHaveURL(/\/room\/test-room$/);
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['cheer me up', true]]);
  await shot(page, '02-room-setup');
  // Streaming: Start without services opens the picker (the room gets a country), back on the room page.
  await button(page, 'Start').click();
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
  // The name, then Start.
  await page.getByLabel('Your name').fill('Alp');
  await page.getByLabel('Your name').press('Enter');
  await expect.poll(() => f.room.shared.participants[0].nickname).toBe('Alp');
  await expect(button(page, 'Start')).toBeEnabled();
  await button(page, 'Start').click();
  await expect(page.getByTestId('voting')).toBeVisible();
  await expect(button(page, 'Yep')).toBeVisible();
  await shot(page, '04-voting');
  // Browser back from the room returns to the start page, where the room stays listed with LIVE.
  await page.goBack();
  await expect(page.getByText('Open', { exact: true })).toBeVisible();
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

test('a friend’s idea arrives on with NEW for the host; the Room sheet switches it off, NEW goes, nothing moves', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.shared.ideas.push({ id: 'i2', text: 'space adventure', authorId: 'mia', on: true, attributes: reading('space adventure') });
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  // The ideas are the headline; the friend's carries its author and NEW.
  const ideas = page.getByTestId('room-setup').getByTestId('idea-list');
  await expect(ideas.getByLabel('space adventure, from Mia, new')).toBeVisible();
  await expect(page.getByTestId('room-setup').getByRole('switch', { name: 'Use space adventure' })).toHaveAttribute('aria-checked', 'true');
  // The header pill counts it; its Your rooms sheet opens the Room sheet.
  await button(page, 'cheer me up +1, 1 new, switch room').click();
  await button(page, 'cheer me up +1, Room page').click();
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
  await expect(button(page, 'cheer me up, switch room')).toBeVisible();
  // The duplicated room label row is gone from the room page.
  await expect(page.getByTestId('screen-bar')).toHaveCount(0);
});

test('NEW stays while the host looks at the room and is gone the next time', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.shared.ideas.push({ id: 'i2', text: 'space adventure', authorId: 'mia', on: true, attributes: reading('space adventure') });
  await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByText('NEW', { exact: true })).toBeVisible();
  await button(page, 'Back').click();
  await button(page, 'cheer me up +1').click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page.getByText('NEW', { exact: true })).toHaveCount(0);
});

test('Start carries the wait: Try again after a failed start, its words while the deck is built, voting the moment the round arrives', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('room-setup')).toBeVisible();
  f.refuseStarts(1);
  await button(page, 'Start').click();
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

test('friends see the same ideas with disabled switches and can suggest one', async ({ page }) => {
  const room = choosingRoom();
  room.shared.phase = 'setup';
  room.own.participantId = 'mia';
  room.own.canHost = false;
  const f = await fakeRoom(page, room);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('waiting')).toBeVisible();
  await expect(page.getByText('Waiting for Alp to start', { exact: true })).toBeVisible();
  const sw = page.getByRole('switch', { name: 'Use cheer me up' });
  await expect(sw).toBeDisabled();
  await expect(sw).toHaveAttribute('aria-disabled', 'true');
  await shot(page, '07-waiting');
  await button(page, 'Suggest an idea').click();
  await page.getByLabel('Mood').fill('rainy day whodunit');
  await page.getByLabel('Mood').press('Enter');
  await expect(page.getByTestId('waiting')).toBeVisible();
  // A friend's idea arrives switched on (the host can switch it off).
  await expect.poll(() => f.room.shared.ideas.map((i) => [i.text, i.on])).toEqual([['cheer me up', true], ['rainy day whodunit', true]]);
  await expect(button(page, 'rainy day whodunit, edit')).toBeVisible();
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
  await expect(page.getByText(/Alp|Mia/)).toHaveCount(0);
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
  await expect(page.getByLabel('Room code or invitation')).toHaveCount(0);
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
  await button(page, 'Your services').click();
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

test('the room’s idea budget is used up: a plain line, the idea isn’t added', async ({ page }) => {
  const f = await fakeRoom(page, choosingRoom(), { interpretations: 24 });
  await page.goto('/room/test-room/room');
  await button(page, 'Add an idea').click();
  await page.getByLabel('Mood').fill('space adventure');
  await page.getByLabel('Mood').press('Enter');
  await expect(page.getByText('No more new ideas in this room', { exact: true })).toBeVisible();
  expect(f.room.shared.ideas.map((i) => i.text)).toEqual(['cheer me up']);
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
    await expect(head.getByText('ALP’S ROOM')).toBeVisible();
    await expect(head.getByTestId('invite-ideas')).toHaveText('cheer me up');
    await expect(head.getByText('Movies and shows')).toBeVisible();
    await expect(head.getByLabel('2 people')).toBeVisible();
    await expect(page.getByText('Join the room', { exact: true })).toHaveCount(0);
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
    await expect(head.getByText('YOUR FRIEND’S ROOM')).toBeVisible();
    const ideas = head.getByTestId('invite-ideas').locator('> *');
    await expect(ideas).toHaveText(['cheer me up', 'rainy day whodunit']);
    await expect(head.getByText('Movies', { exact: true })).toBeVisible();
    await shot(page, '13-join-ideas');
  });

  test('no ideas reads Anything', async ({ page }) => {
    const room = choosingRoom();
    room.shared.ideas = [];
    await openInvite(page, room);
    await expect(page.getByTestId('invite-ideas')).toHaveText('Anything');
  });

  test('a failed preview keeps Join the room and the form still joins', async ({ page }) => {
    const f = await openInvite(page, choosingRoom(), 'fail');
    await expect(page.getByTestId('join-screen').getByText('Join the room', { exact: true })).toBeVisible();
    await expect(page.getByTestId('invite-head')).toHaveCount(0);
    await expect(page.getByTestId('invite-head-pending')).toHaveCount(0);
    await page.getByLabel('Your name').fill('Sam');
    await button(page, 'Join').click();
    await expect(page.getByTestId('services-sheet')).toBeVisible();
    expect(f.room.shared.participants.some((p) => p.participantId === 'guest')).toBe(true);
  });
});
