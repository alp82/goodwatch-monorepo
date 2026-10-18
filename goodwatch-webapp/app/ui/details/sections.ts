export const sections = {
	overview: {
		id: "overview",
		label: "Overview",
	},
	// ratings: {
	// 	id: "ratings",
	// 	label: "Ratings",
	// },
	// streaming: {
	// 	id: "streaming",
	// 	label: "Streaming",
	// },
	fingerprint: {
		id: "fingerprint",
		label: "Fingerprint",
	},
	// A show's episode ratings and, for a member, its episode list. Left out of the navigation when the page has none.
	episodes: {
		id: "episodes",
		label: "Episodes",
	},
	about: {
		id: "about",
		label: "About",
	},
	actors_and_crew: {
		id: "actors_and_crew",
		label: "Cast",
	},
	// crew: {
	// 	id: "crew",
	// 	label: "Crew",
	// },
	related: {
		id: "related",
		label: "Related",
	},
	// sequels: {
	// 	id: "sequels",
	// 	label: "Sequels",
	// },
	media: {
		id: "media",
		label: "Media",
	},
	// The questions section. Left out of the navigation when the title has none.
	faq: {
		id: "faq",
		label: "Q&A",
	},
}

export type SectionIds = keyof typeof sections

/** The sections the page's navigation lists: all of them, but Episodes and Q&A only on a page that has them. */
export function navSections(episodes: boolean, questions = true) {
	return Object.values(sections).filter(
		(section) =>
			(episodes || section.id !== "episodes") &&
			(questions || section.id !== "faq"),
	)
}
