// What a guest asks the start page for, and what the stage shows for it. Pure, so the rules are tested without React
// (start-query.test.ts); useStartQuery.ts holds the state in a component.
//
// The query is two things the guest controls apart:
// - `text`: the search text that is searched (typed text once its pause is over, Enter, the Search button, or a preset's
//   exact phrase). `draft` is what the field holds while the guest types.
// - `picks`: up to three word ids of the taste picker (app/domain/taste-picker.ts: "m:funny", "t:crime", "s:slow").
// Typing or a preset keeps the picks; picking keeps the text. The field's Clear clears only the search, a chip's ×
// only that pick, the picker's Clear only the picks.
//
// StartResults is what the search and the results requests (useStartSearch, a later step) answer for one query,
// marked with the query's signature, so the stage never shows one query's titles under another.
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { DiscoverResults } from "~/server/discover-results.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { TitleKey } from "~/utils/title-key"

/** The most picks at once (the taste picker's MAX_PICKS). */
export const MAX_START_PICKS = 3

/** How many loved titles make the For you step. */
export const LOVED_NEEDED = 3

export type StartQuery = {
	/** What the field holds. */
	draft: string
	/** The searched text, trimmed; "" for none. */
	text: string
	picks: readonly string[]
}

export const EMPTY_QUERY: StartQuery = { draft: "", text: "", picks: [] }

export type StartQueryAction =
	/** The guest types: the field changes, nothing is searched yet. */
	| { type: "draft"; draft: string }
	/** Search this text now (the pause is over, Enter, Search, or a preset's phrase). */
	| { type: "search"; text: string }
	/** The field's Clear, or the field emptied. */
	| { type: "clearSearch" }
	/** The picks as the picker leaves them (a mix is its parts). */
	| { type: "picks"; picks: readonly string[] }
	/** A chip's ×. */
	| { type: "removePick"; id: string }
	/** The picker's Clear. */
	| { type: "clearPicks" }

const samePicks = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && a.every((id, i) => id === b[i])

/** The query after an action. Returns the same object when nothing changed. */
export function reduceQuery(
	query: StartQuery,
	action: StartQueryAction,
): StartQuery {
	switch (action.type) {
		case "draft":
			return action.draft === query.draft
				? query
				: { ...query, draft: action.draft }
		case "search": {
			const text = action.text.trim()
			return text === query.text && action.text === query.draft
				? query
				: { ...query, draft: action.text, text }
		}
		case "clearSearch":
			return query.draft === "" && query.text === ""
				? query
				: { ...query, draft: "", text: "" }
		case "picks": {
			const picks = [...new Set(action.picks)].slice(0, MAX_START_PICKS)
			return samePicks(picks, query.picks) ? query : { ...query, picks }
		}
		case "removePick":
			return query.picks.includes(action.id)
				? { ...query, picks: query.picks.filter((id) => id !== action.id) }
				: query
		case "clearPicks":
			return query.picks.length ? { ...query, picks: [] } : query
	}
}

/**
 * Whether the action is a new choice of the guest's (anything but typing). Once three titles are loved, a new choice
 * starts the three over (useLovedThree).
 */
export const isChoice = (action: StartQueryAction) => action.type !== "draft"

/** Whether the guest has asked for anything: a searched text or a pick. */
export const hasQuery = (query: Pick<StartQuery, "text" | "picks">) =>
	query.text !== "" || query.picks.length > 0

/** One key per query: results are for the query whose signature they carry. The draft doesn't count. */
export const querySignature = (query: Pick<StartQuery, "text" | "picks">) =>
	JSON.stringify([query.text, [...query.picks]])

export type StartResultsStatus = "idle" | "loading" | "ready" | "error"

/** What the stage shows for one query: the titles, the search's reading, and how many titles match in all. */
export type StartResults = {
	status: StartResultsStatus
	/** The querySignature these results answer. */
	signature: string
	/** The whole posters to tap, in order (at most two views of the card's row). */
	cards: TitleCard[]
	/** How the search read the text, as Discover's "Read as" chips: null without a search, or before it arrives. */
	reading: ReadingChip[] | null
	/** How many titles match in all (the picker's count line); null until known. */
	total: number | null
	/** The search's ranked list: null without a search, or before it arrives. */
	ranked: TitleKey[] | null
	/**
	 * Every mood's, theme's and style's count for these picks (and the search's titles), from the same results answer:
	 * the mood picker reads them, so a pick change asks once. Null until known; empty when the search found nothing.
	 */
	optionCounts: Pick<
		DiscoverResults["optionCounts"],
		"moods" | "themes" | "styles"
	> | null
	/** The message for the card's box when status is "error". */
	error: string | null
}

export const IDLE_RESULTS: StartResults = {
	status: "idle",
	signature: querySignature(EMPTY_QUERY),
	cards: [],
	reading: null,
	total: null,
	ranked: null,
	optionCounts: null,
	error: null,
}

/** What the card shows: nothing asked yet, titles on their way, the titles to tap (or an error), or For you. */
export type StartView = "empty" | "loading" | "results" | "forYou"

export function startView(
	query: StartQuery,
	results: StartResults,
	loved: number,
): StartView {
	if (loved >= LOVED_NEEDED) return "forYou"
	if (!hasQuery(query)) return "empty"
	if (
		results.signature !== querySignature(query) ||
		results.status === "loading" ||
		results.status === "idle"
	)
		return "loading"
	return "results"
}
