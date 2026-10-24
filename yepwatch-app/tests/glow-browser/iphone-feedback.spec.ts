import { expect, test, type Page } from '@playwright/test';
import { continuousFixture } from '../continuous-fixture';

async function fixture(page: Page, setup = false) {
  const room = continuousFixture();
  room.shared.matches = [{ candidateId: 'c2', averageYepMs: null }];
  room.shared.stream.state = 'exhausted';
  room.shared.stream.reason = 'catalog_end';
  if (setup) room.shared.phase = 'setup';
  const writes: any[] = [];
  let left = false;
  const countries: string[] = [];
  await page.route('**/api/yepwatch/v1/proposal/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/catalog/metadata')) {
      const country = url.searchParams.get('country') || '';
      countries.push(country);
      return route.fulfill({ json: { countries: [{ code: 'DE', name: 'Germany' }, { code: 'ME', name: 'Montenegro' }], moods: [], services: country === 'ME' ? [{ id: 8, name: 'Netflix', logoUrl: null }] : Array.from({ length: 65 }, (_, i) => ({ id: i + 1, name: `Service ${String(i + 1).padStart(2, '0')}`, logoUrl: null })) } });
    }
    if (url.pathname.endsWith('/resolve-invite')) return route.fulfill({ json: { roomId: 'test-room' } });
    if (url.pathname.endsWith('/invite')) return route.fulfill({ json: { code: 'ABC234', path: '/r/ABC234' } });
    if (url.pathname.endsWith('/realtime-ticket')) return route.fulfill({ status: 501, json: { error: { code: 'not_implemented', message: 'Fixture', retryable: false } } });
    if (url.pathname.endsWith('/join')) {
      writes.push({ type: 'join', ...route.request().postDataJSON() });
      left = false; room.own.left = false;
      return route.fulfill({ json: { snapshot: room, credential: { roomId: 'test-room', participantId: 'host', token: '', expiresAt: room.shared.expiresAt }, invite: { code: 'ABC234', path: '/r/ABC234' } } });
    }
    if (url.pathname.endsWith('/commands')) {
      const command = route.request().postDataJSON().command;
      writes.push(command); room.shared.revision++; room.own.nextSequence++;
      if (command.type === 'vote') { room.own.votes.push({ candidateId: command.candidateId, value: command.value, revision: 1, activeExposureMs: null, timingSource: 'unavailable' }); room.own.nextCandidateId = 'c2'; }
      if (command.type === 'leave') { left = true; room.own.left = true; }
      return route.fulfill({ json: { snapshot: room, receipt: {} } });
    }
    if (left) return route.fulfill({ status: 403, json: { error: { code: 'forbidden', message: 'Left room', retryable: false } } });
    return route.fulfill({ json: room });
  });
  await page.goto('/room/test-room');
  await expect(page.getByTestId('yepwatch-boot')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem('yepwatch.v3.invite.test-room', JSON.stringify({ code: 'ABC234', path: '/r/ABC234' })));
  return { room, writes, countries };
}

test('full provider list scrolls in popularity order; country selects a new list', async ({ page }) => {
  const f = await fixture(page, true);
  await page.getByRole('button', { name: 'Edit room description and services' }).click();
  const services = page.getByRole('checkbox', { name: /^Service / });
  await expect(services).toHaveCount(65);
  await expect(services.first()).toHaveAccessibleName('Service 01');
  const last = page.getByRole('checkbox', { name: 'Service 65', exact: true });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toBeChecked();
  await expect(services.first()).toHaveAccessibleName('Service 01');
  await page.screenshot({ path: '.expo/feedback-provider-last.png' });
  await page.getByRole('button', { name: 'Choose country' }).click();
  await expect(page.getByRole('textbox', { name: 'Find country' })).toBeVisible();
  await page.getByRole('button', { name: 'Montenegro', exact: true }).click();
  await expect(services).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Netflix', exact: true })).toBeVisible();
  expect(f.countries).toContain('ME');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
});

test('Back closes matches, returns home without leaving, and restores the same room after reload', async ({ page }) => {
  const f = await fixture(page);
  const original = await page.getByTestId('poster').innerText();
  await page.getByRole('button', { name: 'Inspect 1 matches' }).click();
  await page.getByRole('button', { name: 'Back to voting' }).click();
  await expect(page.getByTestId('poster')).toHaveText(original, { useInnerText: true });
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(page.getByRole('button', { name: 'Return to your room' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Return to your room' }).click();
  await expect(page.getByTestId('poster')).toHaveText(original, { useInnerText: true });
  expect(f.writes).toEqual([]);
});

test('explicit Leave can rejoin with the existing identity through the home shortcut', async ({ page }) => {
  const f = await fixture(page);
  await page.getByRole('button', { name: 'Open room' }).click();
  await page.getByRole('button', { name: 'Leave room', exact: true }).click();
  await page.getByRole('button', { name: 'Return to your room' }).click();
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
  expect(f.writes.map(c => c.type)).toEqual(['leave', 'join']);
  expect(f.room.own.participantId).toBe('host');
});

test('voting preserves the atmosphere instead of changing backdrop images', async ({ page }) => {
  await fixture(page);
  const atmosphere = page.getByTestId('room-atmosphere');
  const before = await atmosphere.evaluate(el => el.outerHTML);
  await page.getByRole('button', { name: 'Yep', exact: true }).click();
  await expect(page.getByTestId('poster')).toContainText('Isolated test c2');
  expect(await atmosphere.evaluate(el => el.outerHTML)).toBe(before);
  await expect(atmosphere.locator('img')).toHaveCount(0);
});

for (const [width, height] of [[320,568], [375,667], [390,844], [844,390], [1440,900]]) {
  test(`Back and recent-room entry fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await fixture(page);
    await page.getByRole('button', { name: 'Back to start' }).click();
    const back = page.getByRole('button', { name: 'Return to your room' });
    const bounds = await back.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: `.expo/feedback-entry-${width}.png` });
  });
}

test('boot reveals YepWatch once, then stays absent during navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const boot = page.getByTestId('yepwatch-boot');
  await expect(boot).toBeVisible();
  await page.waitForTimeout(850);
  await page.screenshot({ path: '.expo/feedback-boot.png' });
  await expect(boot).toHaveCount(0, { timeout: 5000 });
  await page.getByRole('button', { name: 'Join a room', exact: true }).click();
  await expect(boot).toHaveCount(0);
});

test('room activity and exposure do not begin behind the boot overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  let roomReads = 0;
  await page.route('**/api/yepwatch/v1/proposal/**', async route => {
    roomReads++;
    await route.fulfill({ json: continuousFixture() });
  });
  await page.goto('/room/test-room');
  await expect(page.getByTestId('yepwatch-boot')).toBeVisible();
  await page.waitForTimeout(500);
  expect(roomReads).toBe(0);
  await expect(page.getByTestId('yepwatch-boot')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Yep', exact: true })).toBeVisible();
  expect(roomReads).toBeGreaterThan(0);
});

test('Tonight Back reviews matches without changing the decision; edge Back returns to Tonight', async ({ page }) => {
  const f = await fixture(page);
  f.room.shared.phase = 'decided';
  f.room.shared.matches = [{ candidateId:'c1',averageYepMs:1000 },{candidateId:'c2',averageYepMs:2000}];
  f.room.shared.decision = { candidateId:'c1',proposalVersion:1,decidedAt:Date.now(),availability:[] };
  await page.reload();
  await expect(page.getByText('TONIGHT',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back to matches',exact:true}).click();
  await expect(page.getByText('Tonight’s choice is saved.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/^Propose /})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/^Agree to /})).toHaveCount(0);
  await page.mouse.move(5,350);await page.mouse.down();await page.mouse.move(125,355,{steps:12});await page.mouse.up();
  await expect(page.getByText('TONIGHT',{exact:true})).toBeVisible();
  expect(f.writes).toEqual([]);expect(f.room.shared.decision?.candidateId).toBe('c1');
});

for (const input of ['mouse', 'touch'] as const) {
  test(`${input} edge swipe closes matches and drawers, while a card swipe remains a vote`, async ({ page, browserName }) => {
    test.skip(input === 'touch' && browserName !== 'chromium', 'Touch injection uses the Chromium protocol.');
    const f = await fixture(page);
    const cdp = input === 'touch' ? await page.context().newCDPSession(page) : null;
    async function swipe(x: number, y: number, endX: number, endY: number) {
      if (cdp) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let step = 1; step <= 12; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (endX-x)*step/12, y: y + (endY-y)*step/12 }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(x,y); await page.mouse.down();
        await page.mouse.move(endX,endY,{steps:12}); await page.mouse.up();
      }
    }
    await page.getByRole('button', { name: 'Inspect 1 matches' }).click();
    await swipe(4,350,110,353);
    await expect(page.getByTestId('poster')).toBeVisible();
    expect(f.writes).toEqual([]);
    await page.getByRole('button', { name: 'Open room', exact: true }).click();
    const edge = page.getByRole('dialog').getByTestId('back-gesture-edge');
    await expect(edge).toBeVisible(); const box = await edge.boundingBox();
    await swipe(box!.x+5,box!.y+70,box!.x+115,box!.y+73);
    await expect(page.getByRole('button', { name: 'Leave room', exact: true })).toHaveCount(0);
    const poster = await page.getByTestId('poster').boundingBox();
    await swipe(poster!.x+poster!.width/2,poster!.y+poster!.height*.35,poster!.x+poster!.width*.95,poster!.y+poster!.height*.35);
    await expect.poll(() => f.writes.some(c => c.type === 'vote')).toBe(true);
  });
}

test('late poster load cannot flash the old title after choosing the next one',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});
  const pending=new Map<string,()=>void>();
  await page.route('**/feedback-image-*.svg',async route=>{
    const key=route.request().url().split('/').pop()!;await new Promise<void>(resolve=>pending.set(key,resolve));
    await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="purple"/></svg>'});
  });
  const f=await fixture(page);f.room.shared.candidates[0].posterUrl='https://example.test/feedback-image-old.svg';f.room.shared.candidates[1].posterUrl='https://example.test/feedback-image-new.svg';
  await page.reload();await expect.poll(()=>pending.has('feedback-image-old.svg')).toBe(true);
  await page.getByRole('button',{name:'Yep',exact:true}).click();await expect.poll(()=>pending.has('feedback-image-new.svg')).toBe(true);
  pending.get('feedback-image-old.svg')!();await page.waitForTimeout(100);
  await expect(page.getByTestId('poster')).toContainText('Isolated test c2');
  const image=page.getByTestId('poster-art');await expect(image).toHaveCSS('opacity','0');
  pending.get('feedback-image-new.svg')!();await expect(image).toHaveCSS('opacity','1');
  await expect(page.getByTestId('poster')).toContainText('Isolated test c2');
});


test('cached next poster fades in without a full-opacity flash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const f = await fixture(page);
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="purple"/></svg>');
  f.room.shared.candidates[0].posterUrl = image;
  f.room.shared.candidates[1].posterUrl = image + '#next';
  await page.evaluate(async src => { const img = new Image(); img.src = src; await img.decode(); }, image + '#next');
  await page.reload();
  await expect(page.getByTestId('poster-art')).toHaveCSS('opacity', '1');
  await page.evaluate(() => {
    (window as any).__fadeFrames = [];
    const until = performance.now() + 1500;
    function sample() {
      const poster = document.querySelector('[data-testid="poster"]');
      const art = poster?.querySelector('[data-testid="poster-art"]');
      if (art && poster?.textContent?.includes('Isolated test c2')) (window as any).__fadeFrames.push(Number(getComputedStyle(art).opacity));
      if (performance.now() < until) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.getByRole('button', { name: 'Nope', exact: true }).click();
  await expect(page.getByTestId('poster')).toContainText('Isolated test c2');
  await expect(page.getByTestId('poster-art')).toHaveCSS('opacity', '1');
  await page.waitForTimeout(300);
  const frames: number[] = await page.evaluate(() => (window as any).__fadeFrames);
  expect(frames.length).toBeGreaterThan(5);
  expect(frames.some(opacity => opacity > 0 && opacity < 0.9)).toBe(true);
  for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
});
