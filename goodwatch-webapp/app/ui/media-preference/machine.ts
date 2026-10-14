// The country and titles language of the title page's header pair (variant F), as a pure state machine. A pick only
// previews: the page shows it, and the pair and its question say it is not saved. Keep saves the intended pair in one
// call, Undo before Keep drops the preview, and the toast's Undo after Keep saves the pair from before through the
// same call. Every save carries a number; an answer with any other number than the save under way is stale and
// changes nothing. Rendering, fetching and saving live elsewhere (MediaPreference.tsx and save-adapter.ts).

/** A language code ("de", "ja"), or "browser": no explicit choice, the titles follow the browser's language. */
export type LanguageChoice = string

export const BROWSER = "browser"

export interface PreferencePair {
	country: string
	language: LanguageChoice
}

export type SaveStatus = "idle" | "saving" | "failed" | "saved"

export interface PreferenceState {
	saved: PreferencePair
	/** Values picked and not kept. A missing value is the saved one. */
	preview: { country?: string; language?: LanguageChoice }
	/** The languages the previewed country offers alongside it. None is ticked until the visitor ticks one. */
	offers: string[]
	/** The offer the visitor ticked, if any. */
	companion: string | null
	status: SaveStatus
	/** The last failure was a conflict: the pair had been saved elsewhere meanwhile. */
	conflict: boolean
	/** The last save sent. Answers for any other number are stale. */
	request: { seq: number; pair: PreferencePair; kind: "keep" | "undo" } | null
	seq: number
	/** After a kept change, the pair from before it, for the toast's Undo. */
	undoTo: PreferencePair | null
}

export type PreferenceEvent =
	/** `offers`: the languages the country suggests, without the language the page shows now. */
	| { type: "pickCountry"; country: string; offers?: string[] }
	| { type: "pickLanguage"; language: LanguageChoice }
	| { type: "tickCompanion"; language: string | null }
	/** Undo before Keep, or Escape in the pair's region: back to what is saved. */
	| { type: "discard" }
	| { type: "keep" }
	/** The toast's Undo after a kept change. */
	| { type: "undoSaved" }
	| { type: "saveSucceeded"; seq: number; pair: PreferencePair }
	/**
	 * `current`: the pair saved meanwhile elsewhere (a version conflict). It becomes the saved one; the page keeps
	 * showing the visitor's pick, which Retry saves over it.
	 */
	| { type: "saveFailed"; seq: number; current?: PreferencePair }
	/** The saved pair became known or changed elsewhere (read from the device after the first paint). */
	| { type: "syncSaved"; pair: PreferencePair }

export function initialState(saved: PreferencePair): PreferenceState {
	return {
		saved,
		preview: {},
		offers: [],
		companion: null,
		status: "idle",
		conflict: false,
		request: null,
		seq: 0,
		undoTo: null,
	}
}

/** The pair a Keep would save. */
export function intended(state: PreferenceState): PreferencePair {
	return {
		country: state.preview.country ?? state.saved.country,
		language: state.companion ?? state.preview.language ?? state.saved.language,
	}
}

/** Which values differ from what is saved. */
export function changes(state: PreferenceState) {
	const next = intended(state)
	return {
		country: next.country !== state.saved.country,
		language: next.language !== state.saved.language,
	}
}

/** Something is shown that is not saved: the question is open. */
export function isPending(state: PreferenceState) {
	const changed = changes(state)
	return changed.country || changed.language
}

export const isSaving = (state: PreferenceState) => state.status === "saving"

/** The language the page shows: an explicit choice, or the browser's. */
export function shownLanguage(choice: LanguageChoice, browserLanguage: string) {
	return choice === BROWSER ? browserLanguage : choice
}

export function reduce(
	state: PreferenceState,
	event: PreferenceEvent,
): PreferenceState {
	// While a save is under way nothing else changes: no pick can be lost or mixed into the pair being saved.
	if (state.status === "saving") {
		if (event.type === "saveSucceeded") return succeeded(state, event)
		if (event.type === "saveFailed") return failed(state, event)
		return state
	}
	switch (event.type) {
		case "pickCountry": {
			const preview = { ...state.preview, country: event.country }
			const countryChanged = event.country !== state.saved.country
			// A language the visitor picked in this preview is theirs; the country offers its own only without one.
			const offers =
				countryChanged && state.preview.language === undefined
					? unique(event.offers ?? []).filter((l) => l !== state.saved.language)
					: []
			return settle({
				...state,
				preview,
				offers,
				companion: null,
				status: "idle",
			})
		}
		case "pickLanguage":
			return settle({
				...state,
				preview: { ...state.preview, language: event.language },
				offers: [],
				companion: null,
				status: "idle",
			})
		case "tickCompanion":
			if (event.language !== null && !state.offers.includes(event.language))
				return state
			return { ...state, companion: event.language, status: "idle" }
		case "discard":
			return {
				...state,
				preview: {},
				offers: [],
				companion: null,
				status: "idle",
			}
		case "keep": {
			if (!isPending(state)) return state
			const seq = state.seq + 1
			return {
				...state,
				seq,
				status: "saving",
				conflict: false,
				request: { seq, pair: intended(state), kind: "keep" },
			}
		}
		case "undoSaved": {
			if (!state.undoTo) return state
			const seq = state.seq + 1
			return {
				...state,
				seq,
				status: "saving",
				conflict: false,
				request: { seq, pair: state.undoTo, kind: "undo" },
			}
		}
		case "syncSaved":
			return settle({ ...state, saved: event.pair })
		case "saveSucceeded":
		case "saveFailed":
			// Nothing is under way: an answer now belongs to a save that is over.
			return state
	}
}

function succeeded(
	state: PreferenceState,
	event: { seq: number; pair: PreferencePair },
): PreferenceState {
	if (state.request?.seq !== event.seq) return state
	return {
		...state,
		saved: event.pair,
		preview: {},
		offers: [],
		companion: null,
		status: "saved",
		undoTo: state.request.kind === "keep" ? state.saved : null,
	}
}

function failed(
	state: PreferenceState,
	event: { seq: number; current?: PreferencePair },
): PreferenceState {
	if (state.request?.seq !== event.seq) return state
	// A failed Keep keeps the page as it is; the toast's Undo that did not save shows the pair from before instead.
	// Either way the page now shows the save's pair, unsaved, and the question offers Retry.
	const wanted =
		state.request.kind === "keep" ? intended(state) : state.request.pair
	const kept = event.current
		? settle({
				...state,
				saved: event.current,
				preview: { country: wanted.country, language: wanted.language },
				offers: [],
				companion: null,
			})
		: state.request.kind === "keep"
			? state
			: {
					...state,
					preview: { country: wanted.country, language: wanted.language },
					offers: [],
					companion: null,
				}
	// Saved elsewhere as the same pair: nothing is left to save.
	if (!isPending(kept)) return { ...kept, status: "idle", undoTo: null }
	return {
		...kept,
		status: "failed",
		conflict: Boolean(event.current),
		undoTo: state.request.kind === "keep" ? state.undoTo : null,
	}
}

/** Drops preview values equal to the saved ones, and an offer no longer needed. */
function settle(state: PreferenceState): PreferenceState {
	const { country, ...rest } = state.preview
	const preview: PreferenceState["preview"] =
		country === undefined || country === state.saved.country
			? rest
			: { ...rest, country }
	const offers = preview.country === undefined ? [] : state.offers
	// A language picked in this preview stays a pick even when it equals the saved one: it still silences offers.
	return {
		...state,
		preview,
		offers,
		companion: offers.includes(state.companion ?? "") ? state.companion : null,
	}
}

const unique = (values: string[]) => [...new Set(values)]
