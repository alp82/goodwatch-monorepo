// PROTOTYPE (start page lab) · Round 18: opening flow h · "Glow sweep": c's start, with the boot in the header's strip
// while the page assembles; then an amber glow runs across the strip from left to right and leaves the header behind
// it (a wipe made of two opposite transforms, no clip-path).
import type { BlockVariant } from "../../lab/types"
import { STRIP_BASE } from "./f"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = { ...STRIP_BASE, key: "h", strip: "sweep" }

export const variant: BlockVariant = { key: "h", name: "Glow sweep", C: () => <OpeningFlow spec={SPEC} /> }
