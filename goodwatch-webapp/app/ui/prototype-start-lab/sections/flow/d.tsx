// PROTOTYPE (start page lab) · Round 17: opening flow d · "Ask and answer": three questions take turns in one place,
// with a step indicator and Back: "What are you in the mood for?" (the search block), "Which of these did you love?"
// (the card fades in where the search block was, which fades out), "Here's what to watch" (the card's For you). A fade
// through black from the boot; the room lightens with each answer.
import type { BlockVariant } from "../../lab/types"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = {
	key: "d",
	handoff: "fade",
	card: "swap",
	bootDim: 1,
	bootCam: 1.06,
	dim: (step, s) => (step === 0 ? 0.72 : step === 1 ? (s.moody ? 0.3 : 0.45) : 0.12),
	cam: (step) => (step === 0 ? 1.04 : step === 1 ? 1.02 : 1),
}

export const variant: BlockVariant = { key: "d", name: "Ask and answer", C: () => <OpeningFlow spec={SPEC} /> }
