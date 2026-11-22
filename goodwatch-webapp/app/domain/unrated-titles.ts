import type { MediaKey, UserData } from "~/types/user-data"

/** The library and the scores badge count the same seen titles that still need a rating. */
export function unratedTitles(data: Pick<UserData, "watchState" | "scores">): MediaKey[] {
	const keys = Object.keys(data.watchState) as MediaKey[]
	return keys.filter((key) => data.watchState[key].state === "seen" && !(key in data.scores))
}
