import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSounds } from "../src/features/feedback/sound-controller";
import { roomFeedback } from "../src/features/feedback/room-events";
import { continuousFixture } from "./continuous-fixture";
test("effects stop on mute and cannot replay a queued first deal after a trailer opens", async () => {
  const played: string[] = [];
  let stopped = 0;
  const sound = makeSounds({
    active: () => true,
    play: (n) => {
      played.push(n);
    },
    stop: () => {
      stopped++;
    },
    save: () => undefined,
  });
  sound.dealFirst();
  sound.playFeedback("poster");
  assert.equal(played.length, 1);
  assert.match(played[0], /card-fan-[12]/);
  sound.suspend(true);
  await new Promise((r) => setTimeout(r, 380));
  assert.equal(played.length, 1);
  sound.suspend(false);
  sound.playFeedback("matches");
  sound.playFeedback("matches");
  assert.notEqual(played[1], played[2]);
  sound.setEnabled(false);
  sound.restore(true);
  sound.playFeedback("swipe");
  assert.equal(played.length, 3);
  assert.equal(sound.enabled(), false);
  assert.equal(stopped, 2);
});
test("peer join/leave and fresh decisions have cues; snapshots, private answers and reconnect duplicates do not", () => {
  const a = continuousFixture();
  assert.deepEqual(roomFeedback(undefined, a), []);
  const b = structuredClone(a);
  b.shared.revision++;
  b.shared.participants.push({
    participantId: "friend",
    nickname: "Friend",
    ready: true,
    screenId: "tv",
  });
  assert.deepEqual(roomFeedback(a, b), ["join"]);
  const c = structuredClone(b);
  c.shared.revision++;
  c.own.votes.push({ candidateId: "c1", value: "watch", revision: 1, activeExposureMs: null, timingSource: "unavailable" });
  assert.deepEqual(roomFeedback(b, c), []);
  const d = structuredClone(c);
  d.shared.revision++;
  d.shared.participants[1].dropped = true;
  assert.deepEqual(roomFeedback(c, d), ["leave"]);
  const e = structuredClone(d);
  e.shared.revision++;
  e.shared.phase = "decided";
  assert.deepEqual(roomFeedback(d, e), ["decided"]);
  assert.deepEqual(roomFeedback(e, e), []);
});
