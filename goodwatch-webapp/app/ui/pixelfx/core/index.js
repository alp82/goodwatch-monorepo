// pixelfx core, trimmed to what the app's effects import (the explorer map, /stats and the footer cinema each re-export
// it from their own pixelfx/core/index.js). The files next to this one are copied from https://github.com/patch-gg/pixelfx
// (MIT, see ../LICENSE.md), unchanged but for the two notes there; acts, rigs and scenes are left out.

export * from "./math.js";
export * from "./color.js";
export * from "./particles.js";
export * from "./shapes.js";
export { Particles, Bits, Lights, Blazes, P, PF, B, GRAVITY, FIRE_RAMP, SMOKE_RAMP, sparkle, flare, band, crystal } from "./sim.js";
export { Painter } from "./painter.js";
export { FONTS, textWidth } from "./font.js";
export { createFrame, clearFrame, createFx, composite, painterFor, resolveOptions } from "./fx.js";
