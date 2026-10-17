// PROTOTYPE - throwaway. Round 7, chapter 6 (filters): the owner's pick, filters-r6-panel, refined: no filters at
// the start (every movie and show), Discover's colours per filter, Not seen yet like any other switch, and a score
// switch that counts up 60+ → 70+ → 80+ and takes posters away at each step.
import type { Clip } from "../clip"
import { FilterPanel } from "./r7filter/panel"
import "./r7filter.css"

export const CLIPS: Clip[] = [
	{
		id: "filters-r7-panel",
		section: "filters",
		name: "Panel in Discover's colours, from every title",
		ms: 13750,
		note: "Starts with no filter: every movie and show. Each switch lights in its Discover colour (services emerald, Not seen yet blue, the mood's hue, age amber, the score's vibe colour); the score counts 60+ → 70+ → 80+ and each threshold drops a real poster.",
		C: FilterPanel,
	},
]
