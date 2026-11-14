import { expect, test } from '@playwright/test';
import { fakeRoom, newRoom } from './room-fake';

for (const width of [390, 1440]) test(`choosing a mood is local and keeps the same editor at ${width}px`, async ({ page }) => {
  await page.setViewportSize({width, height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  const f = await fakeRoom(page, newRoom());
  let posts = 0;
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().endsWith('/proposal/rooms')) posts++; });
  const release = f.hold('add_idea');
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  const mood = page.getByLabel('Mood', { exact: true });
  await mood.fill('dark and funny');
  await page.waitForTimeout(100);
  expect(posts).toBe(0);
  await page.evaluate(() => {
    const probe = { watching: true, blank: 0, frames: 0, field: document.querySelector('[aria-label="Mood"]') };
    (window as unknown as { moodFrames: typeof probe }).moodFrames = probe;
    const frame = () => {
      if (!probe.watching) return;
      probe.frames++;
      if (!probe.field?.isConnected || probe.field.getBoundingClientRect().height === 0) probe.blank++;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect.poll(() => f.sent().includes('add_idea')).toBe(true);
  await page.waitForTimeout(200);
  const frames = await page.evaluate(() => {
    const probe = (window as unknown as { moodFrames: { watching: boolean; blank: number; frames: number } }).moodFrames;
    probe.watching = false;
    return { frames: probe.frames, blank: probe.blank };
  });
  expect(frames.frames).toBeGreaterThan(0);
  expect(frames.blank).toBe(0);
  await expect(mood).toHaveValue('dark and funny');
  release();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page.getByRole('button', { name: 'dark and funny, edit', exact: true })).toBeVisible();
  expect(posts).toBe(1);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.evaluate(() => {
    const values: string[] = [];
    (window as unknown as { nextDraftValues: string[] }).nextDraftValues = values;
    const frame = () => {
      const field = document.querySelector<HTMLTextAreaElement>('[aria-label="Mood"]');
      if (field && field.getBoundingClientRect().height > 0) values.push(field.value);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await expect(page.getByLabel('Mood', { exact: true })).toHaveValue('');
  await page.waitForTimeout(200);
  const values = await page.evaluate(() => (window as unknown as { nextDraftValues: string[] }).nextDraftValues);
  expect(values.length).toBeGreaterThan(0);
  expect(values.every((v) => v === '')).toBe(true);
  expect(posts).toBe(1);
});

test('a failed create-and-save keeps the draft and retries in the same room', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  let rooms = 0, saves = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/proposal/rooms')) rooms++; });
  await page.route('**/commands', async (route) => {
    if (route.request().postDataJSON().command.type !== 'add_idea' || saves++ > 0) return route.fallback();
    return route.fulfill({ status: 503, json: { error: { code: 'catalog_unavailable', message: 'Mood matching is unavailable', retryable: false } } });
  });
  await page.goto('/new');
  await page.getByLabel('Mood', { exact: true }).fill('dark and funny');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByText('Couldn’t save this mood. Try again; your text is kept.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mood', { exact: true })).toHaveValue('dark and funny');
  await expect(page.getByTestId('room-setup')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Anything, switch room/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  expect(rooms).toBe(1);
  expect(f.room.shared.ideas.map((i) => i.text)).toEqual(['dark and funny']);
});

test('an accepted mood whose acknowledgement is lost goes again by itself as the exact command, without another idea', async ({ page }) => {
  // Owner rule Q16b: a save with no answer keeps going by itself while the page is in front, the same command.
  const f = await fakeRoom(page, newRoom());
  let rooms = 0, lose = true;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/proposal/rooms')) rooms++; });
  await page.route('**/commands', async (route) => {
    if (route.request().postDataJSON().command.type === 'add_idea' && lose) { lose = false; f.lose(); }
    await route.fallback();
  });
  await page.goto('/new');
  await page.getByLabel('Mood', { exact: true }).fill('dark and funny');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  await expect(page.getByTestId('room-setup')).toBeVisible();
  await expect(page.getByText('Couldn’t reach YepWatch. Your request is saved. Try again.', { exact: true })).toHaveCount(0);
  const commands = f.commands.filter((c) => c.command.type === 'add_idea');
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(rooms).toBe(1); // The room was made once; only the idea command goes again.
  expect(f.room.shared.ideas).toHaveLength(1);
});

test('cancelling a local draft returns to its caller without allocating a room', async ({ page }) => {
  await fakeRoom(page, newRoom());
  let rooms = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/proposal/rooms')) rooms++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await page.getByLabel('Mood', { exact: true }).fill('unfinished mood');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(rooms).toBe(0);
});

test('a refused mood save keeps its text in the editor and explains the mood failure', async ({ page }) => {
  const f = await fakeRoom(page, newRoom());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/commands', async (route) => {
    if (route.request().postDataJSON().command.type !== 'add_idea') return route.fallback();
    await gate;
    return route.fulfill({ status: 503, json: { error: { code: 'catalog_unavailable', message: 'Mood matching is unavailable for now. You can still start without an idea.', retryable: false } } });
  });
  await page.goto('/room/test-room/mood?idea=new');
  const mood = page.getByLabel('Mood', { exact: true });
  await mood.fill('dark and funny');
  await expect(page.getByRole('button', { name: 'Create room', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
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
  await page.route('**/commands', async (route) => {
    if (route.request().postDataJSON().command.type === 'add_idea' && lose) { lose = false; f.lose(); }
    await route.fallback();
  });
  await page.goto('/room/test-room/mood?idea=new');
  await page.getByLabel('Mood').fill('dark and funny');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
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
  await page.getByRole('button', { name: 'Add an idea', exact: true }).click();
  await page.getByLabel('Mood').fill('dark and funny');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
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
