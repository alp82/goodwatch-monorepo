// PROTOTYPE - throwaway (prototype/explore-r5, slot "mood"). What each element of the mood-page variants means.
import type { Note } from "../../../../kit/contract"

const SHARED: Note[] = [
	{
		term: "Steering",
		means:
			"Every way to tailor the list, beside it: the mood's own dial, which kind, the direction dials, from when, from where. The lab's Steering pill switches how the column looks and opens (Steer rows, Build up). On a phone the ways to steer are a strip of chips over the grid.",
		isNew: true,
	},
	{
		term: "Same height",
		means:
			"The steering column and the list are one block, one screen tall. The grid holds as many whole rows as fit that height at any width; Prev and Next step on by that many, so there are no page numbers.",
		isNew: true,
	},
	{
		term: "Pills over the grid",
		means:
			"Whatever is set (a kind, a dial, a decade, a country) also shows as a white pill right over the grid, where it acts. The cross takes it off; Clear takes them all off.",
		isNew: true,
	},
	{
		term: "From when, from where",
		means:
			"The decades as bars as tall as their share of this list (drag across them or tap one) and the countries with the most titles here as their shapes. Both narrow the list without leaving the page (?when=, ?from=).",
		isNew: true,
	},
	{
		term: "Dials",
		means:
			"How much of the mood's own trait (a touch to all the way, in its color), then lighter or darker, calm or intense, real or fantastic. Under each: the mood further that way, and Keep going at the end.",
	},
	{
		term: "Lattice",
		means:
			"Where the mood sits among the moods: lighter to darker across, calmer to more intense down. Folded it is a glyph of sixteen dots beside About; each dot grows into its cell when the head unfolds.",
	},
]

const OWN: Record<string, Note[]> = {
	"grid-first": [
		{
			term: "Band",
			means:
				"The head folded: the mood's color, its name, one human line and three feel words. About unfolds it into the room (lede, ways onward, lattice, what sets it apart) and the page glides down.",
		},
	],
}

export const moodNotes = (id: string) => (): Note[] => [...(OWN[id] ?? []), ...SHARED]
