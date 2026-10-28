// PROTOTYPE (Discover lab): the "people" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { PeopleA } from "./a"
import { PeopleB } from "./b"
import { PeopleC } from "./c"
import { PeopleD } from "./d"
import { PeopleE } from "./e"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Faces follow the bar", View: PeopleA },
	{ key: "b", name: "Split by role", View: PeopleB },
	{ key: "c", name: "Two calm columns", View: PeopleC },
	{ key: "d", name: "Role switch, one list", View: PeopleD },
	{ key: "e", name: "Role lanes of faces", View: PeopleE },
]
