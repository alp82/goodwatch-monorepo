import { expect, test } from '@playwright/test';
import { fakeRoom, newRoom, setUpDevice } from './room-fake';

for (const width of [390, 1440]) test(`New couch makes one couch without an idea and opens its setup at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const f = await fakeRoom(page, newRoom());
  let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().split('?')[0].endsWith('/proposal/rooms')) posts++; });
  await setUpDevice(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'New couch', exact: true }).click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page.getByLabel('Describe what you want to watch').filter({ visible: true })).toBeVisible();
  await page.waitForTimeout(200);
  expect(posts).toBe(1);
  expect(f.sent().includes('add_idea')).toBe(false);
  expect(f.room.shared.ideas).toEqual([]);
});

test('a refused mood save keeps its text in the editor and explains the mood failure', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/commands(\?|$)/, async (route) => {
    if (route.request().postDataJSON().command.type !== 'add_idea') return route.fallback();
    await gate;
    return route.fulfill({ status: 503, json: { error: { code: 'catalog_unavailable', message: 'Mood matching is unavailable for now. You can still start without an idea.', retryable: false } } });
  });
  await page.goto('/room/test-room/mood?idea=new');
  const mood = page.getByLabel('Mood', { exact: true });
  await mood.fill('dark and funny');
  await expect(page.getByRole('button', { name: 'Create couch', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Create couch', exact: true }).click();
  try {
    await expect(mood).toBeVisible();
    await expect(mood).toHaveValue('dark and funny');
  } finally { release(); }
  await expect(page.getByText('Couldn’t save this mood. Try again; your text is kept.', { exact: true })).toBeVisible();
  await expect(mood).toHaveValue('dark and funny');
  await expect(page.getByTestId('room-setup')).toHaveCount(0);
  expect(f.room.shared.ideas).toEqual([]);
});


test('an uncertain existing-room mood reconciles its exact write before saving revised text', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  let lose = true;
  await page.route(/\/commands(\?|$)/, async (route) => {
    if (route.request().postDataJSON().command.type === 'add_idea' && lose) { lose = false; f.lose(); }
    await route.fallback();
  });
  await page.goto('/room/test-room/mood?idea=new');
  await page.getByLabel('Mood').fill('dark and funny');
  await page.getByRole('button', { name: 'Create couch', exact: true }).click();
  await expect(page.getByText('Couldn’t save this mood. Try again; your text is kept.', { exact: true })).toBeVisible();
  await page.getByLabel('Mood').fill('rainy day mystery');
  const retry = page.getByRole('button', { name: 'Try again', exact: true });
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  expect(f.room.shared.ideas.map((i) => i.text)).toEqual(['rainy day mystery']);
  const adds = f.commands.filter((c) => c.command.type === 'add_idea');
  expect(adds).toHaveLength(2);
  expect(adds[1]).toEqual(adds[0]);
  expect(f.sent().filter((c) => c === 'edit_idea')).toHaveLength(1);
});

test('a completed save cannot pull someone back after they leave the editor and room', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  const release = f.hold('add_idea');
  await page.goto('/room/test-room');
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await page.goto('/room/test-room/mood?idea=new');
  await page.getByLabel('Mood').fill('dark and funny');
  await page.getByRole('button', { name: 'Create couch', exact: true }).click();
  await expect.poll(() => f.sent().includes('add_idea')).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  release();
  await expect.poll(() => f.room.shared.ideas.length).toBe(1);
  await page.waitForTimeout(200);
  await expect(page).toHaveURL(/\/$/);
});

test('an idea from the console whose acknowledgement is lost goes again as the exact command, then the field replaces it', async ({ page }) => {
  // Owner rule Q16b on the couch setup's describe field: the same command again, never a second idea.
  const f = await fakeRoom(page, newRoom());
  let lose = true;
  await page.route(/\/commands(\?|$)/, async (route) => {
    if (route.request().postDataJSON().command.type === 'add_idea' && lose) { lose = false; f.lose(); }
    await route.fallback();
  });
  await page.goto('/room/test-room');
  const field = page.getByLabel('Describe what you want to watch');
  await field.fill('dark and funny');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // The answer was lost: the field keeps the words and says so (as the Mood page does). The press again
  // sends the saved command, never a second add.
  await expect(page.getByText('Couldn’t save this mood. Try again; your text is kept.', { exact: true })).toBeVisible();
  await expect(field).toHaveValue('dark and funny');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'dark and funny. Your idea', exact: true })).toBeVisible();
  await expect(field).toHaveValue('');
  await expect(field).toHaveAttribute('placeholder', 'Replace your idea');
  const adds = f.commands.filter((c) => c.command.type === 'add_idea');
  expect(adds.length).toBeGreaterThanOrEqual(1);
  expect(adds.every((c) => JSON.stringify(c) === JSON.stringify(adds[0]))).toBe(true);
  expect(f.room.shared.ideas).toHaveLength(1);
  // A second idea from the same person replaces the first one: edit_idea, never another add.
  await field.fill('rainy day mystery');
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect.poll(() => f.room.shared.ideas.map((i) => i.text)).toEqual(['rainy day mystery']);
  expect(f.sent().filter((c) => c === 'edit_idea')).toHaveLength(1);
});

test('an uncertain console idea reconciles its exact write before a replacement goes', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  let lose = true;
  await page.route(/\/commands(\?|$)/, async (route) => {
    if (route.request().postDataJSON().command.type === 'add_idea' && lose) { lose = false; f.lose(); }
    await route.fallback();
  });
  await page.goto('/room/test-room');
  const field = page.getByLabel('Describe what you want to watch');
  await field.fill('dark and funny');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  // Either the outbox already resent it (the idea shows) or the field says so and keeps the words.
  await expect.poll(async () => (await field.inputValue()) === '' || await page.getByText('Couldn’t save this mood. Try again; your text is kept.', { exact: true }).isVisible()).toBe(true);
  await field.fill('rainy day mystery');
  await page.getByRole('button', { name: /^(Add|Replace)$/ }).click();
  await expect.poll(() => f.room.shared.ideas.map((i) => i.text)).toEqual(['rainy day mystery']);
  const adds = f.commands.filter((c) => c.command.type === 'add_idea');
  expect(new Set(adds.map((c) => c.commandId)).size).toBe(1);
  expect(f.sent().filter((c) => c === 'edit_idea')).toHaveLength(1);
});
