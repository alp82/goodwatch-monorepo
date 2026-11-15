// Made for the GoodWatch footer cinema: after the credits: the rapid-fire trivia montage that opens the stinger,
// full screen: every fact cut hard into its own world, a different transition at every cut. See _montage.js.
import { drawFacts, durationFor, FACTS } from "./_montage.js";

export const meta = {
  name: "After the credits",
  desc: "A post-credits trivia montage: six real numbers slam in one after another on rolling digits, each with a hit, sparks and a flourish, each cut a different pixel transition.",
  tags: ["cinema", "screen", "trivia", "montage", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: durationFor(FACTS.length),
  loop: false,
  fps: 30,
  bg: "dark",
  options: { seed: 7, w: 288, h: 120, facts: FACTS },
};

export function draw(p, t, o) {
  drawFacts(p, t, o, meta.duration);
}
