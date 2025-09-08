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
	// fingerprint: {
	// 	id: "fingerprint",
	// 	label: "Fingerprint",
	// },
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
}

export type SectionIds = keyof typeof sections
