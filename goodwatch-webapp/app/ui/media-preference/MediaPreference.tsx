// The title page's country and titles language (variant F): the state of the header pair, its dialog, its saves and
// the toast after one. The rules live in machine.ts; this runs them for one page. Everything that shows the pair's
// values (the header, the hero, where-to-watch) reads them from here.
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import { useRevalidator } from "@remix-run/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeyStreamingProviders } from "~/routes/api.streaming-providers"
import { queryKeyUserSettings } from "~/routes/api.user-settings.get"
import { useUndoToast } from "~/ui/title-actions/useUndoToast"
import { useUser } from "~/utils/auth"
import { regionName } from "~/utils/display-names"
import useLocale from "~/utils/locale"

import {
	type GetMediaPreferencesResponse,
	negotiateMediaLanguage,
} from "~/utils/media-language"
import { countryOffers, englishName } from "./languages"
import {
	BROWSER,
	type PreferenceEvent,
	type PreferencePair,
	type PreferenceState,
	changes,
	initialState,
	isPending,
	onScreen,
	reduce,
	shownLanguage,
} from "./machine"
import {
	PreferenceConflict,
	type PreferenceSaver,
	endpointSaver,
	readMediaPreferences,
} from "./save-adapter"

// One saver per page load: one client id, and saves from one title page after another stay in order.
const defaultSaver = endpointSaver()

export type DialogTab = "country" | "titles"

export interface MediaPreference {
	state: PreferenceState
	/** The country and language the page shows: the preview over what is saved. */
	shown: { country: string; language: string }
	/** The language the browser asks for, which "Browser default" follows. */
	browserLanguage: string
	pending: boolean
	saving: boolean
	changed: { country: boolean; language: boolean }
	/** "on this device" or "to your account". */
	destination: string
	/** Reads what is saved, ahead of a pick: call when a visitor reaches for the pair or a country. */
	warm: () => void
	/** The private read arrived: whether the language is explicit or follows the browser is known. */
	known: boolean
	/** The private read failed: the page's own pair stands in for what is saved until `retryRead`. */
	readFailed: boolean
	retryRead: () => void
	pickCountry: (country: string) => void
	pickLanguage: (language: string) => void
	tickCompanion: (language: string | null) => void
	discard: () => void
	keep: () => void
	dialog: { open: boolean; tab: DialogTab }
	/** Opens the dialog, on the list used last unless a tab is given. */
	openDialog: (tab?: DialogTab) => void
	closeDialog: () => void
	setTab: (tab: DialogTab) => void
	/** The pair button: the focus comes back to it when the question goes. */
	pairButton: React.RefObject<HTMLButtonElement>
	/** What the pair's live region says: "Saving…", "Saved", a failure. */
	announcement: string
}

const Context = createContext<MediaPreference | null>(null)

export function useMediaPreference() {
	const value = useContext(Context)
	if (!value)
		throw new Error("useMediaPreference outside MediaPreferenceProvider")
	return value
}

/** "Japan, titles in Japanese" / "titles follow your browser (currently German)". */
export function describePair(
	pair: PreferencePair,
	browserLanguage: string,
	parts: { country: boolean; language: boolean } = {
		country: true,
		language: true,
	},
) {
	return [
		parts.country && regionName(pair.country),
		parts.language &&
			(pair.language === BROWSER
				? `titles follow your browser (currently ${englishName(browserLanguage)})`
				: `titles in ${englishName(pair.language)}`),
	]
		.filter(Boolean)
		.join(", ")
}

export function MediaPreferenceProvider({
	country,
	saver = defaultSaver,
	children,
}: {
	/**
	 * The country the page loaded with. Until the private read it counts as saved; then, when it is not the saved one
	 * (a country in the address), it stays on screen as this page's view and is never saved.
	 */
	country: string
	saver?: PreferenceSaver
	children: ReactNode
}) {
	const { locale } = useLocale()
	const { user } = useUser()
	const queryClient = useQueryClient()
	const { revalidate } = useRevalidator()
	// Until the private read below, the page's pair counts as saved, its language as the browser's: what the server
	// rendered, so hydration changes nothing.
	const [browserLanguage, setBrowserLanguage] = useState(locale.language)
	const [state, setState] = useState(() =>
		initialState({ country, language: BROWSER }),
	)
	const stateRef = useRef(state)
	const dispatch = useCallback((event: PreferenceEvent) => {
		const next = reduce(stateRef.current, event)
		stateRef.current = next
		setState(next)
		return next
	}, [])

	// What is saved, its revision and provenance are private: never in the shared root data. Read when a visitor
	// reaches for the pair or a country, and again for another member.
	const [wanted, setWanted] = useState(false)
	const warm = useCallback(() => setWanted(true), [])
	const prefsKey = ["media-preferences", user?.id ?? null]
	const prefsQuery = {
		queryKey: prefsKey,
		queryFn: ({ signal }: { signal?: AbortSignal }) =>
			readMediaPreferences(signal),
		staleTime: Number.POSITIVE_INFINITY,
	}
	const prefs = useQuery({ ...prefsQuery, enabled: wanted })
	// The revision of the saved record, which a save says it replaces.
	const version = useRef<string | null>(null)
	// Only the first read compares the saved country with the page's: later the page follows what was kept.
	const pageCountry = useRef<string | null>(country)
	const adopt = useCallback(
		(data: GetMediaPreferencesResponse) => {
			const context = data.effectiveContext
			// The read's own address has no `?country=`: its country is the saved one, or the guess a Keep confirms.
			const savedCountry = data.mediaPreferences?.country ?? context.country
			const view = pageCountry.current
			pageCountry.current = null
			version.current = data.mediaPreferences?.version ?? null
			// "Browser default" follows the browser: the server's negotiation while it follows it, else the same rule
			// on the browser's own list.
			setBrowserLanguage(
				context.languageSetting === BROWSER
					? context.language
					: negotiateMediaLanguage(navigator.languages ?? [navigator.language])
							.language,
			)
			dispatch({
				type: "syncSaved",
				pair: { country: savedCountry, language: context.languageSetting },
				recorded: data.mediaPreferences !== null,
				...(view !== null && { view: view === savedCountry ? null : view }),
			})
		},
		[dispatch],
	)
	useEffect(() => {
		if (prefs.data) adopt(prefs.data)
	}, [prefs.data, adopt])
	// The same title with another country in its address (an old saved country moved into `?country=`): the page shows
	// it as its view. A Keep's own reload brings the kept country, which is the saved one and so no view.
	const loadedCountry = useRef(country)
	useEffect(() => {
		if (loadedCountry.current === country) return
		loadedCountry.current = country
		// Before the private read, that read compares this country with the saved one.
		if (pageCountry.current !== null) pageCountry.current = country
		dispatch({ type: "pageCountry", country })
	}, [country, dispatch])

	const [dialog, setDialog] = useState<{ open: boolean; tab: DialogTab }>({
		open: false,
		tab: "country",
	})
	const pairButton = useRef<HTMLButtonElement>(null)
	// What opened the dialog (the pair, or where-to-watch's country button): the focus returns there when it closes.
	const opener = useRef<HTMLElement | null>(null)
	const destination =
		(prefs.data?.destination ?? (user ? "account" : "device")) === "account"
			? "to your account"
			: "on this device"
	const toast = useUndoToast()
	const [announcement, setAnnouncement] = useState("")

	// One save per number, also under StrictMode's doubled effects.
	const started = useRef(0)
	const request = state.status === "saving" ? state.request : null
	useEffect(() => {
		if (!request || started.current >= request.seq) return
		started.current = request.seq
		const { seq, pair, kind } = request
		// The toast names what this save changes: the language alone, the country alone, or the pair.
		const was = stateRef.current.saved
		const words = describePair(pair, browserLanguage, {
			country: pair.country !== was.country,
			language: pair.language !== was.language,
		})
		setAnnouncement(kind === "undo" ? "Restoring…" : "Saving…")
		// An earlier toast's Undo would be dropped while this saves: it goes; this save's toast follows.
		toast.dismiss()
		// The save replaces the revision on record, so it waits for the private read if a pick came first.
		queryClient
			.fetchQuery(prefsQuery)
			.then((data) => {
				if (version.current === null)
					version.current = data.mediaPreferences?.version ?? null
			})
			.catch(() => {})
			.then(() => saver.save(pair, { expectedVersion: version.current }))
			.then(
				(saved) => {
					const before = stateRef.current
					const after = dispatch({
						type: "saveSucceeded",
						seq,
						pair: saved.pair,
					})
					if (after === before) return
					version.current = saved.version
					queryClient.setQueryData<GetMediaPreferencesResponse>(prefsKey, {
						effectiveContext: saved.effectiveContext,
						mediaPreferences: {
							...saved.pair,
							schemaVersion: 1,
							version: saved.version,
						},
						destination: saved.destination,
					})
					// The cookie or account row changed: the root and the page read the saved pair again, and so do the
					// queries that hold the country (the member's settings, the services offered in it).
					revalidate()
					queryClient.invalidateQueries({ queryKey: queryKeyUserSettings })
					queryClient.invalidateQueries({ queryKey: queryKeyStreamingProviders })
					const where =
						saved.destination === "account"
							? "to your account"
							: saved.destination === "device"
								? "on this device"
								: destination
					const text = `${kind === "undo" ? "Restored" : "Saved"} ${where}: ${words}`
					setAnnouncement(text)
					// After an Undo, a short note without another Undo.
					toast.say(
						text,
						kind === "keep" ? () => dispatch({ type: "undoSaved" }) : undefined,
					)
				},
				(error) => {
					const conflict = error instanceof PreferenceConflict ? error : null
					const before = stateRef.current
					const after = dispatch({
						type: "saveFailed",
						seq,
						conflict: conflict
							? { current: conflict.current?.pair ?? null }
							: undefined,
					})
					if (after === before) return
					// Retry replaces what is on record now.
					if (conflict) version.current = conflict.current?.version ?? null
					setAnnouncement("")
				},
			)
	}, [
		request,
		saver,
		dispatch,
		browserLanguage,
		destination,
		toast.say,
		toast.dismiss,
		queryClient,
		revalidate,
		prefsKey,
		prefsQuery,
	])

	const pending = isPending(state)
	const wasPending = useRef(pending)
	useEffect(() => {
		// The question went away (Keep, Undo, Escape) while the focus was in it: back to the pair, not to the page.
		if (wasPending.current && !pending) {
			const at = document.activeElement
			if (
				!at ||
				at === document.body ||
				at.closest("[data-preference-question]")
			)
				pairButton.current?.focus({ preventScroll: true })
		}
		wasPending.current = pending
	}, [pending])

	const next = onScreen(state)
	const shown = {
		country: next.country,
		language: shownLanguage(next.language, browserLanguage),
	}
	const value: MediaPreference = {
		state,
		shown,
		browserLanguage,
		pending,
		saving: state.status === "saving",
		changed: changes(state),
		destination,
		warm,
		known: prefs.data !== undefined,
		readFailed: prefs.isError && prefs.data === undefined,
		retryRead: () => {
			void prefs.refetch()
		},
		pickCountry: (code) => {
			setWanted(true)
			dispatch({
				type: "pickCountry",
				country: code,
				offers: countryOffers(code, shown.language),
			})
		},
		pickLanguage: (language) => {
			setWanted(true)
			dispatch({ type: "pickLanguage", language })
		},
		tickCompanion: (language) => dispatch({ type: "tickCompanion", language }),
		discard: () => dispatch({ type: "discard" }),
		// The saved pair is read first: a Keep of one value keeps the other as saved, never as the page shows it.
		keep: () => {
			if (prefs.data) return void dispatch({ type: "keep" })
			queryClient
				.fetchQuery(prefsQuery)
				.then(adopt)
				.catch(() => {})
				.then(() => dispatch({ type: "keep" }))
		},
		dialog,
		openDialog: (tab) => {
			if (stateRef.current.status === "saving") return
			setWanted(true)
			opener.current =
				document.activeElement instanceof HTMLElement &&
				document.activeElement !== document.body
					? document.activeElement
					: pairButton.current
			setDialog((d) => ({ open: true, tab: tab ?? d.tab }))
		},
		closeDialog: () => {
			setDialog((d) => ({ ...d, open: false }))
			// The dialog unmounts at once, before it could hand the focus back itself.
			requestAnimationFrame(() =>
				(opener.current ?? pairButton.current)?.focus({ preventScroll: true }),
			)
		},
		setTab: (tab) => setDialog((d) => ({ ...d, tab })),
		pairButton,
		announcement,
	}
	return (
		<Context.Provider value={value}>
			{children}
			{toast.node}
		</Context.Provider>
	)
}
