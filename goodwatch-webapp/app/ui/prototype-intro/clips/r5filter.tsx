// PROTOTYPE - throwaway. Round 5 intro clips, group "r5filter": chapter 6, filters. Real Discover counts for a
// guest's two services, narrowed by Not seen yet (an example member), a mood, the country's age rating and the score.
import type { Clip } from "../clip"
import { Evenings, Tally, Trade, Unseen } from "./r5filter/clips"
import "./r5filter.css"

export const CLIPS: Clip[] = [
	{
		id: "filters-evenings",
		section: "filters",
		name: "Three evenings, three lists",
		ms: 10500,
		note: "Exploration: Tonight, Family night and Date night narrow side by side, each its own way, ending on three posters each.",
		C: Evenings,
	},
	{
		id: "filters-unseen",
		section: "filters",
		name: "Seen it? It's gone.",
		ms: 12000,
		note: "Leads with Not seen yet: a wall of famous titles, the ones an example member has seen get a Seen stamp and fall out; then mood, age and score.",
		C: Unseen,
	},
	{
		id: "filters-trade",
		section: "filters",
		name: "Number and grid trade places",
		ms: 16500,
		note: "Each filter lands full screen with its huge number, then steps aside for the posters it leaves. Ends on the answer, big and amber.",
		C: Trade,
	},
	{
		id: "filters-tally",
		section: "filters",
		name: "Big number, small posters",
		ms: 12000,
		note: "The liked big number on the left counts down as chips switch on; a grid of small famous posters narrows beside it. Real counts from your two services.",
		C: Tally,
	},
]
