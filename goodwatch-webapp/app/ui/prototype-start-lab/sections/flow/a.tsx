// PROTOTYPE (start page lab) · Round 17: opening flow a · "Boot, then the page": the old TV's boot screen full screen,
// a fade through black, and today's whole stage m (search, mood, card) under a room that settles in (dark → lit, the
// camera easing back from 1.08).
import type { BlockVariant } from "../../lab/types"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = {
	key: "a",
	handoff: "fade",
	card: "always",
	bootDim: 1,
	bootCam: 1.08,
	dim: () => 0,
	cam: () => 1,
}

export const variant: BlockVariant = { key: "a", name: "Boot, then the page", C: () => <OpeningFlow spec={SPEC} /> }
