// PROTOTYPE - throwaway. Round 8, chapter 6 (filters): round 7's panel opened by the whole catalog and its two
// floors (title analysis, 1,000+ ratings), with posters that never leave the right side empty.
import type { Clip } from "../clip"
import { FilterPanelR8, filterData, lengthOf } from "./r8filter/panel"
import "./r8filter.css"

export const CLIPS: Clip[] = [
	{
		id: "filters-r8-panel",
		section: "filters",
		name: "From the whole catalog to tonight",
		ms: 16500,
		note: "Opens on every title in the catalog (1,497,602), then Read for how it feels (250,955) and Rated by 1,000+ people (61,541, where Discover starts), then services, Not seen yet, Feel-good, age and score. Posters stay until their replacement lands.",
		C: FilterPanelR8,
	},
]
// The real length for this data, for reference while tuning: lengthOf(filterData(data)).
void filterData
void lengthOf
