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
