// PROTOTYPE (start page lab) · Round 19: opening flow l · "Quiet, header slides in": i (the owner: "i not bad
// actually") with j's hand-off: the small boot in the header's place, no black strip; it fades while the header slides
// down over its place, then the search field glows once (boot-strip "slide").
import type { BlockVariant } from "../../lab/types"
import { STRIP_BASE } from "./f"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = { ...STRIP_BASE, key: "l", strip: "slide" }

export const variant: BlockVariant = { key: "l", name: "Quiet, header slides in", C: () => <OpeningFlow spec={SPEC} /> }
