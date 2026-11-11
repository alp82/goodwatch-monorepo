import { test, expect } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

test('a signed-in member can save their name for future rooms', async ({ page }) => {
  await fakeRoom(page, choosingRoom(), { member: 'signed-in' });
  await page.goto('/?open=profile');
  const profile = page.getByTestId('profile-panel');
  await expect(profile.getByLabel('Your name')).toHaveValue('Alex');
  await profile.getByLabel('Your name').fill('Sam');
  await profile.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(profile).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('yepwatch.v3.profile') ?? '{}').nickname)).toBe('Sam');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(profile.getByLabel('Your name')).toHaveValue('Sam');
  await page.reload();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(profile.getByLabel('Your name')).toHaveValue('Sam');
  await profile.getByRole('button', { name: 'Close', exact: true }).click();
  const created = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/proposal/rooms'));
  await page.getByRole('button', { name: 'New room', exact: true }).click();
  await page.getByRole('button', { name: 'Anything goes', exact: true }).click();
  expect((await created).postDataJSON().nickname).toBe('Sam');
});

test('a signed-in browser with empty device storage discovers its hosted room and durable server history', async ({ page }) => {
  const room = choosingRoom();
  room.shared.participants[0].nickname = 'Alex';
  room.own.member = { state: 'linked', prefill: { country: 'DE', serviceIds: [8], savedProgressAvailable: false } };
  await fakeRoom(page, room, { member: 'signed-in', history: [{ id: 'expired-room:1:100', roomId: 'expired-room', roomLabel: 'Last week', title: 'A previous choice', year: 2020, posterUrl: null, decidedAt: Date.now() - 86400000, people: ['Alex', 'Sam'] }] });
  const resumes: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/resume')) resumes.push(request.url()); });
  await page.goto('/');
  await expect(page.getByTestId('home-rooms')).toBeVisible();
  const label = room.shared.ideas.filter(i => i.on).map(i => i.text).join(' + ') || 'Anything';
  await expect(page.getByTestId('home-rooms').getByRole('button', { name: label, exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Decided, 1, open History/ }).click();
  await expect(page.getByTestId('history-panel')).toContainText('A previous choice');
  await page.getByTestId('history-panel').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByTestId('home-rooms').getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
  expect(resumes.length).toBeGreaterThan(0);
  const routing = await page.evaluate(() => JSON.parse(sessionStorage.getItem('yepwatch.room.test-room') ?? '{}'));
  expect(routing.participantId).toBe(room.own.participantId);
  expect(routing.token).toBe('');
  expect(routing.sessionKey).toBe('account-session');
});

test('logging out removes the account room list and history from this browser', async ({ page }) => {
  const room = choosingRoom();
  room.own.member = { state: 'linked', prefill: { country: 'DE', serviceIds: [8], savedProgressAvailable: false } };
  await fakeRoom(page, room, { member: 'signed-in', history: [{ id: 'old:1:100', roomId: 'old', roomLabel: 'Private room', title: 'Private past choice', year: null, posterUrl: null, decidedAt: Date.now() - 86400000, people: ['Alex'] }] });
  await page.goto('/?open=profile');
  await expect(page.getByText('Signed in with GoodWatch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with GoodWatch', exact: true })).toBeVisible();
  await page.getByTestId('profile-panel').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: /Decided, 1/ })).toHaveCount(0);
  await expect(page.getByText('Private past choice', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('home-rooms').getByRole('button', { name: 'Anything', exact: true })).toHaveCount(0);
});

test('server history remains visible without an active room or a GoodWatch display name', async ({ page }) => {
  const { newRoom } = await import('./room-fake');
  await fakeRoom(page, newRoom(), { member: 'signed-in', accountName: null, history: [{ id: 'past:1:100', roomId: 'past', roomLabel: 'A past room', title: 'Our saved choice', year: null, posterUrl: null, decidedAt: Date.now() - 86400000, people: ['A friend'] }] });
  await page.goto('/');
  await page.getByRole('button', { name: /Decided, 1, open History/ }).click();
  await expect(page.getByTestId('history-panel')).toContainText('Our saved choice');
});
