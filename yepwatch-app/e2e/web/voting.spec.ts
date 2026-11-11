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

/** The titles this person has answered (Yep or Nope), oldest first, as the room confirmed them. */
function answered(p: Person) {
  const titles = new Map(((p.latest?.candidates as { id: string; title: string }[] | undefined) ?? []).map((c) => [c.id, c.title]));
  return (p.own?.votes ?? []).filter((v) => v.value !== null).map((v) => titles.get(v.candidateId) ?? v.candidateId);
}
/** Waits for the confirmed answers to end with `want` (in order): every press answered exactly the card it saw. */
async function answersEndWith(p: Person, want: string[], what: string) {
  await eventually(() => answered(p).slice(-want.length), (got) => JSON.stringify(got) === JSON.stringify(want), what, p);
}
type Flying = { hidden: boolean; inert: boolean; named: boolean; controls: { label: string | null; disabled: boolean; focusable: boolean }[]; box: { x: number; y: number; width: number; height: number } };
/**
 * Watches the stage frame by frame from now (page-side, so slow round trips can't miss it): the first
 * frame whose live card isn't `before`, and the answered card flying off in that same frame.
 */
async function armPress(p: Person, before: string) {
  await p.page.evaluate((before) => {
    const live = () => {
      const sel = '[aria-label$="Swipe or use the choice buttons."]';
      const card = document.querySelector('[data-testid="poster"]');
      const el = card && (card.closest(sel) ?? card.querySelector(sel));
      return el?.getAttribute('aria-label')?.replace(/\. Swipe or use the choice buttons\.$/, '') ?? null;
    };
    const flying = () => {
      const el = [...document.querySelectorAll('[data-testid="poster-leaving"]')].find((e) => e.getBoundingClientRect().width > 0) as HTMLElement | undefined;
      if (!el) return null;
      let hidden = false;
      let inert = false;
      for (let n: HTMLElement | null = el; n; n = n.parentElement) {
        if (n.getAttribute('aria-hidden') === 'true') hidden = true;
        if (getComputedStyle(n).pointerEvents === 'none') inert = true;
      }
      const named = el.querySelector('[aria-label$="Swipe or use the choice buttons."]') !== null;
      const controls = [...el.querySelectorAll('[role="button"]')].map((b) => ({ label: b.getAttribute('aria-label'), disabled: b.getAttribute('aria-disabled') === 'true', focusable: (b as HTMLElement).tabIndex >= 0 }));
      const r = el.getBoundingClientRect();
      return { hidden, inert, named, controls, box: { x: r.x, y: r.y, width: r.width, height: r.height } };
    };
    (window as unknown as { __press: Promise<unknown> }).__press = new Promise((resolve) => {
      const end = performance.now() + 3000;
      const step = () => {
        const now = live();
        if (now && now !== before) return resolve({ live: now, flying: flying() });
        if (performance.now() > end) return resolve(null);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, before);
}
async function pressed(p: Person) {
  return p.page.evaluate(() => (window as unknown as { __press: Promise<{ live: string; flying: Flying | null } | null> }).__press);
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
    // No Ready hold: the first card takes a press the moment it shows.
    const first = await cardTitle(host);
    const nope = host.button('Nope');
    await nope.click();
    await host.see({ cardChanged: { from: first } }, 5000, 'first answer lands');
    const second = await cardTitle(host);
    await host.page.waitForTimeout(120); // second press while the first card is still flying off
    await nope.click();
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

  test('presses during a fly-off answer exactly the visible card: next card live next frame, never the flying one or an unseen card', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    const nope = host.button('Nope');
    const seen: string[] = [await cardTitle(host)];
    // Three Nopes, each while the card before is still flying off over the live one.
    for (const gap of [120, 60, 0]) {
      await armPress(host, seen.at(-1)!);
      await nope.click();
      // The next card is the live card from the first frame after the press, with the answered one flying off over it.
      const r = await pressed(host);
      if (!r) host.journeyFailure(`after Nope on "${seen.at(-1)}" the live card never changed`);
      if (seen.includes(r!.live)) host.journeyFailure(`the live card after a Nope is "${r!.live}", a card already answered`);
      if (!r!.flying) host.journeyFailure(`in the frame "${r!.live}" became live, "${seen.at(-1)}" wasn't flying off over it`);
      seen.push(r!.live);
      if (gap) await host.page.waitForTimeout(gap);
    }
    // Each press answered the card it saw, in order; the card now live (the last seen) is unanswered.
    await answersEndWith(host, seen.slice(0, 3), 'three Nopes answer exactly the three cards that were live when pressed');
    expect(answered(host), 'the live card was never answered by a press aimed at another card').not.toContain(seen[3]);
    expect(await cardTitle(host), 'the live card is the next unanswered one').toBe(seen[3]);
  });

  test('a swipe started during the fly-off answers the live card', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    const first = await cardTitle(host);
    const box = (await host.testId('poster').boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const fling = async (dir: number) => {
      await host.page.mouse.move(x, y);
      await host.page.mouse.down();
      for (let i = 1; i <= 6; i++) await host.page.mouse.move(x + (dir * box.width * 0.7 * i) / 6, y + i);
      await host.page.mouse.up();
    };
    await armPress(host, first);
    await fling(1);
    const r = await pressed(host);
    if (!r) host.journeyFailure('the swipe did not answer the first card');
    if (!r!.flying) host.journeyFailure('no answered card flying off after the swipe');
    const second = r!.live;
    // At once, while the first card is still flying off on top: grab the card underneath and swipe it.
    await fling(-1);
    await host.see({ cardChanged: { from: second } }, 2000, 'a swipe during the fly-off answers the live card');
    await answersEndWith(host, [first, second], 'the second swipe answered the live card, not the flying one');
  });

  test('the flying card takes no input and is not the voting card', async ({ room }) => {
    const host = await readyHost(room);
    await start(host, []);
    const title = await cardTitle(host);
    // Yep: the card flies right, so its Details button (top left) stays on screen a moment.
    await armPress(host, title);
    await host.button('Yep').click();
    const r = await pressed(host);
    if (!r) host.journeyFailure(`Yep on "${title}" did not answer it`);
    const { live, flying } = r!;
    if (!flying) host.journeyFailure(`the answered "${title}" was not flying off over the live card`);
    expect(flying!.hidden, 'the flying card is out of the accessibility tree').toBe(true);
    expect(flying!.inert, 'the flying card lets the pointer through to the live card').toBe(true);
    expect(flying!.named, 'the flying card is not named as the voting card').toBe(false);
    expect(flying!.controls.filter((b) => !b.disabled || b.focusable), 'the flying card\'s Details and Trailer answer nothing').toEqual([]);
    // A quick hand lands on where its Details button was: it never opens the answered card.
    await host.page.mouse.click(flying!.box.x + 40, flying!.box.y + 36);
    const panel = host.testId('details-panel');
    const open = await panel.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false);
    if (open && await panel.getByText(title, { exact: true }).first().isVisible()) host.journeyFailure(`a click on the flying "${title}" opened its details`);
    // Anything it reached is the live card's.
    if (open) await expect(panel.getByText(live, { exact: true }).first()).toBeVisible();
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

  test('deck refills while voting (no end, "Finding more…" only while loading)', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia', 'Netflix');
    await start(host, [mia]);
    // The friend's first card takes a press at once too (no hold after the round starts).
    await vote(mia, false, { pace: 0 });
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
