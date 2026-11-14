import test from 'node:test';
import assert from 'node:assert/strict';
import { LOOKS, LookDealer, harnessLooksFrom, isLook, pinnedLookFrom, shuffledBag, type Look } from '../src/features/room/vote/looks';
import { EM, fitTo, stageGeometry, stageRim, wordW } from '../src/features/room/vote/geometry';

/** A seeded generator, so every run deals the same way. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

test('a bag holds every look exactly once', () => {
  for (let seed = 1; seed < 40; seed++) {
    const bag = shuffledBag(undefined, seeded(seed));
    assert.equal(bag.length, LOOKS.length);
    assert.deepEqual([...bag].sort(), [...LOOKS].sort());
  }
});

test('a reshuffled bag never starts with the look that just ended', () => {
  for (let seed = 1; seed < 200; seed++) {
    for (const last of LOOKS) assert.notEqual(shuffledBag(last, seeded(seed))[0], last);
  }
  // Even a generator that would always put the same look first.
  const fixed = () => 0;
  const usualFirst = shuffledBag(undefined, fixed)[0];
  assert.notEqual(shuffledBag(usualFirst, fixed)[0], usualFirst);
});

test('the dealer gives every look once per eleven cards and never repeats across a reshuffle', () => {
  const dealer = new LookDealer(seeded(7));
  const dealt: Look[] = [];
  for (let i = 0; i < LOOKS.length * 5; i++) dealt.push(dealer.lookFor(`card-${i}`));
  for (let round = 0; round < 5; round++) {
    const bag = dealt.slice(round * LOOKS.length, (round + 1) * LOOKS.length);
    assert.equal(new Set(bag).size, LOOKS.length, `round ${round} deals each look once`);
  }
  for (let i = 1; i < dealt.length; i++) assert.notEqual(dealt[i], dealt[i - 1], `card ${i} differs from the card before`);
});

test('a card keeps its look: Undo brings it back with its own, without using up the bag', () => {
  const dealer = new LookDealer(seeded(3));
  const first = dealer.lookFor('g1:c1');
  const second = dealer.lookFor('g1:c2');
  assert.equal(dealer.lookFor('g1:c1'), first);
  assert.equal(dealer.lookFor('g1:c2'), second);
  const third = dealer.lookFor('g1:c3');
  assert.notEqual(third, first);
  assert.notEqual(third, second);
});

test('a pinned look goes to every card', () => {
  const dealer = new LookDealer(seeded(3), 'stamp');
  assert.equal(dealer.lookFor('a'), 'stamp');
  assert.equal(dealer.lookFor('b'), 'stamp');
  assert.equal(pinnedLookFrom('?look=neon&x=1'), 'neon');
  assert.equal(pinnedLookFrom('?look=mix'), null);
  assert.equal(pinnedLookFrom(''), null);
  assert.equal(pinnedLookFrom(undefined), null);
  assert.equal(isLook('glitch'), true);
  assert.equal(isLook('classic'), false);
});

test('the harness pin deals its looks in order and a card keeps its own', () => {
  assert.deepEqual(harnessLooksFrom('wall'), ['wall']);
  assert.deepEqual(harnessLooksFrom('wall, neon,mix'), ['wall', 'neon']);
  assert.equal(harnessLooksFrom('mix'), null);
  assert.equal(harnessLooksFrom(undefined), null);
  const dealer = new LookDealer(seeded(3), ['wall', 'neon']);
  assert.deepEqual(['a', 'b', 'c', 'a', 'b'].map((k) => dealer.lookFor(k)), ['wall', 'neon', 'wall', 'wall', 'neon']);
});

test('words fit their width', () => {
  for (const word of ['YEP', 'NOPE', 'MATCH'] as const) {
    assert.ok(Math.abs(wordW(word, fitTo(word, 300)) - 300) < 1e-9);
    assert.ok(EM[word] > 1);
  }
});

test('one card size and position for every look: 2:3, centered, capped', () => {
  const z = (n: number) => n;
  const phone = stageGeometry({ aw: 358, stageH: 620, vw: 390, phone: true, z });
  assert.equal(phone.w, 322);
  assert.equal(phone.h, 483);
  assert.equal(phone.cardTop, (620 - 483) / 2);
  assert.equal(phone.ext, 16);
  assert.ok(Math.abs(phone.threshold - 322 * 0.33) < 1e-9);
  const desk = stageGeometry({ aw: 1100, stageH: 640, vw: 1280, phone: false, z });
  assert.equal(desk.h, 640);
  assert.ok(Math.abs(desk.w - 640 / 1.5) < 1e-9);
  assert.equal(desk.cardTop, 0);
  assert.equal(desk.ext, 90);
  const tall = stageGeometry({ aw: 1100, stageH: 2000, vw: 1280, phone: false, z });
  assert.equal(tall.h, 1280 * 0.34 * 1.5);
  const empty = stageGeometry({ aw: 0, stageH: 0, vw: 390, phone: true, z });
  assert.equal(empty.w, 0);
  assert.equal(empty.h, 0);
});

test("the stage's rim takes the backdrop's colors where the stage sits in the frame", () => {
  // Stage 0…1000 of a 1000 px frame: the backdrop's first and last stops, opaque at the edge, clear 6 % in.
  const full = stageRim(0, 1000, 1000)!;
  assert.deepEqual(full.top, ['rgba(23, 20, 14, 1)', 'rgba(22, 19, 14, 0.5)', 'rgba(21, 19, 14, 0)']);
  assert.equal(full.bottom[2], 'rgba(7, 7, 7, 1)');
  assert.equal(full.bottom[0], 'rgba(7, 7, 8, 0)');
  // A stage 450 px down: its top edge is the backdrop's middle stop.
  assert.equal(stageRim(450, 400, 1000)!.top[0], 'rgba(11, 11, 14, 1)');
  // Not placed yet: no rim (the burst keeps its mask).
  assert.equal(stageRim(0, 0, 1000), null);
  assert.equal(stageRim(0, 500, 0), null);
});
