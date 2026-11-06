// Which of At a glance's rows a title has, in order, and their names: pure, so the rail's gist and find know the rows
// without rendering them (glance-rows.tsx renders them).
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { contentSummary } from "./content"

type Media = MovieResult | ShowResult

export type GlanceRowId =
	| "glance-facts"
	| "glance-awards"
	| "glance-content"
	| "glance-cast"
	| "glance-crew"

export const GLANCE_LABEL: Record<GlanceRowId, string> = {
	"glance-facts": "Facts",
	"glance-awards": "Awards",
	"glance-content": "Content",
	"glance-cast": "Starring",
	"glance-crew": "Made by",
}

/**
 * The rows the title's data gives it: Facts always, Awards with a reported result, Content with a rating or
 * advisories, then the people.
 */
export function glanceRowIds(
	media: Media,
	country: string,
	questions: TitleQuestion[],
): GlanceRowId[] {
	return [
		"glance-facts" as const,
		...(media.award_results?.length ? ["glance-awards" as const] : []),
		...(contentSummary(media, country, questions)
			? ["glance-content" as const]
			: []),
		...(media.cast?.length ? ["glance-cast" as const] : []),
		...(media.crew.directors.length || media.mediaType === "show"
			? ["glance-crew" as const]
			: []),
	]
}

/** The rows' names, for the rail's gist and find. */
export const glanceRowLabels = (
	media: Media,
	country: string,
	questions: TitleQuestion[],
) => glanceRowIds(media, country, questions).map((id) => GLANCE_LABEL[id])

/** One request for the whole crew list (the API's largest page); the sub-page's loader fills the same one. */
export const CREW_PAGE_SIZE = 200

/** Made by's people per department before it opens in place (CrewCredits). */
export const DEPARTMENT_SHOWS = 6
