// Every word members read in the title page's taste group line (TitleSidesLine), in one place. The owner's wording
// (#672, 2026-10-16): members read "taste", never "side". The group's name is its traits, and a badge says how the
// title fits: "Fits your taste" in a group, "Close to your taste" near one or between two. Group names are
// descriptive, so they wait on the words gate (#656) and arrive from the server only when it's on; without them the
// line is the posters and the badge. Mood names stay off the Watch next link until then.

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export const TITLE_SIDES_COPY = {
	/** Names the line for assistive technology. */
	label: "Where this title sits in your taste",
	/** The badge for a title in one of the member's groups. */
	fits: "Fits your taste",
	/** The badge for a title near a group, or between two. */
	close: "Close to your taste",
	/** In a group: the group's name, "Bleak, tense stories". */
	on: (name: string | null) => name,
	/** Near a group: its name and what sets this title apart, "Bleak, tense stories, from South Korea". */
	edge: (name: string | null, tail: string | null) =>
		name && tail ? `${name}, ${tail}` : name,
	/** Between two groups. */
	between: (name: string | null, other: string | null) =>
		name && other
			? `Between ${lowerFirst(name)} and ${lowerFirst(other)}`
			: null,
	/** Opens Watch next with the group's moods. */
	watchNext: "Open in Watch next",
	poster: (title: string) => `Poster for ${title}`,
}
