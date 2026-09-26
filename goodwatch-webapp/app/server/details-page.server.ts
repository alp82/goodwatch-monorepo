// The details payload a movie or show page sends to the browser. The page's loader data is
// serialised twice into the HTML (the render and the hydration context) and again on every
// client navigation, so it keeps only what the page reads. Everything the page renders, its
// meta tags and its structured data stay exactly as they are with the full details.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { CREW_ROLES } from "~/ui/details/Crew"
import { featuredTropes } from "~/ui/details/titleQuestions"

// Actors the page's structured data lists, whether or not they have a photo (see utils/meta.ts).
const STRUCTURED_DATA_ACTORS = 5

// The crew jobs the page's structured data lists (see utils/meta.ts).
const STRUCTURED_DATA_CREW_JOBS = new Set(["Director", "Original Music Composer", "Executive Producer"])
const CREW_JOBS = new Set<string>([...Object.values(CREW_ROLES).map((r) => r.job), ...STRUCTURED_DATA_CREW_JOBS])
const CREW_DEPARTMENTS = new Set<string>(Object.values(CREW_ROLES).map((r) => r.department))

export const detailsPagePayload = <T extends MovieResult | ShowResult>(
	media: T & { availability_evidence?: unknown },
): T => {
	const page: T & { availability_evidence?: unknown } = { ...media }
	// The page reads offers from streaming_availabilities; the evidence is for /api/watchability.
	// An undefined key is left out of the JSON.
	page.availability_evidence = undefined
	page.details = {
		...media.details,
		tropes: featuredTropes(media),
		tropes_count: media.details.tropes?.length ?? 0,
	}
	// The cast carousel shows actors with a photo; the structured data takes the first few.
	page.actors = (media.actors ?? [])
		.filter((actor, index) => actor.profile_path || index < STRUCTURED_DATA_ACTORS)
		.map(({ id, name, character, profile_path, order_default }) => ({ id, name, character, profile_path, order_default }))
	page.crew = (media.crew ?? [])
		.filter((member) => CREW_JOBS.has(member.job) || CREW_DEPARTMENTS.has(member.department))
		.map(({ episode_count_job: _count, ...member }) => member)
	// Only the first backdrop is read, for the social image.
	page.images = { backdrops: (media.images?.backdrops ?? []).slice(0, 1), logos: [], posters: [] }
	return page
}
