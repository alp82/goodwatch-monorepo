/**
 * Polish round: the join screen in the room screens' style, title details with GoodWatch highlights,
 * scores in the website's look, Watch on links, no Cheer button on Tonight.
 */
import { expect, test, type Page } from '@playwright/test';
import { choosingRoom, fakeRoom } from './room-fake';

const shot = (page: Page, name: string) => page.screenshot({ path: `artifacts/polish/after-${name}.png` });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** The fake's first card on Netflix (direct) and Disney+ (fallback page), both brought by someone. */
function room() {
  const r = choosingRoom();
  Object.assign(r.shared.candidates[0], {
    title: 'The Grand Budapest Hotel', year: 2014,
    overview: 'A writer encounters the owner of an aging high-class hotel, who tells him of his early years serving as a lobby boy.',
    availability: [{ screenId: 'room', state: 'watchable', scope: 'title', checkedAt: 1, offers: [
      { serviceId: 337, name: 'Disney Plus', kind: 'where_to_watch', url: 'https://www.themoviedb.org/movie/120467/watch?locale=DE', offerType: 'flatrate' },
      { serviceId: 8, name: 'Netflix', kind: 'provider', url: 'https://www.netflix.com/title/1', offerType: 'flatrate' },
    ] }],
  });
  r.shared.participants[0].serviceIds = [8, 337];
  return r;
}

async function openInvite(page: Page) {
  const r = choosingRoom();
  r.shared.phase = 'setup';
  const f = await fakeRoom(page, r);
  await page.route('**/proposal/rooms/test-room', (route) => (f.room.shared.participants.some((p) => p.participantId === 'guest')
    ? route.fallback()
    : route.fulfill({ status: 401, json: { error: { code: 'unauthorized', message: 'Not a member yet', retryable: false } } })));
  await page.goto('/r/K7QX');
  return f;
}

test('the join screen is a room screen: Back, the room as the headline, name and Join; no start page underneath', async ({ page }) => {
  const f = await openInvite(page);
  const screen = page.getByTestId('join-screen');
  await expect(screen.getByTestId('invite-head').getByText('ALP’S ROOM')).toBeVisible();
  // One short idea is the hero headline.
  const idea = screen.getByTestId('invite-ideas').getByText('cheer me up');
  expect(await idea.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(40);
  await expect(screen.getByLabel('Your name')).toBeVisible();
  await expect(button(page, 'Continue with GoodWatch')).toBeVisible();
  // The old panel shell and the start page are gone.
  await expect(page.getByTestId('subheader')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create a room', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Back to / })).toHaveCount(0);
  await expect(button(page, 'Join')).toBeDisabled();
  await shot(page, 'join-phone');
  await page.getByLabel('Your name').fill('Sam');
  await button(page, 'Join').click();
  await expect(page.getByTestId('services-page')).toBeVisible();
  expect(f.room.shared.participants.find((p) => p.participantId === 'guest')?.nickname).toBe('Sam');
});

test('the join screen on a desktop window: one centered column, no dark box', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openInvite(page);
  const field = page.getByLabel('Your name');
  await expect(field).toBeVisible();
  const box = (await field.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(560);
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(4);
  await shot(page, 'join-desktop');
  // Back returns to the start page.
  await button(page, 'Back').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Create a room', exact: true })).toBeVisible();
});

test('details show GoodWatch highlights: scores, fingerprint chips, credits, age rating, tagline; Watch on every service', async ({ page }) => {
  await fakeRoom(page, room());
  await page.goto('/room/test-room');
  await expect(page.getByTestId('voting')).toBeVisible();
  // The card's score pill in the GoodWatch score color.
  const pill = page.getByTestId('poster').getByLabel('GoodWatch score 84');
  await expect(pill).toBeVisible();
  await shot(page, 'card');
  await page.getByTestId('poster').click({ position: { x: 20, y: 20 } });
  const d = page.getByTestId('details-panel');
  await expect(d).toBeVisible();
  await expect(d.getByLabel('GoodWatch score 84 of 100, Great')).toBeVisible();
  await expect(d.getByText('Great', { exact: true })).toHaveCSS('color', 'rgb(22, 147, 74)');
  await expect(d.getByLabel('IMDb 8.1')).toHaveText('8.1');
  await expect(d.getByLabel('Metacritic 88')).toHaveText('88');
  await expect(d.getByLabel('Rotten Tomatoes: critics 92%, audience 86%')).toBeVisible();
  await expect(d.getByTestId('details-highlights').locator('> *')).toHaveText(['Wit & Wordplay', 'Visual Stylization', 'Eccentricity']);
  await expect(d.getByText('Wit & Wordplay')).toHaveCSS('color', 'rgb(3, 7, 18)');
  await expect(d.getByTestId('certification')).toHaveText('FSK 12');
  await expect(d.getByText('A perfect holiday without leaving the lobby.')).toBeVisible();
  await expect(d.getByTestId('details-people')).toContainText(/Director\s+Wes Anderson/);
  await expect(d.getByTestId('details-people')).toContainText('Ralph Fiennes, Tony Revolori, Saoirse Ronan');
  await expect(d.getByRole('link', { name: 'Watch on Netflix' })).toHaveAttribute('href', 'https://www.netflix.com/title/1');
  await expect(d.getByRole('link', { name: 'Watch on Disney+' })).toHaveAttribute('href', 'https://www.themoviedb.org/movie/120467/watch?locale=DE');
  await expect(d.getByText('Watch on Disney+', { exact: true })).toBeVisible();
  await expect(d.getByText(/Find on|Availability page/)).toHaveCount(0);
  await shot(page, 'details');
  await d.getByRole('link', { name: 'Full details on GoodWatch' }).scrollIntoViewIfNeeded();
  await shot(page, 'details-bottom');
});

test('details hide every part whose data is missing', async ({ page }) => {
  const r = choosingRoom();
  r.own.votes = [{ candidateId: 'c1', value: 'pass', revision: 1, activeExposureMs: null, timingSource: 'unavailable' }];
  r.own.nextCandidateId = 'c2';
  await fakeRoom(page, r);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('poster')).toBeVisible();
  await expect(page.getByTestId('poster').getByTestId('score-pill')).toHaveCount(0);
  await page.getByTestId('poster').click({ position: { x: 20, y: 20 } });
  const d = page.getByTestId('details-panel');
  await expect(d.getByText('Isolated test c2')).toBeVisible();
  for (const id of ['details-scores', 'details-highlights', 'details-people', 'certification', 'score-ring', 'source-scores']) await expect(d.getByTestId(id)).toHaveCount(0);
  await expect(d.getByText('No synopsis')).toHaveCount(0);
  await expect(d.getByRole('link', { name: 'Full details on GoodWatch' })).toBeVisible();
  await shot(page, 'details-bare');
});

test('matches show the score pill', async ({ page }) => {
  const r = room();
  r.shared.matches = [{ candidateId: 'c1', averageYepMs: null }, { candidateId: 'c2', averageYepMs: null }];
  await fakeRoom(page, r);
  await page.goto('/room/test-room/matches');
  await expect(page.getByTestId('matches')).toBeVisible();
  await expect(page.getByTestId('matches').getByLabel('GoodWatch score 84')).toBeVisible();
  await expect(page.getByTestId('matches').getByTestId('score-pill')).toHaveCount(1);
  await shot(page, 'matches');
});

test('Tonight: scores and Watch on, cheering only on the poster', async ({ page }) => {
  const r = room();
  r.shared.phase = 'decided';
  r.shared.decision = { candidateId: 'c1', proposalVersion: 1, decidedAt: Date.now() - 3_600_000, availability: r.shared.candidates[0].availability } as unknown as typeof r.shared.decision;
  // Disney+ comes first in the offers: its fallback page still reads Watch on.
  await fakeRoom(page, r);
  await page.goto('/room/test-room');
  await expect(page.getByTestId('tonight')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Watch on Disney+' })).toBeVisible();
  await expect(page.getByText('Watch on Disney+', { exact: true })).toBeVisible();
  await expect(button(page, 'Cheer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cheer for The Grand Budapest Hotel', exact: true })).toBeVisible();
  await expect(page.getByTestId('tonight-scores').getByLabel('Rotten Tomatoes: critics 92%, audience 86%')).toBeVisible();
  await shot(page, 'tonight');
});
