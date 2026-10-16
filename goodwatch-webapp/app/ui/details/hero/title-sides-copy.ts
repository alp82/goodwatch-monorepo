// Every word members read in the title page's taste group line (TitleSidesLine), in one place. The owner's wording
// (#672, 2026-10-16): members read "taste", never "side". The group's name is its traits, and a badge says how the
// title fits: "Fits your taste" in a group, "Close to your taste" near one or between two. Between two groups the line
// is always short, one trait from each ("Between dark and psychedelic"), and a line too long for a phone falls back
// to the name's leading trait and noun there ("Dark stories, from France"). Group names are descriptive, so they wait
// on the words gate (#656) and arrive from the server only when it's on; without them the line is the posters and the
// badge. Mood names stay off the Watch next link until then.
import type { ShortName } from "~/server/taste-portrait/group-names.server"
import type { TitleSides } from "~/server/title-sides.server"

/** Past this many characters, a phone shows the short line instead: about two lines next to the posters. */
export const PHONE_CHARS = 32

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/** The name and what sets this title apart: "Dark, tense crime, from South Korea". */
const withTail = (name: string, tail: string | null) =>
	tail ? `${name}, ${tail}` : name
/** The leading trait and the noun: "Dark thrillers". */
const shortName = ({ traits, noun }: ShortName) =>
	`${capitalize(traits[0])} ${noun}`

/**
 * Between two groups, one trait from each: the leading ones, "Between dark and psychedelic", with the noun when both
 * groups share it ("Between dark and psychedelic stories"). When both lead with the same trait, their second traits
 * ("Between tense and gripping crime"), else each keeps its noun ("Between dark crime and dark thrillers"); with
 * nothing short to tell them apart, their full names.
 */
export function betweenLine(
	a: { name: string | null; short: ShortName | null },
	b: { name: string | null; short: ShortName | null },
): string | null {
	if (a.short && b.short) {
		const [x, y] = [a.short, b.short]
		const noun = x.noun === y.noun ? ` ${x.noun}` : ""
		if (x.traits[0] !== y.traits[0])
			return `Between ${x.traits[0]} and ${y.traits[0]}${noun}`
		if (x.traits[1] && y.traits[1] && x.traits[1] !== y.traits[1])
			return `Between ${x.traits[1]} and ${y.traits[1]}${noun}`
		if (x.noun !== y.noun)
			return `Between ${x.traits[0]} ${x.noun} and ${y.traits[0]} ${y.noun}`
	}
	return a.name && b.name
		? `Between ${lowerFirst(a.name)} and ${lowerFirst(b.name)}`
		: null
}

/**
 * The line's sentence, and the shorter one a phone shows instead when it runs past PHONE_CHARS (null: the same on
 * every screen). Null text: no names, so the posters and the badge say it.
 */
export function titleSidesText(sides: TitleSides): {
	text: string | null
	phone: string | null
} {
	const { side, other } = sides
	if (sides.edge === "between" && other)
		return { text: betweenLine(side, other), phone: null }
	if (!side.name) return { text: null, phone: null }
	const tail = sides.at === "edge" ? sides.edgeTail : null
	const text = withTail(side.name, tail)
	if (text.length <= PHONE_CHARS || !side.short) return { text, phone: null }
	const phone = withTail(shortName(side.short), tail)
	return { text, phone: phone.length < text.length ? phone : null }
}

export const TITLE_SIDES_COPY = {
	/** Names the line for assistive technology. */
	label: "Where this title sits in your taste",
	/** The badge for a title in one of the member's groups. */
	fits: "Fits your taste",
	/** The badge for a title near a group, or between two. */
	close: "Close to your taste",
	/** Opens Watch next with the group's moods. */
	watchNext: "Open in Watch next",
	poster: (title: string) => `Poster for ${title}`,
}
