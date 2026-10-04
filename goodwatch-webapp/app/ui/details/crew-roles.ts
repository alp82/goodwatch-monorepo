/** The job and department of each crew line. A crew member shows when either matches. */
export const CREW_ROLES = {
	directors: { job: "Director", department: "Directing" },
	writers: { job: "Writer", department: "Writing" },
	producers: { job: "Producer", department: "Production" },
	composers: { job: "Original Music Composer", department: "Sound" },
} as const
