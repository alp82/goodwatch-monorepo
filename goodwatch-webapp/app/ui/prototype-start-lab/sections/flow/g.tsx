// PROTOTYPE (start page lab) · Round 18: opening flow g · "Logo hand-off": c's start, with the boot in the header's
// strip while the page assembles; then the boot's G and "oodWatch" travel and shrink onto the header's wordmark as the
// black fades and the header's other parts show, and the real wordmark takes over where they land.
import type { BlockVariant } from "../../lab/types"
import { STRIP_BASE } from "./f"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = { ...STRIP_BASE, key: "g", strip: "logo" }

export const variant: BlockVariant = { key: "g", name: "Logo hand-off", C: () => <OpeningFlow spec={SPEC} /> }
