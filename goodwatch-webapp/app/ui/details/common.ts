export const sections = {
	about: {
		id: "about",
		label: "About",
	},
	crew: {
		id: "crew",
		label: "Crew",
	},
	cast: {
		id: "cast",
		label: "Cast",
	},
	dna: {
		id: "dna",
		label: "DNA",
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
