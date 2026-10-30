// The Search tab's rules without React: how a title steers the list (Like this, More like, Less like), how a person
// pick toggles, how many rows a group shows and what its More line says, and the Try prompts.
import type { FilterState } from "~/domain/filter-state"
import type { TitleKey } from "~/utils/title-key"

/** The three ways a title steers this list. They narrow or order the list and are never saved as ratings. */
export type Steer = "similarTo" | "loved" | "disliked"

/** Example searches under Try while the field is empty. */
export const TRY_PROMPTS = [
	"cozy rainy day mystery",
	"something funny but smart",
	"a slow burn thriller with a twist",
	"feel-good movie for a bad day",
	"mind-bending sci-fi like Dark",
] as const

const without = <T>(list: readonly T[] | undefined, value: T) => {
	const rest = (list ?? []).filter((item) => item !== value)
	return rest.length ? rest : undefined
}

/**
 * Turns one steering choice on or off for a title. More like and Less like exclude each other (as in the sheet's
 * pickers); Like this is independent of both.
 */
export function toggleSteer(
	state: FilterState,
	steer: Steer,
	key: TitleKey,
): FilterState {
	const list = state[steer] ?? []
	if (list.includes(key)) return { ...state, [steer]: without(list, key) }
	const next: FilterState = { ...state, [steer]: [...list, key] }
	if (steer === "loved") next.disliked = without(state.disliked, key)
	if (steer === "disliked") next.loved = without(state.loved, key)
	return next
}

/** Adds or removes a person; the people filter keeps titles with any of them. */
export function togglePerson(state: FilterState, id: number): FilterState {
	const list = state.people ?? []
	return {
		...state,
		people: list.includes(id) ? without(list, id) : [...list, id],
	}
}

/** The rows a group shows after one more tap on More: 12 first, then 12 more each tap. */
export const moreRows = (shown: number): number =>
	shown < 12 ? 12 : shown + 12

/**
 * The count beside More: "4 of 13", or "4 of 20+" when the source answered a full page (`full`), so there may be
 * more than it sent. Null when every row already shows.
 */
export function moreCount(
	shown: number,
	total: number,
	full = false,
): string | null {
	if (shown >= total) return null
	return `${shown} of ${total}${full ? "+" : ""}`
}

/** "About N matches", "12 matches", "1 match". */
export function matchesLabel(total: number, short: (n: number) => string) {
	if (total > 100) return `About ${short(total)} matches`
	return `${short(total)} ${total === 1 ? "match" : "matches"}`
}

/** "12 titles", "1 title". */
export const titlesLabel = (n: number) => `${n} ${n === 1 ? "title" : "titles"}`

const ROLES: Record<string, string> = {
	Acting: "Actor",
	Directing: "Director",
	Writing: "Writer",
	Production: "Producer",
	Sound: "Music",
	Camera: "Camera",
	Editing: "Editor",
	Art: "Art",
	"Costume & Make-Up": "Costume",
	"Visual Effects": "Effects",
	Crew: "Crew",
}

/** A person's role in our words, from TMDB's known-for department. */
export const roleOf = (department: string) => ROLES[department] ?? department

const JOBS: Record<string, string> = {
	"Director of Photography": "Camera",
	"Original Music Composer": "Music",
}

/**
 * A panel person's note in short words: "12 titles" for an actor in these results, "Camera · 3" for someone behind
 * the camera, the role alone for a featured person.
 */
export function personNote(p: {
	role: string
	count: number | null
}): string {
	const role = JOBS[p.role] ?? roleOf(p.role)
	if (p.count === null) return role
	return p.role === "Actor" ? titlesLabel(p.count) : `${role} · ${p.count}`
}
