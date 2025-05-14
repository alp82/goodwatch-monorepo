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
	about: {
		id: "about",
		label: "About",
	},
	dna: {
		id: "dna",
		label: "DNA",
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
	cast: {
		id: "cast",
		label: "Cast",
	},
	media: {
		id: "media",
		label: "Media",
	},
}

export type SectionIds = keyof typeof sections
