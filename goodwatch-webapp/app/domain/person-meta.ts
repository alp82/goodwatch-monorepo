// The words of a person page's meta tags. TMDB leaves the department empty for some people, so every text here
// reads well without one.
import { pluralize } from "~/utils/helpers"

export interface PersonMetaInput {
	name: string
	/** TMDB's `known_for_department`, such as "Acting" or "Directing". Missing for some people. */
	department: string | null | undefined
	movies: number
	shows: number
	titles: number
	/** Up to three titles the person is known for. */
	knownFor: string[]
	hasPortrait: boolean
}

export interface PersonMetaText {
	title: string
	description: string
	/** Describes the share card: name, role, title count, and the portrait when there is one. */
	alt: string
	/** For JSON-LD. Undefined without a department, so the property is left out. */
	jobTitle: string | undefined
}

/** Movie and TV show counts in words, leaving out a zero part: "18 movies", "4 movies and 1 TV show". */
export const titleCounts = (movies: number, shows: number) =>
	[
		movies > 0 && pluralize(movies, "movie"),
		shows > 0 && pluralize(shows, "TV show"),
	]
		.filter(Boolean)
		.join(" and ")

export function personMetaText(input: PersonMetaInput): PersonMetaText {
	const { name, movies, shows, titles, knownFor, hasPortrait } = input
	const department = input.department?.trim() || null
	const acting = department === "Acting"
	const work = acting
		? "movies and TV shows"
		: department
			? `${department.toLowerCase()} credits`
			: "credits"
	const role = acting ? "actor" : department?.toLowerCase()
	const counts = titleCounts(movies, shows)
	const top = knownFor.slice(0, 3).join(", ")
	return {
		title: `${name}: ${acting ? "Movies and TV Shows" : "Filmography"} | GoodWatch`,
		description: `${name}'s ${work}${counts ? `: ${counts}` : ""}${top ? `, including ${top}` : ""}. See what their work feels like, who they work with, and their best-rated titles.`,
		alt: `${name} (${role ? `${role}, ` : ""}${titles} titles) on GoodWatch${hasPortrait ? ", with portrait" : ""}`,
		jobTitle: department ?? undefined,
	}
}
