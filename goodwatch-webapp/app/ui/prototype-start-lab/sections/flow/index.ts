// PROTOTYPE (start page lab) · Round 17: the "Opening flow" section's variants: none (today's page) first, then the
// boot screen into the page (a), search first (b), step by step (c), ask and answer (d), the TV handing off (e).
import type { BlockVariant } from "../../lab/types"
import { variant as a } from "./a"
import { variant as b } from "./b"
import { variant as c } from "./c"
import { variant as d } from "./d"
import { variant as e } from "./e"
import { variant as none } from "./none"

export const VARIANTS: BlockVariant[] = [none, a, b, c, d, e]
