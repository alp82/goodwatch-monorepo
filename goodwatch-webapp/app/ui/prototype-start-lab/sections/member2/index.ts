// PROTOTYPE (start page lab, round 2): the "member2" section's variants, in bar order. Each lives in its own file.
import type { BlockVariant } from "../../lab/types"
import { variant as a } from "./a"
import { variant as b } from "./b"
import { variant as c } from "./c"
import { variant as d } from "./d"

export const VARIANTS: BlockVariant[] = [a, b, c, d]
