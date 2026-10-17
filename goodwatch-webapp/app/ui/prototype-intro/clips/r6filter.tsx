// PROTOTYPE - throwaway. Round 6, chapter 6 (filters): "From everything to tonight." refined from round 4's
// filters-narrow and round 5's filters-tally, as the owner asked: the big number, much bigger posters, much clearer
// filters. Lengths follow narrow.tsx's timeline for the tonight path (5 steps, Not seen yet second).
import type { Clip } from "../clip"
import { FilterFirst, NumberLeft, NumberOver } from "./r6filter/layouts"
import "./r6filter.css"

export const CLIPS: Clip[] = [
	{
		id: "filters-r6-left",
		section: "filters",
		name: "Number left, big posters right",
		ms: 12350,
		note: "The big falling number on the left; the filters as big switches that turn on one by one above four big posters. Removed titles drop out, the rest slide over.",
		C: NumberLeft,
	},
	{
		id: "filters-r6-over",
		section: "filters",
		name: "Number over a row of big posters",
		ms: 12850,
		note: "Each filter is called out huge in amber as it switches on, over a full-width row of six big posters; the number and its meaning sit between the switches and the posters.",
		C: NumberOver,
	},
	{
		id: "filters-r6-panel",
		section: "filters",
		name: "Filter first: a panel of switches",
		ms: 12350,
		note: "A settings-style panel of large switches turns on one at a time; the big number and three huge posters answer each one.",
		C: FilterFirst,
	},
]
