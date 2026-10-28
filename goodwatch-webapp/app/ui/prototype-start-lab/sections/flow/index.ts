// PROTOTYPE (start page lab) · Round 17: the "Opening flow" section's variants: none (today's page) first, then the
// boot screen into the page (a), search first (b), step by step (c), ask and answer (d), the TV handing off (e).
// Round 18: c's start with the boot in the header's strip, handing over to the header: TV off (f), logo (g), glow
// sweep (h), quiet (i). Round 19: a big boot above the search with the header sliding in (j, the default), g's
// hand-off without travel (k), i with j's slide-in header (l).
import type { BlockVariant } from "../../lab/types"
import { variant as a } from "./a"
import { variant as b } from "./b"
import { variant as c } from "./c"
import { variant as d } from "./d"
import { variant as e } from "./e"
import { variant as f } from "./f"
import { variant as g } from "./g"
import { variant as h } from "./h"
import { variant as i } from "./i"
import { variant as j } from "./j"
import { variant as k } from "./k"
import { variant as l } from "./l"
import { variant as none } from "./none"

export const VARIANTS: BlockVariant[] = [none, a, b, c, d, e, f, g, h, i, j, k, l]
