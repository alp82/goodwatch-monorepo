import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom, newRoom } from './room-fake';

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
/** The app goes to the background and comes back: a re-render and a fresh read of the room. */
const backgroundAndBack = (page: Page) => page.evaluate(() => {
  for (const state of ['hidden', 'visible']) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
  }
});

test.describe('settings pages keep their change until the server confirms it', () => {
  test('Your services: changed while a refill is in flight, Done, then browser Back; saved after the refill', async ({ page }) => {
    const f = await fakeRoom(page, choosingRoom());
    const release = f.hold('refill');
    await page.goto('/room/test-room/streaming');
    // The background refill is in flight (the deck is nearly empty).
    await expect.poll(() => f.sent()).toContain('refill');
    await button(page, 'Netflix, change').click();
    await expect(page.getByTestId('services-page')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Prime Video' }).click();
    await button(page, 'Done').click();
    await expect(page.getByTestId('streaming-page')).toBeVisible();
    expect(f.sent()).not.toContain('set_services');
    // Reopened before it's saved: the change is still there; leave with browser Back this time.
    await button(page, 'Netflix, change').click();
    await expect(page.getByRole('checkbox', { name: 'Prime Video' })).toHaveAttribute('aria-checked', 'true');
    await page.goBack();
    await expect(page.getByTestId('streaming-page')).toBeVisible();
    expect(f.sent()).not.toContain('set_services');
    release();
    await expect.poll(() => f.room.shared.participants[0].serviceIds).toEqual([8, 9]);
    expect(f.sent().filter((t) => t === 'set_services')).toHaveLength(1);
    await expect(button(page, 'Netflix, Prime Video, change')).toBeVisible();
    // Confirmed: from now on the page shows the room, not the old draft.
    f.room.shared.participants[0].serviceIds = [337];
    f.push();
    await backgroundAndBack(page);
    await expect(button(page, 'Disney+, change')).toBeVisible();
    await button(page, 'Disney+, change').click();
    await expect(page.getByRole('checkbox', { name: 'Prime Video' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('checkbox', { name: 'Disney+' })).toHaveAttribute('aria-checked', 'true');
  });

  test('Movies and shows: changed while a refill is in flight, browser Back; saved after it', async ({ page }) => {
    const f = await fakeRoom(page, choosingRoom());
    const release = f.hold('refill');
    await page.goto('/room/test-room/room');
    await expect.poll(() => f.sent()).toContain('refill');
    await button(page, 'Movies and shows, change').click();
    await expect(page.getByTestId('kinds-page')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Shows' }).click();
    await page.goBack();
    await expect(page.getByTestId('room-page')).toBeVisible();
    expect(f.sent()).not.toContain('configure');
    release();
    await expect.poll(() => f.room.shared.constraints.kinds).toEqual(['movie']);
    await expect(button(page, 'Movies, change')).toBeVisible();
    // Changed elsewhere after the save: the page follows the room.
    f.room.shared.constraints = { ...f.room.shared.constraints, kinds: ['movie', 'show_start'] };
    f.push();
    await backgroundAndBack(page);
    await button(page, 'Movies and shows, change').click();
    await expect(page.getByRole('checkbox', { name: 'Shows' })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('background refill', () => {
  test('Finding more keeps asking every 15 s even while the room keeps updating', async ({ page }) => {
    await page.clock.install();
    const room = choosingRoom();
    room.shared.stream = { version: 2, state: 'capacity', reason: 'room_capacity' };
    room.own.votes = room.shared.candidates.map((c) => ({ candidateId: c.id, value: 'pass', revision: 1, activeExposureMs: null, timingSource: 'unavailable' }));
    room.own.nextCandidateId = null;
    const f = await fakeRoom(page, room);
    await page.goto('/room/test-room');
    await expect(page.getByTestId('finding-more')).toBeVisible();
    expect(f.sent()).not.toContain('refill');
    // A live update every 5 s used to restart the 15 s timer, so it never fired.
    for (let i = 0; i < 4; i++) {
      await page.clock.runFor(5_000);
      await backgroundAndBack(page);
    }
    await expect.poll(() => f.sent().filter((t) => t === 'refill').length).toBeGreaterThanOrEqual(1);
  });

  test('a refill that doesn’t go through is tried again', async ({ page }) => {
    const f = await fakeRoom(page, choosingRoom());
    f.refuseRefills(1);
    await page.goto('/room/test-room');
    await expect(button(page, 'Yep')).toBeVisible();
    await expect.poll(() => f.sent().filter((t) => t === 'refill').length, { timeout: 10_000 }).toBe(2);
    await expect.poll(() => f.room.shared.stream.state).toBe('exhausted');
  });
});

test.describe('Continue with GoodWatch creates a room that still opens on Mood', () => {
  test('after the sign-in round trip (full page load back to the room)', async ({ page }) => {
    const f = await fakeRoom(page, newRoom(), { member: 'return' });
    await page.goto('/');
    await button(page, 'Continue with GoodWatch').click();
    await expect(page.getByLabel('Mood')).toBeVisible();
    await expect(page).toHaveURL(/\/room\/test-room\/mood/);
    expect(f.room.own.member.state).toBe('linked');
    await button(page, 'cheer me up').click();
    await expect(page.getByTestId('room-setup')).toBeVisible();
    // Opening the room again doesn't bring Mood back.
    await page.reload();
    await expect(page.getByTestId('room-setup')).toBeVisible();
    await expect(page.getByLabel('Mood')).toHaveCount(0);
  });

  test('when sign-in can’t start, Mood still opens', async ({ page }) => {
    await fakeRoom(page, newRoom());
    await page.goto('/');
    await button(page, 'Continue with GoodWatch').click();
    await expect(page.getByLabel('Mood')).toBeVisible();
    await expect(page).toHaveURL(/\/room\/test-room\/mood/);
  });
});

test.describe('NEW is acknowledged per room on the host’s device', () => {
  const withSuggestion = () => {
    const room = choosingRoom();
    room.shared.ideas.push({ id: 'i2', text: 'space adventure', authorId: 'mia', on: false, attributes: [] });
    return room;
  };

  test('opening the Room page acknowledges a friend’s idea, also after a reload', async ({ page }) => {
    await fakeRoom(page, withSuggestion());
    await page.goto('/room/test-room');
    await button(page, 'cheer me up, 1 new').click();
    await expect(page.getByTestId('room-page')).toBeVisible();
    await expect(page.getByText('NEW', { exact: true })).toBeVisible();
    await button(page, 'Back').click();
    await expect(button(page, 'cheer me up')).toBeVisible();
    await page.reload();
    await expect(button(page, 'cheer me up')).toBeVisible();
    await expect(button(page, 'cheer me up, 1 new')).toHaveCount(0);
  });

  test('an idea switched on and off again is not NEW again', async ({ page }) => {
    const f = await fakeRoom(page, withSuggestion());
    await page.goto('/room/test-room/room');
    const sw = page.getByRole('switch', { name: 'Use space adventure' });
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => f.room.shared.ideas.find((i) => i.id === 'i2')?.on).toBe(false);
    await expect(page.getByText('NEW', { exact: true })).toHaveCount(0);
    await button(page, 'Back').click();
    await expect(button(page, 'cheer me up')).toBeVisible();
  });
});

test('a command the server refuses (403) does not end the room', async ({ page }) => {
  const f = await fakeRoom(page, choosingRoom());
  let refused = 0;
  await page.route('**/api/yepwatch/v1/proposal/rooms/*/commands', async (route) => {
    if (refused++ > 0) return route.fallback();
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 'forbidden', message: 'Only the host can change this setting', retryable: false } }) });
  });
  await page.goto('/room/test-room');
  await expect.poll(() => refused).toBeGreaterThan(0);
  await expect(page.getByTestId('voting')).toBeVisible();
  await expect(page.getByText(/room access ended|room has expired/i)).toHaveCount(0);
  expect(f.room.shared.phase).toBe('choosing');
});
