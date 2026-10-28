// PROTOTYPE (start page lab) · Round 18: opening flow f · "TV off into the header": c's start (the search block alone
// in the middle over a near-black close room, then the card and the room's light step by step) without the full-screen
// boot: the boot plays in the header's strip while the page assembles under it, then the strip powers down like an old
// TV (round 17 e's power-down, here onto a line across the strip) and the header opens out of that line.
import type { BlockVariant } from "../../lab/types"
import { C_SPEC } from "./c"
import { type FlowSpec, OpeningFlow } from "./shell"

/** Round 18: f-i share c's steps; the room starts a touch lighter (0.9, was 0.94) so its fade up from black shows. */
export const STRIP_BASE: FlowSpec = {
	...C_SPEC,
	center: false,
	dim: (step, s) => (step === 0 ? 0.9 : C_SPEC.dim(step, s)),
}

const SPEC: FlowSpec = { ...STRIP_BASE, key: "f", strip: "tv" }

export const variant: BlockVariant = { key: "f", name: "TV off into the header", C: () => <OpeningFlow spec={SPEC} /> }
