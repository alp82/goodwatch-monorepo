// PROTOTYPE (start page lab) · Round 19: opening flow j · "Big boot, header slides in": c's start (the search block
// alone in the middle over a near-black close room, the page assembling under the boot), with the boot played large in
// the empty room above the search block instead of in the header's strip. When it ends it fades out with a slight
// shrink while the real header slides down into place from above, at the same time (boot-strip "big").
import type { BlockVariant } from "../../lab/types"
import { STRIP_BASE } from "./f"
import { type FlowSpec, OpeningFlow } from "./shell"

const SPEC: FlowSpec = { ...STRIP_BASE, key: "j", strip: "big" }

export const variant: BlockVariant = { key: "j", name: "Big boot, header slides in", C: () => <OpeningFlow spec={SPEC} /> }
