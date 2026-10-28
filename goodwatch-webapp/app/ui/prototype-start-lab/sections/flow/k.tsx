// PROTOTYPE (start page lab) · Round 19: opening flow k · "Logo hand-off, calm": g without the travel (the owner: "the
// moving to the left is not the best thing because it grabs attention"). The boot plays in the header's strip; then
// its wordmark fades and shrinks a little in place while the black fades, and the header's own wordmark fades in a
// beat later (boot-strip "fade").
import type { BlockVariant } from "../../lab/types"
import { STRIP_BASE } from "./f"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = { ...STRIP_BASE, key: "k", strip: "fade" }

export const variant: BlockVariant = { key: "k", name: "Logo hand-off, calm", C: () => <OpeningFlow spec={SPEC} /> }
