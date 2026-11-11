/** Room notes float over the page: nothing moves when one comes or goes, and Dismiss hides it. */
import { expect, test } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

const setupRoom = () => { const room = choosingRoom(); room.shared.phase = 'setup'; return room; };

test('a note floats over the room without moving it, and Dismiss hides it', async ({ page }) => {
  await fakeRoom(page, setupRoom(), { interpretations: 24 });
  await page.goto('/room/test-room');
  const ideas = page.getByTestId('room-setup').getByTestId('idea-list');
  await expect(ideas).toBeVisible();
  const before = (await ideas.boundingBox())!;
  // A settings refusal belongs to the visible room; mood failures stay inside their editor.
  await page.route('**/commands', (route) => route.fulfill({status:409,json:{error:{code:'conflict',message:'Room settings changed',retryable:false},snapshot:setupRoom()}}));
  await page.getByRole('switch', { name: 'Use cheer me up' }).click();
  const note = page.getByTestId('room-note');
  await expect(note).toBeVisible();
  const after = (await ideas.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await note.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await expect(note).toHaveCount(0);
  expect(Math.abs((await ideas.boundingBox())!.y - before.y)).toBeLessThan(1);
});
