import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

const button = (page: Page, name: string | RegExp) => page.getByRole('button', { name, exact: typeof name === 'string' });
const pill = (page: Page) => button(page, /switch room$/);

test.describe('a sheet over the voting card', () => {
  test('arrow keys never answer behind the Room sheet or Your rooms, and the time under a sheet is not exposure', async ({ page }) => {
    await page.clock.install();
    const f = await fakeRoom(page, choosingRoom());
    await page.goto('/room/test-room');
    await expect(page.getByTestId('voting')).toBeVisible();
    // The Room sheet (one of the room's own sheets) over the card.
    await pill(page).click();
    await button(page, /, Room page$/).click();
    await expect(page.getByTestId('room-sheet')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.clock.runFor(30_000);
    await page.getByTestId('room-sheet').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('room-sheet')).toHaveCount(0);
    // The header's Your rooms over the card.
    await pill(page).click();
    await expect(page.getByTestId('rooms-sheet')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await page.clock.runFor(30_000);
    await page.getByTestId('rooms-sheet').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('rooms-sheet')).toHaveCount(0);
    expect(f.sent()).not.toContain('vote');
    // Uncovered: the arrow answers, and the minute under the sheets isn't counted as looking at the card.
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => f.sent()).toContain('vote');
    const vote = f.commands.find((c) => c.command.type === 'vote')!.command as { value: string; activeExposureMs: number | null };
    expect(vote.value).toBe('watch');
    expect(vote.activeExposureMs).not.toBeNull();
    expect(vote.activeExposureMs!).toBeLessThan(30_000);
  });
});

test.describe('Back closes the sheet on top first; drafts are never lost', () => {
  test('browser Back and the header’s Back close sheets one at a time, saving the change, and stay on the page', async ({ page }) => {
    const room = choosingRoom();
    room.shared.matches = [{ candidateId: 'c2', averageYepMs: null }];
    const f = await fakeRoom(page, room);
    await page.goto('/room/test-room');
    await button(page, '1 match').click();
    await expect(page.getByTestId('matches')).toBeVisible();
    await pill(page).click();
    await button(page, /, Room page$/).click();
    await button(page, 'Movies and shows, change').click();
    await expect(page.getByTestId('kinds-sheet')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Shows' }).click();
    // Browser Back: Movies and shows closes (its change is saved), the Room sheet is back, still on Matches.
    await page.goBack();
    await expect(page.getByTestId('kinds-sheet')).toHaveCount(0);
    await expect(page.getByTestId('room-sheet')).toBeVisible();
    await expect.poll(() => f.room.shared.constraints.kinds).toEqual(['movie']);
    await expect(page.getByTestId('matches')).toBeVisible();
    // The header (inert under a modal sheet): a tap on it closes the Room sheet, Matches stays.
    await page.getByTestId('header-shade').click();
    await expect(page.getByTestId('room-sheet')).toHaveCount(0);
    await expect(page.getByTestId('matches')).toBeVisible();
    // Your rooms is a sheet too.
    await pill(page).click();
    await expect(page.getByTestId('rooms-sheet')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('rooms-sheet')).toHaveCount(0);
    await expect(page.getByTestId('matches')).toBeVisible();
    // No sheet: Back leaves the page as before.
    await page.goBack();
    await expect(page.getByTestId('voting')).toBeVisible();
  });

  test('a change still waiting to be saved goes out after the room is left', async ({ page }) => {
    const room = choosingRoom();
    room.shared.phase = 'setup';
    const f = await fakeRoom(page, room);
    const release = f.hold('start');
    await page.goto('/room/test-room');
    // Start is with the server: settings changes wait for it. The room's details rest while it starts;
    // the Room sheet still opens.
    await button(page, 'Start').click();
    await expect.poll(() => f.sent()).toContain('start');
    await button(page, 'Room').click();
    await button(page, 'Movies and shows, change').click();
    await page.getByRole('checkbox', { name: 'Shows' }).click();
    // A tap on the header closes the sheets one at a time (the change waits behind Start), then Back leaves
    // the room before the change went out.
    await page.getByTestId('header-shade').click();
    await expect(page.getByTestId('kinds-sheet')).toHaveCount(0);
    await page.getByTestId('header-shade').click();
    await expect(page.getByTestId('room-sheet')).toHaveCount(0);
    expect(f.sent()).not.toContain('configure');
    await button(page, 'Back').click();
    await expect(page.getByTestId('room-setup')).toHaveCount(0);
    // The room is gone from the screen; its change still goes once Start is answered.
    release();
    await expect.poll(() => f.room.shared.constraints.kinds).toEqual(['movie']);
    expect(f.sent().filter((t) => t === 'configure')).toHaveLength(1);
  });

  test('leaving that isn’t a Back still goes with a sheet open (removed from the room)', async ({ page }) => {
    const f = await fakeRoom(page, choosingRoom());
    await page.goto('/room/test-room/room');
    await expect(page.getByTestId('room-sheet')).toBeVisible();
    f.room.own.left = true;
    f.push();
    await page.evaluate(() => {
      for (const state of ['hidden', 'visible']) {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    await expect(page).toHaveURL(/127\.0\.0\.1:8097\/?$/);
    await expect(page.getByTestId('room-sheet')).toHaveCount(0);
  });
});

test('Yep A, then Yep B before A is answered: A’s match still plays MATCH', async ({ page }) => {
  const f = await fakeRoom(page, choosingRoom());
  const release = f.hold('vote');
  await page.goto('/room/test-room');
  await expect(page.getByTestId('voting')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => f.sent()).toContain('vote');
  // The next card is already there: Yep it too while the first is still with the server.
  await expect(async () => {
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('finding-more')).toBeVisible({ timeout: 300 });
  }).toPass();
  expect(f.sent().filter((t) => t === 'vote')).toHaveLength(1);
  // Mia had said Yep to the first card: the server answers it as a match.
  f.room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  release();
  await expect(page.getByTestId('match-moment')).toHaveCount(1);
  await expect.poll(() => f.sent().filter((t) => t === 'vote')).toHaveLength(2);
});
