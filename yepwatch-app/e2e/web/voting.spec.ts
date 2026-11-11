import { test, expect, eventually, type Person } from '../lib/harness';
import { cardTitle, inviteLink, join, readyHost, start, vote } from './flows';

/**
 * The look's own layers: elements on the card and stage that are visible while the card is held but
 * not at rest. Their structure (tags + child counts) tells the eleven looks apart.
 */
async function markRest(p: Person) {
  await p.page.evaluate(() => {
    const w = window as unknown as { __rest: WeakSet<Element> };
    w.__rest = new WeakSet();
    for (const root of document.querySelectorAll('[data-testid="voting"]')) for (const el of root.querySelectorAll('*')) if (el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) w.__rest.add(el);
  });
}
async function lookSignature(p: Person) {
  return p.page.evaluate(() => {
    const rest = (window as unknown as { __rest: WeakSet<Element> }).__rest;
    const parts: string[] = [];
    for (const root of document.querySelectorAll('[data-testid="voting"]'))
      for (const el of root.querySelectorAll('*')) if (!rest.has(el) && el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) parts.push(`${el.tagName}${el.children.length}:${typeof el.className === "string" ? el.className : ""}`);
    return parts.join('.');
  });
}

/**
 * A real swipe that pauses at ~45 % (the look has built up from zero; its layers are sampled), then carries
 * on past the threshold and lets go. Returns the look's layer signature ('' if nothing showed).
 */
async function swipe(p: Person, yes: boolean) {
  // A person grabs the next card after it has landed, not within the same frames.
  await p.page.waitForTimeout(400);
  const box = await p.testId('poster').boundingBox();
  if (!box) p.journeyFailure('no card to swipe');
  const before = await cardTitle(p);
  const dir = yes ? 1 : -1;
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2;
  await markRest(p);
  await p.page.mouse.move(x, y);
  await p.page.mouse.down();
  for (let i = 1; i <= 8; i++) await p.page.mouse.move(x + (dir * box!.width * 0.45 * i) / 8, y + i);
  await p.page.waitForTimeout(150);
  const sig = await lookSignature(p);
  for (let i = 1; i <= 6; i++) await p.page.mouse.move(x + dir * box!.width * (0.45 + 0.07 * i), y + 8);
  await p.page.mouse.up();
  await p.see({ cardChanged: { from: before } }, 5000, 'a swipe past the threshold answers the card');
  return sig;
}

test.describe('deck and voting', () => {
  test('voting: all eleven looks reachable, drag, keys, Undo @core', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    await host.audit('voting (solo)');
    await room.point('voting');
    const looks = new Set<string>();
    const empty: number[] = [];
    for (let i = 0; i < 11; i++) {
      const sig = await swipe(host, i % 2 === 0);
      if (!sig) empty.push(i + 1);
      else looks.add(sig);
    }
    expect(empty, 'every swiped card shows its YEP / NOPE look while held').toEqual([]);
    // Looks are told apart by the structure of their layers; some looks share a structure and differ only in
    // colour/filters, so eleven different looks show as fewer distinct structures. A dealer stuck on one or
    // two looks would show 1-2.
    test.info().annotations.push({ type: 'distinct look structures in 11 cards', description: String(looks.size) });
    expect(looks.size, 'eleven cards in a row deal many different looks (shuffled bag of eleven)').toBeGreaterThanOrEqual(6);
    // ←/→ keys answer like the buttons.
    const k = await cardTitle(host);
    await host.tap(host.testId('poster'), { key: 'ArrowRight', expect: { cardChanged: { from: k } }, moment: 'swipeNextCardMs', repeatable: true });
    // Undo brings the last answered card back.
    const now = await cardTitle(host);
    await host.tap(host.button('Undo'), { expect: { cardChanged: { from: now } } });
    expect(await cardTitle(host), 'Undo shows the card answered last').toBe(k);
  });

  test('two quick Nopes answer two cards (no press lost during the fly-off)', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    const first = await cardTitle(host);
    await host.page.waitForTimeout(500);
    const nope = host.button('Nope');
    await nope.click();
    await host.page.waitForTimeout(120); // second press while the first card is still flying off
    await nope.click();
    await host.see({ cardChanged: { from: first } }, 5000, 'first answer lands');
    const second = await cardTitle(host);
    const third = await host.page.waitForFunction((s) => {
      const sel = '[aria-label$="Swipe or use the choice buttons."]';
      const card = document.querySelector('[data-testid="poster"]');
      const el = card && (card.closest(sel) || card.querySelector(sel));
      const t = el?.getAttribute('aria-label')?.replace(/\. Swipe or use the choice buttons\.$/, '');
      return t && t !== s ? t : null;
    }, second, { timeout: 3000 }).then((h) => h.jsonValue()).catch(() => null);
    if (!third) host.failures.push({ gate: 'dead-button', person: host.name, detail: `second Nope pressed 120 ms after the first was lost: "${second}" stayed the current card`, measured: 'lost', budget: 'every press answers a card' });
    // A press 150 ms after a card became the current card.
    for (let i = 0; i < 4; i++) {
      const t = await cardTitle(host);
      await host.page.waitForTimeout(150);
      await nope.click();
      const moved = await host.page.waitForFunction((s) => {
        const sel = '[aria-label$="Swipe or use the choice buttons."]';
        const card = document.querySelector('[data-testid="poster"]');
        const el = card && (card.closest(sel) || card.querySelector(sel));
        return el?.getAttribute('aria-label')?.startsWith(`${s}.`) === false;
      }, t, { timeout: 2000 }).then(() => true).catch(() => false);
      if (!moved) {
        host.failures.push({ gate: 'dead-button', person: host.name, detail: `Nope pressed 150 ms after "${t}" became the current card did nothing`, measured: 'lost', budget: 'every press answers a card' });
        await nope.click();
        await host.see({ cardChanged: { from: t } }, 5000);
      }
    }
  });

  test('three quick Nopes: every press answers the card shown underneath the flying one', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    await host.page.waitForTimeout(500);
    const nope = host.button('Nope');
    const under = () => host.page.evaluate(() => {
      const el = [...document.querySelectorAll('[data-testid="card-under"]')].find((e) => (e as HTMLElement).offsetParent !== null);
      return el?.querySelector('img')?.getAttribute('src') ?? null;
    });
    await nope.click();
    await host.page.waitForTimeout(120);
    const shownFirst = await under();
    await nope.click();
    await host.page.waitForTimeout(60);
    const shownSecond = await under();
    if (!shownFirst || !shownSecond) host.journeyFailure(`no card underneath during the fly-off: ${shownFirst} / ${shownSecond}`);
    // The second press answered the card that was underneath: it can't stay there as the next card.
    if (shownFirst === shownSecond) host.journeyFailure(`after the second press the card underneath is still the one it answered (${shownSecond}): a third press would answer an unseen card`);
  });

  test('title details sheet from the card', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    const title = await cardTitle(host);
    await host.tap(host.button(`Details about ${title}`), { expect: { visible: ['details-panel'] } });
    await host.audit('title details sheet');
    await expect(host.page.getByRole('link', { name: 'Full details on GoodWatch' })).toBeVisible();
    await host.tap(host.button('Back'), { expect: { hidden: ['details-panel'], visible: ['voting', 'poster'] } });
    // Browser back closes the sheet first, never leaves the room.
    await host.tap(host.button(`Details about ${title}`), { expect: { visible: ['details-panel'] } });
    await host.back();
    await host.see({ hidden: ['details-panel'], visible: ['voting'] }, 5000, 'browser Back closes the details sheet first');
  });

  test('Details on a card flying off never opens another card', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    await host.page.waitForTimeout(500);
    const title = await cardTitle(host);
    // Yep: the card flies right, so its Details button (top left) stays on screen a moment.
    await host.button('Yep').click();
    await host.page.waitForTimeout(60);
    // The answered card is still on its way out; a click on its Details button (as a quick hand would land).
    const pt = await host.page.evaluate((name) => {
      const el = [...document.querySelectorAll('[role="button"]')].find((e) => e.getAttribute('aria-label') === name && e.getBoundingClientRect().width > 0);
      const r = el?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    }, `Details about ${title}`);
    if (!pt) host.journeyFailure(`the flying "${title}" left the screen before the click`);
    await host.page.mouse.click(pt!.x, pt!.y);
    const panel = host.testId('details-panel');
    const open = await panel.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
    if (open && !(await panel.getByText(title, { exact: true }).first().isVisible())) host.journeyFailure(`Details on the flying "${title}" opened another card's details`);
  });

  test('deck refills while voting (no end, "Finding more…" only while loading)', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    const first = (host.latest?.candidates as unknown[] | undefined)?.length ?? 0;
    const seen = new Set<string>([await cardTitle(host)]);
    // Answer well past the first deck page: every answer must bring a new card (vote() waits for it).
    for (let i = 0; i < first + 6; i++) {
      await vote(host, false);
      seen.add(await cardTitle(host));
      if (i === Math.floor(first / 2)) await room.point('voting');
    }
    expect(seen.size, `more distinct cards than the first page of ${first}`).toBeGreaterThan(first);
    await host.see({ visible: ['voting', 'poster'] }, 15000, 'a card after the refill');
  });
});
