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
	/**
	 * A pair is on record (cookie or account). Without one, `saved` is only the guess the page was built with, and
	 * picking the same value is still a change: Keep confirms it as an explicit choice.
	 */
	recorded: boolean
	/**
	 * A country the page shows that is not the saved one and was not picked: the address's `?country=`, a view of this
	 * page only. It is never saved; a Keep of the language alone keeps the saved country.
	 */
	view: string | null
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
	 * `conflict.current`: the pair saved meanwhile elsewhere (a version conflict), or null when none is on record any
	 * more. It becomes the saved one; the page keeps showing the visitor's pick, which Retry saves over it.
	 */
	| {
			type: "saveFailed"
			seq: number
			conflict?: { current: PreferencePair | null }
	  }
	/**
	 * The saved pair became known (the private read after the first paint) or changed elsewhere. `view`: the country
	 * the page shows when it is not the saved one (the address's), else null. During a save it is taken too: the
	 * toast's Undo then returns to the pair really saved before.
	 */
	| {
			type: "syncSaved"
			pair: PreferencePair
			recorded: boolean
			view?: string | null
	  }
	/**
	 * The page now shows another country without a pick here: the address changed on the same title (an old saved
	 * country moved into `?country=`). It becomes the page's view, never saved; a country picked here still shows over it.
	 */
	| { type: "pageCountry"; country: string }

export function initialState(
	saved: PreferencePair,
	recorded = true,
): PreferenceState {
	return {
		saved,
		recorded,
		view: null,
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

/** The pair the page shows: the preview over the address's country, over what is saved. */
export function onScreen(state: PreferenceState): PreferencePair {
	return {
		country: state.preview.country ?? state.view ?? state.saved.country,
		language: intended(state).language,
	}
}

/** Which values differ from what is saved. */
export function changes(state: PreferenceState) {
	const next = intended(state)
	const confirm = !state.recorded
	return {
		country:
			next.country !== state.saved.country ||
			(confirm && state.preview.country !== undefined),
		language:
			next.language !== state.saved.language ||
			(confirm &&
				(state.preview.language !== undefined || state.companion !== null)),
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
		if (event.type === "syncSaved") return synced(state, event)
		if (event.type === "pageCountry") return viewing(state, event.country)
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
			return settle(synced(state, event))
		case "pageCountry":
			return settle(viewing(state, event.country))
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
		recorded: true,
		preview: {},
		offers: [],
		companion: null,
		status: "saved",
		// A kept country replaces the address's on screen; a kept language leaves it.
		view: state.preview.country !== undefined ? null : state.view,
		undoTo: state.request.kind === "keep" ? state.saved : null,
	}
}

function synced(
	state: PreferenceState,
	event: { pair: PreferencePair; recorded: boolean; view?: string | null },
): PreferenceState {
	const view = event.view === undefined ? state.view : event.view
	return {
		...state,
		saved: event.pair,
		recorded: event.recorded,
		view: view === event.pair.country ? null : view,
	}
}

function viewing(state: PreferenceState, country: string): PreferenceState {
	const view = country === state.saved.country ? null : country
	return view === state.view ? state : { ...state, view }
}

function failed(
	state: PreferenceState,
	event: { seq: number; conflict?: { current: PreferencePair | null } },
): PreferenceState {
	if (state.request?.seq !== event.seq) return state
	// A failed Keep keeps the page as it is; the toast's Undo that did not save shows the pair from before instead.
	// Either way the page shows the save's pair, unsaved, and the question offers Retry. After a conflict only the
	// values this save changed stay picked: the others follow the pair adopted from elsewhere.
	const wanted = state.request.pair
	const preview = {
		...(wanted.country !== state.saved.country && { country: wanted.country }),
		...(wanted.language !== state.saved.language && {
			language: wanted.language,
		}),
	}
	const kept = event.conflict
		? settle({
				...state,
				saved: event.conflict.current ?? state.saved,
				recorded: event.conflict.current !== null,
				// With nothing on record any more, the whole pair is what Retry confirms.
				preview: event.conflict.current
					? preview
					: { country: wanted.country, language: wanted.language },
				offers: [],
				companion: null,
			})
		: state.request.kind === "keep"
			? state
			: { ...state, preview, offers: [], companion: null }
	// Saved elsewhere as the same pair: nothing is left to save.
	if (!isPending(kept)) return { ...kept, status: "idle", undoTo: null }
	return {
		...kept,
		status: "failed",
		conflict: Boolean(event.conflict),
		undoTo: state.request.kind === "keep" ? state.undoTo : null,
	}
}

/** Drops preview values equal to the saved ones, and an offer no longer needed. */
function settle(state: PreferenceState): PreferenceState {
	const { country, ...rest } = state.preview
	const preview: PreferenceState["preview"] =
		country === undefined ||
		(state.recorded && country === state.saved.country && state.view === null)
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
