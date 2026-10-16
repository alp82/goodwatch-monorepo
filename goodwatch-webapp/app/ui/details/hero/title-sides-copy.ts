// Every word members read in the title page's Sides of you line (TitleSidesLine), in one place: the owner is still
// choosing the plain-English wording for "side" and "just past" (#672), so these are placeholders until then. Side and
// edge names wait on the words gate (#656) and arrive from the server only when it's on; mood names stay off the
// Watch next link until then.

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** "Se7en, Zodiac and Prisoners". */
const list = (titles: string[]) =>
	titles.length < 2
		? (titles[0] ?? "")
		: `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`

const share = (n: number) => `${Math.round(n * 100)}% of what you love`

export const TITLE_SIDES_COPY = {
	/** Names the line for assistive technology. */
	label: "Where this title sits in your Taste",
	/** Over the line's sentence. */
	eyebrow: "In your Taste",
	/** On a side. */
	on: (name: string | null) =>
		name ? `On your ${lowerFirst(name)} side` : "On one of your sides",
	/** Just past a side: in a place or a step just past it. `tail` follows the side's name: "from South Korea". */
	edge: (name: string | null, tail: string | null) =>
		name && tail
			? `Like your ${lowerFirst(name)} side, but ${tail.replace(/^but /, "")}`
			: "Just past one of your sides",
	/** Between two sides. */
	between: (name: string | null, other: string | null) =>
		name && other
			? `Between two of your sides: ${lowerFirst(name)} and ${lowerFirst(other)}`
			: "Between two of your sides",
	/** Under "on": the closest loved titles and the side's share. */
	onDetail: (near: string[], sideShare: number) =>
		near.length ? `With ${list(near)} · ${share(sideShare)}` : share(sideShare),
	/** Under "just past". */
	edgeDetail: (near: string[]) =>
		near.length
			? `Near ${list(near)}, somewhere you've barely tried`
			: "Somewhere you've barely tried",
	/** Under "between": the closest loved titles of each side. */
	betweenDetail: (near: string[], other: string[]) =>
		`Near ${list(near)}, and near ${list(other)}`,
	/** Opens Watch next with the side's moods. */
	watchNext: "Watch next from this side",
	poster: (title: string) => `Poster for ${title}`,
}
