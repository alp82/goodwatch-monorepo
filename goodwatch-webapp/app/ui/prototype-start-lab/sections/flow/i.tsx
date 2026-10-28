// PROTOTYPE (start page lab) · Round 18: opening flow i · "Quiet": c's start, with a small boot inside the header's
// strip while the page assembles; then it crossfades into the header with a slight lift (the header's parts rise into
// place), and the search field glows once (round 17 e's glow).
import type { BlockVariant } from "../../lab/types"
import { STRIP_BASE } from "./f"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = { ...STRIP_BASE, key: "i", strip: "quiet" }

export const variant: BlockVariant = { key: "i", name: "Quiet", C: () => <OpeningFlow spec={SPEC} /> }
