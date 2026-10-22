// The phone's title overview has room for two lines of its synopsis (screens/Title.tsx). Pure, so it has tests.

/**
 * A short synopsis for the phone's overview: its first sentence where that is short enough, else as many whole
 * words as fit `max` characters, with an ellipsis. Two lines of the phone's canvas hold about 90.
 */
export function shortSynopsis(text: string, max = 88): string {
	const clean = text.replace(/\s+/g, " ").trim()
	if (clean.length <= max) return clean
	const sentence = clean.match(/^.+?[.!?](?=\s|$)/)?.[0]
	if (sentence && sentence.length <= max) return sentence
	const cut = clean.slice(0, max - 1)
	const space = cut.lastIndexOf(" ")
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\u2014-]+$/, "")}…`
}
