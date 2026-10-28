// PROTOTYPE (start page lab) · Round 17: opening flow c · "Step by step": the boot's glow hands over to the room, and
// the search block waits alone in the middle of the screen over a nearly black room seen close up. The first search
// slides it up to its place and the card in; each loved title lights the room a little more and pulls the camera
// back; For you shows the room fully lit at its normal framing.
import type { BlockVariant } from "../../lab/types"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = {
	key: "c",
	handoff: "glow",
	card: "after",
	center: true,
	bootDim: 1,
	bootCam: 1.14,
	dim: (step, s) => (step === 0 ? 0.94 : step === 1 ? Math.max(0.16, (s.moody ? 0.42 : 0.55) - s.loved * 0.12) : 0),
	cam: (step, s) => (step === 0 ? 1.12 : step === 1 ? 1.07 - s.loved * 0.017 : 1),
}

export const variant: BlockVariant = { key: "c", name: "Step by step", C: () => <OpeningFlow spec={SPEC} /> }
