// How a title plays a trope, read from the first words of its TV Tropes write-up. A write-up that bends the trope says
// so up front ("Subverted: …", "Averted when …"); anything else plays it straight. Pure: loader and browser.

export type Play =
	| "straight"
	| "subverted"
	| "inverted"
	| "averted"
	| "lampshaded"
	| "exaggerated"
	| "downplayed"
	| "played-with"

export const PLAY_IDS: readonly Play[] = [
	"straight",
	"subverted",
	"inverted",
	"averted",
	"lampshaded",
	"exaggerated",
	"downplayed",
	"played-with",
]

const PLAY_WORDS: [RegExp, Play][] = [
	[/^(?:double[- ]?|partially |somewhat |briefly )?subvert/i, "subverted"],
	[/^(?:partially |somewhat )?invert/i, "inverted"],
	[/^(?:partially |somewhat |mostly )?avert/i, "averted"],
	[/^(?:lampshaded|lampshade)/i, "lampshaded"],
	[/^exaggerat/i, "exaggerated"],
	[/^downplay/i, "downplayed"],
	[/^(?:played with|zig[- ]?zag|deconstruct|parodied|discussed|defied|justified)/i, "played-with"],
]

/** How a write-up's opening (plain text, not HTML) says it plays the trope. */
export function playOf(text: string): Play {
	const head = text.trim().replace(/^[\s"'“(]+/, "")
	for (const [re, play] of PLAY_WORDS) if (re.test(head)) return play
	return "straight"
}

export const isPlay = (value: unknown): value is Play =>
	typeof value === "string" && (PLAY_IDS as readonly string[]).includes(value)
