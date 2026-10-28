// PROTOTYPE (start page lab) · Round 17: opening flow b · "Search first": the boot screen's amber glow swells and stays
// as the room's warm light while the black fades; then only the search block (H1, field, presets, mood button) over a
// room that is almost dark. The first search or mood brings the card ("Tap three you loved") and half the room's
// light; a mood lifts it further so its lighting shows; For you lights the room fully. The camera eases in per step.
import type { BlockVariant } from "../../lab/types"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = {
	key: "b",
	handoff: "glow",
	card: "after",
	bootDim: 1,
	bootCam: 1.08,
	dim: (step, s) => (step === 0 ? 0.88 : step === 1 ? (s.moody ? 0.22 : 0.4) : 0.08),
	cam: (step) => (step === 0 ? 1.06 : step === 1 ? 1.03 : 1),
}

export const variant: BlockVariant = { key: "b", name: "Search first", C: () => <OpeningFlow spec={SPEC} /> }
