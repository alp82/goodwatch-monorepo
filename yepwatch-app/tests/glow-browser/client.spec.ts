import { expect, test, type Page } from '@playwright/test';
import type { CommandEnvelope, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
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
    { candidateId: 'c2', averageYepMs: null },
    { candidateId: 'c3', averageYepMs: null },
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
  await page.route('**/api/yepwatch/v1/proposal/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/catalog/metadata'))
      return route.fulfill({
        json: {
          countries: [{ code: 'DE', name: 'Germany' }],
          services: [{ id: 8, name: 'Netflix', logoUrl: null }, { id: 337, name: 'Disney+', logoUrl: null }],
          providerGroups: [{ id: 8, name: 'Netflix', logoUrl: null, selectionIds: [8], minor: false }, { id: 337, name: 'Disney+', logoUrl: null, selectionIds: [337], minor: false }],
          moods: [{ id: 'relaxed', label: 'Relaxed' }],
        },
      });
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
            activeExposureMs: c.activeExposureMs ?? null,
            timingSource: c.activeExposureMs == null ? 'unavailable' : 'active_exposure',
          });
          room.own.nextCandidateId =
            room.shared.candidates.find(
              (c) => !room.own.votes.some((v) => v.candidateId === c.id && v.value !== null)
            )?.id ?? null;
        }
        if (c.type === 'leave') {
          room.own.left = true;
          room.shared.participants = room.shared.participants.filter(
            (p) => p.participantId !== room.own.participantId
          );
        }
        if (c.type === 'setup') {
          room.shared.screens = c.screens;
          room.shared.constraints = c.constraints;
          room.shared.contextVersion++;
        }
        if (c.type === 'configure') {
          if (c.country)
            room.shared.screens = [{ ...(room.shared.screens[0] ?? { id: 'room', label: 'Our room', serviceIds: [] }), country: c.country, confirmed: true }];
          if (c.constraints) room.shared.constraints = c.constraints;
          room.shared.contextVersion++;
        }
        if (c.type === 'assign_screen') {
          room.shared.rosterVersion++;
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
        if (c.type === 'propose') {
          const previousCandidateId = room.shared.proposal?.candidateId ?? null;
          room.shared.proposalVersion++;
          room.shared.proposal = {
            candidateId: c.candidateId,
            version: room.shared.proposalVersion,
            previousCandidateId,
            agreeCount: 1,
            requiredCount: 2,
            averageYepMs: null,
          };
          room.own.agreement = {
            proposalVersion: room.shared.proposalVersion,
            agreed: true,
            revision: room.own.agreement.revision + 1,
            isProposer: true,
          };
        }
        if (c.type === 'restart') {
          room.shared.phase = 'setup';
          room.shared.generation++;
          room.shared.contextVersion++;
          room.shared.rosterVersion++;
          room.shared.decision = null;
          room.shared.proposal = null;
          room.shared.matches = [];
          room.own.votes = [];
          room.own.nextCandidateId = 'c1';
        }
        if (c.type === 'start') {
          if (c.expectedContextVersion !== room.shared.contextVersion || c.expectedRosterVersion !== room.shared.rosterVersion)
            return route.fulfill({ status: 409, json: { error: { code: 'conflict', message: 'State version changed', retryable: false }, snapshot: room } });
          room.shared.phase = 'choosing';
        }
        if (c.type === 'agree') {
          room.own.agreement = {
            proposalVersion: room.shared.proposalVersion,
            agreed: c.agreed,
            revision: room.own.agreement.revision + 1,
            isProposer: false,
          };
          if (room.shared.proposal) room.shared.proposal.agreeCount = c.agreed ? 2 : 1;
        }
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
  if (setupGuest) await page.getByText('Waiting for Host to start', { exact: true }).waitFor();
  else await page.getByRole('button', { name: 'Yep', exact: true }).waitFor();
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
  await expect.poll(() => f.commands.filter(c => c.command.type === 'vote').map(c => c.command.type === 'vote' && c.command.value)).toEqual(['pass', 'pass']);
  const centered = await page.getByTestId('poster').boundingBox();
  expect(Math.abs(centered!.x - box.x)).toBeLessThan(2);
});
test('lost command response persists exact envelope over reload and blocks new gestures until reconciliation', async ({
  page,
}) => {
  const f = await fixture(page);
  f.lose();
  await page.getByRole('button', { name: 'Yep', exact: true }).click();
  await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
  await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nope', exact: true })).toBeEnabled();
  expect(f.commands).toHaveLength(2);
  expect(f.commands[1]).toEqual(f.commands[0]);
});
test('authoritative expiry is terminal and a delayed room response cannot resurrect controls', async ({
  page,
}) => {
  const f = await fixture(page);
  f.room.shared.phase = 'expired';
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('This room has expired', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toHaveCount(0);
});

test('guest inherits the confirmed couch screen and becomes protocol ready without another confirmation', async ({
  page,
}) => {
  const f = await fixture(page, true);
  await expect(page.getByRole('button', { name: 'Ready to watch', exact: true })).toHaveCount(0);
  expect(f.commands.map((c) => c.command.type)).toEqual(['assign_screen', 'ready']);
  expect(f.commands.at(-1)?.command).toEqual({
    type: 'ready',
    expectedContextVersion: 1,
    ready: true,
  });
  expect(f.room.shared.participants[0].ready).toBe(true);
  expect(f.room.own.agreement.agreed).toBe(false);
});
test('the creator invitation survives a full navigation/reload without bearer storage', async ({
  page,
}) => {
  await fixture(page);
  await page.evaluate(() =>
    sessionStorage.setItem(
      'yepwatch.v3.invite.test-room',
      JSON.stringify({ code: 'isolated-invite', path: '/r/isolated-invite' })
    )
  );
  await page.reload();
  await page.getByRole('button', { name: 'Anything', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled();
  await expect(
    page.getByText(`${new URL(page.url()).host}/r/isolated-invite`, { exact: true })
  ).toBeVisible();
});

for (const error of [101, 150])
  test(`embedding refusal ${error} uses embedded controls and closing preserves card and pick`, async ({
    page,
  }) => {
    const f = await fixture(page);
    f.room.shared.candidates[0].trailerUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    // Isolated player fixture: external playback evidence is recorded separately against real URLs.
    await page.route('https://www.youtube.com/iframe_api', (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `window.YT={Player:function(id,options){const p={getPlayerState:()=>-1,isMuted:()=>false,getVolume:()=>100,playVideo:()=>{},unMute:()=>{},setVolume:()=>{}};setTimeout(()=>{options.events.onReady();options.events.onError({data:${error}})},0);return p}};onYouTubeIframeAPIReady();`,
      })
    );
    await page.reload();
    const card = await page.getByTestId('poster').innerText();
    await page.getByRole('button', { name: 'Watch trailer', exact: true }).click();
    await expect(
      page.getByText('This trailer cannot play inside the app. Watch it on YouTube.', {
        exact: true,
      })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Watch on YouTube', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Play with sound', exact: true })).toHaveCount(0);
    // At least two periodic reports later the refusal remains actionable.
    await page.waitForTimeout(1600);
    await expect(page.getByRole('button', { name: 'Play with sound', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect.poll(() => page.getByTestId('poster').innerText()).toBe(card);
    expect(f.commands).toHaveLength(0);
  });

test('authoritative Undo survives an accepted vote followed by a full reload', async ({ page }) => {
  const f = await fixture(page);
  await page.getByRole('button', { name: 'Nope', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => f.commands.at(-1)?.command).toMatchObject({
    type: 'vote',
    candidateId: 'c1',
    expectedVoteRevision: 1,
    value: null,
  });
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('exact-envelope replay restores Undo from the confirmed receipt snapshot', async ({
  page,
}) => {
  const f = await fixture(page);
  f.lose();
  await page.getByRole('button', { name: 'Nope', exact: true }).click();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  expect(f.commands[1]).toEqual(f.commands[0]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => f.commands.at(-1)?.command).toMatchObject({
    type: 'vote',
    candidateId: 'c1',
    value: null,
  });
});

test('retired history cannot leave an enabled Undo that silently does nothing', async ({
  page,
}) => {
  const f = await fixture(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Nope', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled();
  }
  f.room.shared.revision++;
  f.room.shared.candidates = f.room.shared.candidates.filter((c) => c.id === 'c3');
  f.room.own.votes = f.room.own.votes.filter((v) => v.candidateId === 'c3');
  f.room.shared.matches = [];
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => f.commands.at(-1)?.command).toMatchObject({
    type: 'vote',
    candidateId: 'c3',
    value: null,
  });
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('late newcomer can inspect and Agree to preserved nonmatch proposal with exact version fences, without exposure input', async ({
  page,
}) => {
  const f = await fixture(page);
  f.room.shared.matches = [];
  f.room.shared.proposalVersion = 4;
  f.room.shared.proposal = {
    candidateId: 'c2',
    version: 4,
    previousCandidateId: null,
    agreeCount: 1,
    requiredCount: 2,
    averageYepMs: null,
  };
  f.room.own.agreement = { proposalVersion: 4, agreed: false, revision: 3, isProposer: false };
  await page.reload();
  await expect(page.getByText('SOMEONE PROPOSES', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 2 agree', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Agree', exact: true }).click();
  await expect.poll(() => f.commands.at(-1)?.command).toEqual({
    type: 'agree',
    generation: 1,
    expectedRosterVersion: 1,
    expectedProposalVersion: 4,
    candidateId: 'c2',
    expectedOwnAgreementRevision: 3,
    agreed: true,
  });
  await page.getByRole('button', { name: 'Take back', exact: true }).click();
  await expect.poll(() => f.commands.at(-1)?.command).toMatchObject({ type: 'agree', agreed: false });
  await page.getByRole('button', { name: 'Keep swiping', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
});

test('measured Yep exposure pauses for details and match inspection; missing reload measurements stay null', async ({
  page,
}) => {
  // Exposure cannot begin before the poster exists. Take that moment from the page itself: Playwright's
  // visibility polling backs off, so its own detection can lag the poster by hundreds of milliseconds.
  await page.addInitScript(() => {
    const seen = () => { if (!(window as unknown as { posterAt?: number }).posterAt && document.querySelector('[data-testid="poster"]')) (window as unknown as { posterAt?: number }).posterAt = Date.now(); };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true });
  });
  const f = await fixture(page);
  const wallStart = await page.evaluate(() => (window as unknown as { posterAt: number }).posterAt);
  await page.waitForTimeout(200);
  await page.getByTestId('poster').click({ position: { x: 20, y: 20 } });
  await page.getByTestId('details-panel').waitFor();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: '2 matches', exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Yep', exact: true }).click();
  await expect.poll(() => f.commands.at(-1)?.command.type).toBe('vote');
  const measured = f.commands.at(-1)?.command;
  expect(measured?.type).toBe('vote');
  if (measured?.type !== 'vote') throw new Error('No explicit vote');
  expect(measured.activeExposureMs).toBeGreaterThan(0);
  expect(measured.activeExposureMs!).toBeLessThan(Date.now() - wallStart - 1100);
  await page.getByRole('button', { name: 'Yep', exact: true }).waitFor();
  await page.waitForTimeout(150);
  await page.reload();
  await page.getByRole('button', { name: 'Yep', exact: true }).click();
  await expect.poll(() => f.commands.filter(e => e.command.type === 'vote').length).toBe(2);
  const afterReload = f.commands.at(-1)?.command;
  if (afterReload?.type !== 'vote') throw new Error('No explicit reloaded vote');
  expect(afterReload.activeExposureMs).toBeNull();
});

for (const reducedMotion of ['no-preference', 'reduce'] as const)
for (const direction of [-1, 1])
  test(`${reducedMotion} swipe ${direction} never re-enters with the opposite stamp`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    const f = await fixture(page);
    await page.route('**/commands', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await route.fallback();
    });
    const box = (await page.getByTestId('poster').boundingBox())!;
    await page.evaluate(() => {
      const samples: { title: string; x: number; yep: number; nope: number }[] = [];
      (window as any).__swipeSamples = samples;
      let until = performance.now() + 1700;
      function sample() {
        const poster = document.querySelector('[data-testid="poster"]')!;
        if (poster)
          samples.push({
            title: poster.textContent!,
            x: poster.getBoundingClientRect().x,
            yep: Number(
              getComputedStyle(document.querySelector('[data-testid="stamp-yep"]')!).opacity
            ),
            nope: Number(
              getComputedStyle(document.querySelector('[data-testid="stamp-nope"]')!).opacity
            ),
          });
        if (performance.now() < until) requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    const x = box.x + box.width / 2,
      y = box.y + box.height * 0.45;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + direction * 110, y, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => f.commands.length).toBe(1);
    await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeEnabled();
    await page.waitForTimeout(250);
    const samples = await page.evaluate(
      () =>
        (window as any).__swipeSamples as { title: string; x: number; yep: number; nope: number }[]
    );
    expect(samples.length).toBeGreaterThan(10);
    expect(samples.some((s) => (direction < 0 ? s.yep > 0.01 : s.nope > 0.01))).toBe(false);
    const centered = (await page.getByTestId('poster').boundingBox())!;
    expect(Math.abs(centered.x - box.x)).toBeLessThan(2);
  });

test('live hover positions cross the poster, pressed swipes stay private, release removes touch', async ({
  page,
}) => {
  const f = await fixture(page);
  f.room.shared.participants.push({
    participantId: 'peer',
    nickname: 'Friend',
    serviceIds: null,
    screenId: 'tv',
    ready: true,
  });
  const sent: any[] = [];
  let peerSend: (message: string) => void = () => {};
  await page.route('**/realtime-ticket', (route) =>
    route.fulfill({
      json: {
        ticket: 'fixture-ticket',
        expiresAt: Date.now() + 10000,
        websocketPath: '/api/yepwatch/v1/proposal/realtime',
      },
    })
  );
  await page.routeWebSocket('**/realtime', (ws) => {
    peerSend = (message) => ws.send(message);
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      sent.push(message);
      if (message.type === 'authenticate') {
        ws.send(JSON.stringify({ type: 'room.snapshot', snapshot: f.room.shared }));
        ws.send(
          JSON.stringify({
            type: 'activity.session',
            roomId: 'test-room',
            sessionId: 'own-session',
            serverTime: Date.now(),
          })
        );
      }
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Yep', exact: true }).waitFor();
  await expect.poll(() => sent.some((f) => f.type === 'authenticate' && f.pointers)).toBe(true);
  const box = (await page.getByTestId('pointer-surface').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.4);
  await expect.poll(() => sent.filter((f) => f.pointer).length).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await expect.poll(() => sent.filter((f) => f.pointer).at(-1)?.pointer.x).toBeCloseTo(0.7, 1);
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.55, { steps: 6 });
  const pressed = sent.filter((f) => f.pointer?.pressed);
  expect(pressed.length).toBeGreaterThan(0);
  expect(pressed.every((f) => Math.abs(f.pointer.x - 0.7) < 0.02)).toBe(true);
  await page.mouse.up();
  const activity = (sequence: number, pointer: any) =>
    JSON.stringify({
      type: 'activity',
      roomId: 'test-room',
      participantId: 'peer',
      sessionId: 'peer-session',
      sequence,
      view: 'voting',
      pointer,
      serverTime: Date.now(),
      expiresAt: Date.now() + 6000,
    });
  peerSend(activity(1, { x: 0.25, y: 0.3, pressed: true, kind: 'touch' }));
  const cursor = page.getByTestId('peer-live-pointer');
  await expect(cursor).toBeVisible();
  const first = await cursor.boundingBox();
  await page.screenshot({ path: 'artifacts/interaction-live-pointer.png' });
  peerSend(activity(2, { x: 0.75, y: 0.6, pressed: false, kind: 'mouse' }));
  await expect
    .poll(async () => (await cursor.boundingBox())!.x)
    .toBeGreaterThan(first!.x + box.width * 0.4);
  await expect(cursor).toHaveCSS('pointer-events', 'none');
  peerSend(activity(3, null));
  await expect(cursor).toHaveCount(0);
});

test('leaving the room sends one explicit command and returns to the entrance', async ({
  page,
}) => {
  const f = await fixture(page);
  await page.getByRole('button', { name: 'Anything', exact: true }).click();
  await page.getByRole('button', { name: 'Leave room', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(f.commands.filter((e) => e.command.type === 'leave')).toHaveLength(1);
  expect(f.commands.some((e) => e.command.type === 'agree')).toBe(false);
});

test('dropped people do not count as in the room', async ({page}) => {
  const f = await fixture(page);
  f.room.shared.participants.push({participantId:'dropped-friend',nickname:'Sam',serviceIds:null,screenId:'tv',ready:true,dropped:true});
  await page.reload();
  await page.getByRole('button',{name:'Anything',exact:true}).click();
  await expect(page.getByText('Just you',{exact:true})).toBeVisible();
  await expect(page.getByText('2 people',{exact:true})).toHaveCount(0);
});

for (const mode of ['no-share', 'rejected', 'cancelled', 'manual'] as const) {
  test(`invitation sharing handles browser ${mode}`, async ({ page }) => {
    await page.addInitScript((mode) => {
      sessionStorage.setItem('yepwatch.v3.invite.test-room', JSON.stringify({ code: 'ABC234', path: '/r/ABC234' }));
      Object.defineProperty(navigator, 'share', { configurable: true, value: mode === 'no-share' ? undefined : async () => {
        throw new DOMException('Test share result', mode === 'cancelled' ? 'AbortError' : 'NotAllowedError');
      } });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => {
        if (mode === 'manual') throw new DOMException('Denied', 'NotAllowedError');
        sessionStorage.setItem('test-copied-invitation', value);
      } } });
    }, mode);
    await fixture(page);
    await page.getByRole('button', { name: 'Anything', exact: true }).click();
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    if (mode === 'no-share' || mode === 'rejected') {
      await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem('test-copied-invitation'))).toBe(`${new URL(page.url()).origin}/r/ABC234`);
    } else if (mode === 'manual') {
      await expect(page.getByText('Select and copy the link', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Copied', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => sessionStorage.getItem('test-copied-invitation'))).toBeNull();
    }
    await expect(page.getByText(/Sharing could not open/)).toHaveCount(0);
  });
}


test('Tonight cheers send real activity: tap, renewed hold with one seed, all-hold Marquee, release on pointer up', async ({ page }) => {
  const f = await fixture(page);
  f.room.shared.participants.push({ participantId: 'peer', nickname: 'Friend', serviceIds: null, screenId: 'tv', ready: true });
  f.room.shared.phase = 'decided';
  f.room.shared.decision = { candidateId: 'c1', proposalVersion: 1, decidedAt: Date.now(), availability: [] };
  const sent: any[] = [];
  let peerSend: (message: string) => void = () => {};
  await page.route('**/realtime-ticket', (route) => route.fulfill({ json: { ticket: 'fixture-ticket', expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' } }));
  await page.routeWebSocket('**/realtime', (ws) => {
    peerSend = (message) => ws.send(message);
    ws.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      sent.push(message);
      if (message.type === 'authenticate') {
        ws.send(JSON.stringify({ type: 'room.snapshot', snapshot: f.room.shared }));
        ws.send(JSON.stringify({ type: 'activity.session', roomId: 'test-room', sessionId: 'own-session', serverTime: Date.now() }));
      }
    });
  });
  await page.reload();
  const poster = page.getByRole('button', { name: /^Cheer for / });
  await poster.waitFor();
  await expect.poll(() => sent.some((m) => m.type === 'authenticate' && m.cheers === true)).toBe(true);
  await expect(poster).toBeEnabled();
  await poster.click();
  await expect.poll(() => sent.filter((m) => m.cheer?.kind === 'tap').length).toBe(1);
  const tap = sent.find((m) => m.cheer?.kind === 'tap');
  expect(tap).toMatchObject({ type: 'activity', view: 'matches', cheer: { kind: 'tap', generation: 1 } });
  expect(tap.gesture ?? tap.pointer ?? tap.inspection ?? tap.beat).toBeUndefined();
  await expect(page.getByTestId('cheer-kernel').first()).toBeAttached();
  const box = (await poster.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => sent.filter((m) => m.cheer?.kind === 'hold').length, { timeout: 4000 }).toBeGreaterThanOrEqual(3);
  const holds = sent.filter((m) => m.cheer?.kind === 'hold');
  expect(new Set(holds.map((h) => h.cheer.seed)).size).toBe(1);
  await expect(page.getByTestId('cheer-marquee')).toHaveCount(0);
  peerSend(JSON.stringify({ type: 'activity', roomId: 'test-room', participantId: 'peer', sessionId: 'peer-session', sequence: 1, view: 'matches', serverTime: Date.now(), expiresAt: Date.now() + 6000, cheer: { kind: 'hold', generation: 1, seed: 99 } }));
  await expect(page.getByTestId('cheer-marquee')).toBeAttached();
  await page.mouse.up();
  await expect.poll(() => sent.filter((m) => m.cheer?.kind === 'release').length).toBe(1);
  await expect(page.getByTestId('cheer-marquee')).toHaveCount(0);
  await expect(page.getByText(/cheering/)).toHaveCount(0);
  expect(f.commands).toHaveLength(0);
});

test('tapping outside a field dismisses the keyboard in panels', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join a room', exact: true }).click();
  const code = page.getByLabel('Room code or invitation');
  await code.focus();
  await expect(code).toBeFocused();
  await page.getByText('Your name', { exact: true }).click();
  await expect(code).not.toBeFocused();
  await expect(page.getByLabel('Your name')).not.toBeFocused();
});

test('a nameless host can continue with GoodWatch; an unconnected sign-in stays an honest guest state', async ({ page }) => {
  const f = await fixture(page);
  f.room.shared.phase = 'setup';
  f.room.shared.participants[0].nickname = '';
  await page.reload();
  await page.getByRole('button', { name: 'Continue with GoodWatch', exact: true }).click();
  await expect(page.getByText('GoodWatch sign-in isn’t connected yet.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your name')).toBeVisible();
});
