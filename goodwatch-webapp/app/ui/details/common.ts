export const sections = {
	overview: {
		id: "overview",
		label: "Overview",
	},
	about: {
		id: "about",
		label: "About",
	},
	dna: {
		id: "dna",
		label: "DNA",
	},
	crew: {
		id: "crew",
		label: "Crew",
	},
	cast: {
		id: "cast",
		label: "Cast",
	},
	ratings: {
		id: "ratings",
		label: "Ratings",
	},
	streaming: {
		id: "streaming",
		label: "Streaming",
	},
	videos: {
		id: "videos",
		label: "Videos",
	},
}

export type SectionIds = keyof typeof sections
