/** Prefer these jobs; use the department only when none of these jobs is credited. */
export const CREW_ROLES = {
	directors: { jobs: ["Director"], department: "Directing" },
	writers: {
		jobs: ["Writer", "Screenplay", "Story", "Novel"],
		department: "Writing",
	},
	producers: { jobs: ["Producer"], department: "Production" },
	composers: {
		jobs: ["Original Music Composer", "Music"],
		department: "Sound",
	},
} as const
