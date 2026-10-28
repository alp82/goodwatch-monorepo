// PROTOTYPE (start page lab) · Round 17: opening flow e · "TV hands off" (bolder): the boot screen powers down like an
// old TV, but onto the search field: the black screen shrinks into the field's box and the field glows once. The room
// around it starts dim; the first search or mood brings the card and the room's light, For you lights it fully.
import type { BlockVariant } from "../../lab/types"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = {
	key: "e",
	handoff: "collapse",
	card: "after",
	bootDim: 0.9,
	bootCam: 1.05,
	dim: (step, s) => (step === 0 ? 0.7 : step === 1 ? (s.moody ? 0.18 : 0.32) : 0),
	cam: (step) => (step === 0 ? 1.04 : step === 1 ? 1.02 : 1),
}

export const variant: BlockVariant = { key: "e", name: "TV hands off", C: () => <OpeningFlow spec={SPEC} /> }
