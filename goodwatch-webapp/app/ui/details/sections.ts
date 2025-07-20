export const sections = {
	overview: {
		id: "overview",
		label: "Overview",
	},
	ratings: {
		id: "ratings",
		label: "Ratings",
	},
	streaming: {
		id: "streaming",
		label: "Streaming",
	},
	// about: {
	// 	id: "about",
	// 	label: "About",
	// },
	fingerprint: {
		id: "fingerprint",
		label: "Fingerprint",
	},
	related: {
		id: "related",
		label: "Related",
	},
	sequels: {
		id: "sequels",
		label: "Sequels",
	},
	crew: {
		id: "crew",
		label: "Crew",
	},
	actors: {
		id: "actors",
		label: "Actors",
	},
	media: {
		id: "media",
		label: "Media",
	},
}

export type SectionIds = keyof typeof sections
