// Made for the GoodWatch footer cinema: the stinger after the trivia montage: THANKS FOR WATCHING drops in letter by
// letter, three reel windows spin and lock on 408, YEARS slams in under fireworks, the line under it types on, the G
// pops in and the picture irises closed on it. See _montage.js.
import { drawFinale, FIN, FINALE } from "./_montage.js";

export const meta = {
  name: "After the credits: the end",
  desc: "THANKS FOR WATCHING drops in, a slot reel spins and locks on 408 YEARS under fireworks, the G emblem pops and an iris closes on it.",
  tags: ["cinema", "screen", "finale", "one-shot"],
  size: [288, 120],
  origin: [144, 60],
  duration: FIN,
  loop: false,
  fps: 30,
  bg: "dark",
  options: { seed: 7, w: 288, h: 120, finale: FINALE },
};

export function draw(p, t, o) {
  drawFinale(p, t, o, meta.duration);
}
