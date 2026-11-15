// What the footer cinema plays, in order: the pre-show (silence your phone, the countdown), three GoodWatch idents each
// before a trailer, the trivia montage and its stinger, then the end credits. The last three need the catalog's
// numbers: without them the show ends after the third trailer.
import type { CinemaText } from "./numbers"
import type { FxId } from "./pixelfx/show.js"

export interface Scene {
	kind: "scene"
	/** The effect's pixelfx id. */
	fx: FxId
	/** What the bar under the screen says. */
	label: string
	/** Read out to screen readers instead of the label. */
	say?: string
	/** Reduced motion: the moments (seconds into the effect) shown as stills, one after another. */
	stills: number[]
	/** No film grain over it. */
	clean?: boolean
	/** Runs straight into the next segment, with no black between. */
	flow?: boolean
	/** Options for the effect: the montage's numbers. */
	opts?: Record<string, unknown>
	/** The montage and the stinger: their words for screen readers, and a link to /stats in the bar. */
	numbers?: "montage" | "finale"
}

export interface Credits {
	kind: "credits"
	label: string
}

export type Segment = Scene | Credits

const OPENING: Segment[] = [
	{
		kind: "scene",
		fx: "cinema-show/silence-phone",
		label: "Before the show",
		say: "Please silence your phone",
		stills: [3.5],
	},
	{
		kind: "scene",
		fx: "cinema-show/leader",
		label: "Countdown",
		stills: [2.2],
	},
	{
		kind: "scene",
		fx: "cinema-show/ident-a",
		label: "GoodWatch Pictures",
		say: "GoodWatch Pictures presents",
		stills: [5],
	},
	{
		kind: "scene",
		fx: "cinema-show/trailer-chase",
		label: "Coming attractions: Midnight Mile",
		stills: [6],
	},
	{
		kind: "scene",
		fx: "cinema-show/ident-b",
		label: "GoodWatch presents",
		say: "GoodWatch presents",
		stills: [5],
	},
	{
		kind: "scene",
		fx: "cinema-show/trailer-space",
		label: "Coming attractions: Iron Nebula",
		stills: [7],
	},
	{
		kind: "scene",
		fx: "cinema-show/ident-c",
		label: "GoodWatch presents",
		say: "GoodWatch presents",
		stills: [5],
	},
	{
		kind: "scene",
		fx: "cinema-show/trailer-monster",
		label: "Coming attractions: The Harbor Beast",
		stills: [7],
	},
]

export function programFor(text: CinemaText | null): Segment[] {
	if (!text) return OPENING
	return [
		...OPENING,
		{
			kind: "scene",
			fx: "cinema-show/after-credits",
			label: "GoodWatch in numbers",
			clean: true,
			flow: true,
			opts: { facts: text.facts },
			numbers: "montage",
			// each fact, fully typed
			stills: [0.6, 2.5, 4.3, 6.1, 7.9, 9.7, 11.5],
		},
		{
			kind: "scene",
			fx: "cinema-show/after-credits-end",
			label: "Thanks for watching",
			clean: true,
			opts: { finale: text.finale },
			numbers: "finale",
			stills: [3.9],
		},
		{ kind: "credits", label: "End credits" },
	]
}
