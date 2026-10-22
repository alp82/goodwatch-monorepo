import { expect, test, type Page } from '@playwright/test';
import type { CommandEnvelope, RoomSnapshot } from '@goodwatch/yepwatch-contracts/continuous';
import { continuousFixture } from '../continuous-fixture';

async function fixture(page: Page, setupGuest = false) {
  const room: RoomSnapshot = continuousFixture();
  room.shared.candidates[1].title = 'Hidden shared title';
  room.shared.candidates.push({
    ...room.shared.candidates[1],
    id: 'c3',
    identity: { kind: 'movie', tmdbId: 3 },
    title: 'Another hidden match',
  });
  room.shared.matches = [
    { candidateId: 'c2', pickCount: 0 },
    { candidateId: 'c3', pickCount: 0 },
  ];
  room.shared.stream = { state: 'exhausted', version: 1, reason: 'catalog_end' };
  if (setupGuest) {
    room.shared.phase = 'setup';
    room.own.canHost = false;
    room.shared.participants[0].screenId = null;
    room.shared.participants[0].ready = false;
  }
  const commands: CommandEnvelope[] = [];
  let loseNext = false;
  const receipts = new Set<string>();
  await page.route('**/api/yepwatch/v1/continuous/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/catalog/metadata')) return route.fulfill({json: {countries: [{code: 'DE', name: 'Germany'}], services: [{id: 8, name: 'Netflix', logoUrl: null}], moods: [{id: 'relaxed', label: 'Relaxed'}]}});
    if (url.pathname.endsWith('/member/start'))
      return route.fulfill({
        status: 501,
        json: {
          error: {
            code: 'not_implemented',
            message: 'Member issuer unavailable',
            retryable: false,
          },
        },
      });
    if (url.pathname.endsWith('/realtime-ticket'))
      return route.fulfill({
        status: 501,
        json: {
          error: {
            code: 'not_implemented',
            message: 'Isolated component fixture has no realtime transport.',
            retryable: false,
          },
        },
      });
    if (url.pathname.endsWith('/commands')) {
      const body = route.request().postDataJSON() as CommandEnvelope;
      commands.push(body);
      if (!receipts.has(body.commandId)) {
        receipts.add(body.commandId);
        const c = body.command;
        room.shared.revision++;
        room.own.nextSequence++;
        if (c.type === 'vote') {
          const old = room.own.votes.find((v) => v.candidateId === c.candidateId);
          room.own.votes = room.own.votes.filter((v) => v.candidateId !== c.candidateId);
          room.own.votes.push({
            candidateId: c.candidateId,
            value: c.value,
            revision: (old?.revision ?? 0) + 1,
          });
          room.own.nextCandidateId =
            room.shared.candidates.find(
              (c) => !room.own.votes.some((v) => v.candidateId === c.id && v.value !== null)
            )?.id ?? null;
        }
        if (c.type === 'setup') { room.shared.screens = c.screens; room.shared.constraints = c.constraints; room.shared.contextVersion++; }
        if (c.type === 'assign_screen') {
          room.shared.contextVersion++;
          room.shared.participants[0].screenId = c.screenId;
        }
        if (c.type === 'ready') {
          if (c.expectedContextVersion !== room.shared.contextVersion)
            return route.fulfill({
              status: 409,
              json: {
                error: { code: 'conflict', message: 'State version changed', retryable: false },
                snapshot: room,
              },
            });
          room.shared.participants[0].ready = c.ready;
        }
        if (c.type === 'pick')
          room.own.pick = { candidateId: c.candidateId, revision: room.own.pick.revision + 1 };
      }
      if (loseNext) {
        loseNext = false;
        return route.abort();
      }
      return route.fulfill({ json: { receipt: {}, snapshot: room } });
    }
    return route.fulfill({ json: room });
  });
  await page.goto('/room/test-room');
  await page
    .getByRole('button', { name: setupGuest ? 'Ready to watch' : 'Yep', exact: true })
    .waitFor();
  return {
    room,
    commands,
    lose: () => {
      loseNext = true;
    },
  };
}
for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
])
  test(`Glow fits ${viewport.width}x${viewport.height}, binary controls and spoiler rail`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await fixture(page);
    await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeVisible();
    await expect(page.getByText('Hidden shared title', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /veto|complete round|finish round/i })
    ).toHaveCount(0);
    const bounds = await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    expect(bounds.scrollHeight).toBeLessThanOrEqual(bounds.height);
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width);
    const poster = await page.getByTestId('poster').boundingBox();
    const no = await page.getByRole('button', { name: 'Nope', exact: true }).boundingBox();
    expect(poster!.height).toBeGreaterThan(200);
    expect(no!.y + no!.height).toBeLessThanOrEqual(viewport.height);
  });
test('inspection, replacement pick and Keep voting preserve own card; no local unilateral Done', async ({
  page,
}) => {
  const f = await fixture(page);
  const initial = await page.getByTestId('poster').innerText();
  await page.getByRole('button', { name: 'Inspect 2 matches', exact: true }).click();
  await page.getByRole('button', { name: 'Pick this', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Picked', exact: true })).toBeVisible();
  await expect(
    page.getByText('Everyone picked it. Enjoy your watch.', { exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Next match', exact: true }).click();
  await page.getByRole('button', { name: 'Pick this', exact: true }).click();
  expect(
    f.commands
      .filter((c) => c.command.type === 'pick')
      .map((c) => c.command.type === 'pick' && c.command.candidateId)
  ).toEqual(['c2', 'c3']);
  await page.getByRole('button', { name: 'Keep voting', exact: true }).click();
  await expect.poll(() => page.getByTestId('poster').innerText()).toBe(initial);
});
test('left swipe after reversal sends exactly the same pass as Nope and recenters', async ({
  page,
}) => {
  const f = await fixture(page);
  const box = (await page.getByTestId('poster').boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height * 0.45;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 90, y, { steps: 6 });
  await page.mouse.move(x - 100, y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => f.commands.filter((c) => c.command.type === 'vote').length).toBe(1);
  const first = f.commands.find((c) => c.command.type === 'vote')!;
  expect(first.command).toMatchObject({ value: 'pass', candidateId: 'c1' });
  await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Nope', exact: true }).click();
  expect(
    f.commands
      .filter((c) => c.command.type === 'vote')
      .map((c) => c.command.type === 'vote' && c.command.value)
  ).toEqual(['pass', 'pass']);
  const centered = await page.getByTestId('poster').boundingBox();
  expect(Math.abs(centered!.x - box.x)).toBeLessThan(2);
});
test('lost command response persists exact envelope over reload and blocks new gestures until reconciliation', async ({
  page,
}) => {
  const f = await fixture(page);
  f.lose();
  await page.getByRole('button', { name: 'Yep', exact: true }).click();
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).waitFor();
  await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeEnabled();
  expect(f.commands).toHaveLength(2);
  expect(f.commands[1]).toEqual(f.commands[0]);
});
test('authoritative expiry is terminal and a delayed room response cannot resurrect controls', async ({
  page,
}) => {
  const f = await fixture(page);
  f.room.shared.phase = 'expired';
  await page.getByRole('button', { name: 'Refresh room', exact: true }).click();
  await expect(page.getByText('This room has expired', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh room', exact: true })).toHaveCount(0);
});

test('one explicit guest readiness uses the confirmed screen assignment fence', async ({
  page,
}) => {
  const f = await fixture(page, true);
  await page.getByRole('button', { name: 'Ready to watch', exact: true }).click();
  await expect(
    page.getByText('You’re ready. Waiting for the host.', { exact: true })
  ).toBeVisible();
  expect(f.commands.map((e) => e.command.type)).toEqual(['assign_screen', 'ready']);
  expect(f.commands[1].command).toMatchObject({ expectedContextVersion: 2 });
});

test('unavailable account start stays an honest guest state inside the room drawer', async ({
  page,
}) => {
  await fixture(page);
  await page.getByRole('button', { name: 'Open room', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in with GoodWatch', exact: true }).click();
  await expect(
    page
      .getByText(
        'GoodWatch sign-in is not connected yet. Your guest place is saved; account services and progress have not been imported.',
        { exact: true }
      )
      .last()
  ).toBeVisible();
  await expect(page.getByText('GoodWatch connected', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close panel', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled();
});

test('the creator invitation survives a full navigation/reload without bearer storage', async ({
  page,
}) => {
  await fixture(page);
  await page.evaluate(() =>
    sessionStorage.setItem(
      'yepwatch.v2.invite.test-room',
      JSON.stringify({ code: 'isolated-invite', path: '/r/isolated-invite' })
    )
  );
  await page.reload();
  await page.getByRole('button', { name: 'Open room', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share invitation', exact: true })).toBeEnabled();
  await expect(
    page.getByText('http://127.0.0.1:8097/r/isolated-invite', { exact: true })
  ).toBeVisible();
});

for (const error of [101, 150])
  test(`embedding refusal ${error} offers YouTube and closing preserves card and pick`, async ({ page }) => {
    const f = await fixture(page);
    f.room.shared.candidates[0].trailerUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    f.room.own.pick = { candidateId: 'c2', revision: 1 };
    // Isolated player fixture: external playback evidence is recorded separately against real URLs.
    await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({
      contentType: 'application/javascript',
      body: `window.YT={Player:function(id,options){const p={getPlayerState:()=>-1,isMuted:()=>false,getVolume:()=>100,playVideo:()=>{},unMute:()=>{},setVolume:()=>{}};setTimeout(()=>{options.events.onReady();options.events.onError({data:${error}})},0);return p}};onYouTubeIframeAPIReady();`,
    }));
    await page.reload();
    const card = await page.getByTestId('poster').innerText();
    await page.getByRole('button', { name: 'Watch trailer', exact: true }).click();
    await expect(page.getByText('This trailer cannot play inside the app. Watch it on YouTube.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Watch on YouTube', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play with sound', exact: true })).toHaveCount(0);
    // At least two periodic reports later the refusal remains actionable.
    await page.waitForTimeout(1600);
    await expect(page.getByRole('button', { name: 'Play with sound', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Close panel', exact: true }).last().click();
    await expect.poll(() => page.getByTestId('poster').innerText()).toBe(card);
    expect(f.commands).toHaveLength(0);
    await page.getByRole('button', { name: 'Inspect 2 matches', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Picked', exact: true })).toBeVisible();
  });

test('authoritative Undo survives an accepted vote followed by a full reload', async ({ page }) => {
  const f = await fixture(page);
  await page.getByRole('button', { name: 'Nope', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo last choice', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Undo last choice', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo last choice', exact: true }).click();
  expect(f.commands.at(-1)?.command).toMatchObject({type: 'vote', candidateId: 'c1', expectedVoteRevision: 1, value: null});
  await expect(page.getByRole('button', { name: 'Undo last choice', exact: true })).toBeDisabled();
});

test('exact-envelope replay restores Undo from the confirmed receipt snapshot', async ({ page }) => {
  const f = await fixture(page);
  f.lose();
  await page.getByRole('button', { name: 'Nope', exact: true }).click();
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo last choice', exact: true })).toBeEnabled();
  expect(f.commands[1]).toEqual(f.commands[0]);
  await page.getByRole('button', { name: 'Undo last choice', exact: true }).click();
  expect(f.commands.at(-1)?.command).toMatchObject({type: 'vote', candidateId: 'c1', value: null});
});

test('retired history cannot leave an enabled Undo that silently does nothing', async ({ page }) => {
  const f = await fixture(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Nope', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo last choice', exact: true })).toBeEnabled();
  }
  f.room.shared.revision++;
  f.room.shared.candidates = f.room.shared.candidates.filter(c => c.id === 'c3');
  f.room.own.votes = f.room.own.votes.filter(v => v.candidateId === 'c3');
  f.room.shared.matches = [];
  await page.getByRole('button', { name: 'Refresh room', exact: true }).click();
  await page.getByRole('button', { name: 'Undo last choice', exact: true }).click();
  expect(f.commands.at(-1)?.command).toMatchObject({type: 'vote', candidateId: 'c3', value: null});
  await expect(page.getByRole('button', { name: 'Undo last choice', exact: true })).toBeDisabled();
});

for (const viewport of [{width: 320, height: 568}, {width: 844, height: 390}, {width: 375, height: 667}, {width: 390, height: 844}, {width: 1440, height: 900}]) {
  test(`entry, setup and long-title Done remain reachable without page scroll at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    const reachable = async (label: string) => {
      const target = page.getByRole('button', {name: label, exact: true});
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      await target.click({trial: true});
    };
    const noPageScroll = async () => {
      expect(await page.evaluate(() => ({scroll: scrollY, height: document.documentElement.scrollHeight, viewport: innerHeight})))
        .toEqual({scroll: 0, height: viewport.height, viewport: viewport.height});
    };
    await page.goto('/');
    await page.getByLabel('Your nickname').fill('Layout check');
    await reachable('Create a room');
    await noPageScroll();
    await page.screenshot({path: `artifacts/glow/layout-entry-${viewport.width}.png`});
    if (await page.getByRole('button', {name: 'More options', exact: true}).count()) {
      await page.getByRole('button', {name: 'More options', exact: true}).click();
      await reachable('Sign in with GoodWatch');
      await page.getByRole('button', {name: 'Join with an invitation', exact: true}).click();
    } else {
      await reachable('Sign in with GoodWatch');
      await page.getByRole('button', {name: 'Join with an invitation', exact: true}).click();
    }
    await page.getByLabel('Room code or invitation').fill('isolated-code');
    await reachable('Join room');
    await noPageScroll();
    await page.screenshot({path: `artifacts/glow/layout-join-${viewport.width}.png`});

    const f = await fixture(page);
    f.room.shared.phase = 'setup';
    await page.reload();
    await reachable('Start choosing');
    await reachable('Invite friends');
    await reachable('Refresh room');
    await noPageScroll();
    await page.screenshot({path: `artifacts/glow/layout-setup-${viewport.width}.png`});
    f.room.shared.phase = 'decided';
    f.room.shared.revision++;
    f.room.shared.candidates[0].title = 'A very long chosen title that takes two full lines on a narrow screen';
    f.room.shared.decision = {candidateId: 'c1', agreementVersion: 1, decidedAt: Date.now(), availability: []};
    await page.reload();
    await reachable('Where to watch');
    await reachable('Choose again');
    await reachable('Refresh room');
    await noPageScroll();
    await page.screenshot({path: `artifacts/glow/layout-done-${viewport.width}.png`});
  });
}


test('retained continuing-only setup has an explicit guest fallback without silent constraint rewrites', async ({page}) => {
  const f = await fixture(page);
  f.room.shared.phase = 'setup';
  f.room.shared.constraints = {kinds: ['show_continue'], maxMinutes: 45, moods: ['relaxed']};
  f.room.own.member = {state: 'unavailable', prefill: null};
  await page.reload();
  await page.getByRole('button', {name: 'Edit services and settings', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Use these services', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Optional screens and filters', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Continue my shows', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: 'Movies', exact: true}).click();
  await page.getByRole('button', {name: 'New shows', exact: true}).click();
  // Neither opening settings nor selecting guest modes silently removes the retained kind.
  expect(f.commands).toHaveLength(0);
  await expect(page.getByRole('button', {name: 'Use these services', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: 'Use movies and new shows', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Use these services', exact: true})).toBeEnabled();
  expect(f.commands).toHaveLength(0);
  await page.getByRole('button', {name: 'Use these services', exact: true}).click();
  expect(f.commands).toHaveLength(1);
  expect(f.commands[0].command).toMatchObject({type: 'setup', expectedContextVersion: 1, screenId: 'tv', constraints: {kinds: ['movie', 'show_start'], maxMinutes: 45, moods: ['relaxed']}, screens: [{id: 'tv', country: 'DE', serviceIds: [8], confirmed: true}]});
  await expect(page.getByRole('button', {name: 'Use these services', exact: true})).toHaveCount(0);
  await page.reload();
  expect(f.room.shared.constraints.kinds).toEqual(['movie', 'show_start']);
  await expect(page.getByRole('button', {name: 'Start choosing', exact: true})).toBeEnabled();
});
