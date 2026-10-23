// The person-to-person match's colour: 1 to 99 spread over the score colours, red to green.
import { vibe } from "./parts"

/** 0 to 1: how strong the match is, for colour and motion. Matches below 40 all read as far apart. */
export const matchStrength = (percent: number) => Math.min(1, Math.max(0, (percent - 40) / 55))
export const matchColor = (percent: number) => vibe(2 + matchStrength(percent) * 8)
