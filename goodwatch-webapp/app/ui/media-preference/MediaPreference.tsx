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
import { useUndoToast } from "~/ui/title-actions/useUndoToast"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import { useRouteLoaderData } from "@remix-run/react"
import { regionName } from "~/utils/display-names"
import { browserLanguageOf, countryOffers, englishName } from "./languages"
import {
	BROWSER,
	type PreferenceEvent,
	type PreferencePair,
	type PreferenceState,
	changes,
	initialState,
	intended,
	isPending,
	reduce,
	shownLanguage,
} from "./machine"
import {
	PreferenceConflict,
	type PreferenceSaver,
	endpointSaver,
	serverPreference,
} from "./save-adapter"

// One saver for the app, so saves from one page after another stay in order.
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
	 * The country the page loaded with. It counts as saved: the server resolves it from the saved pair, or from a
	 * country in the address, which is the page's own until a pick.
	 */
	country: string
	saver?: PreferenceSaver
	children: ReactNode
}) {
	const { locale } = useLocale()
	const { user } = useUser()
	const server = serverPreference(useRouteLoaderData("root"))
	// The language the browser asks for, as the server negotiated it when the titles follow the browser. With an
	// explicit language the server did not need it: the browser's own list decides, once the page runs.
	const negotiated =
		server.context?.languageSetting === BROWSER ? server.context.language : null
	const [browserLanguage, setBrowserLanguage] = useState(
		() => negotiated ?? browserLanguageOf([locale.language]),
	)
	const [state, setState] = useState(() =>
		initialState({ country, language: server.record?.language ?? BROWSER }),
	)
	const stateRef = useRef(state)
	const dispatch = useCallback((event: PreferenceEvent) => {
		const next = reduce(stateRef.current, event)
		stateRef.current = next
		setState(next)
		return next
	}, [])

	useEffect(() => {
		if (!negotiated)
			setBrowserLanguage(
				browserLanguageOf(navigator.languages ?? [navigator.language]),
			)
	}, [negotiated])

	const [dialog, setDialog] = useState<{ open: boolean; tab: DialogTab }>({
		open: false,
		tab: "country",
	})
	const pairButton = useRef<HTMLButtonElement>(null)
	// What opened the dialog (the pair, or where-to-watch's country button): the focus returns there when it closes.
	const opener = useRef<HTMLElement | null>(null)
	const destination = user ? "to your account" : "on this device"
	const toast = useUndoToast()
	const [announcement, setAnnouncement] = useState("")

	// One save per number, also under StrictMode's doubled effects.
	// The version of the saved record, which a save says it replaces.
	const version = useRef(server.record?.version ?? null)
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
		saver.save(pair, { expectedVersion: version.current }).then(
			(saved) => {
				const before = stateRef.current
				const after = dispatch({ type: "saveSucceeded", seq, pair: saved.pair })
				if (after === before) return
				version.current = saved.version
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
				const current =
					error instanceof PreferenceConflict ? error.current : undefined
				const before = stateRef.current
				const after = dispatch({
					type: "saveFailed",
					seq,
					current: current && {
						country: current.country,
						language: current.language,
					},
				})
				if (after === before) return
				if (current) version.current = current.version
				setAnnouncement("")
			},
		)
	}, [request, saver, dispatch, browserLanguage, destination, toast.say])

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

	const next = intended(state)
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
		pickCountry: (code) =>
			dispatch({
				type: "pickCountry",
				country: code,
				offers: countryOffers(code, shown.language),
			}),
		pickLanguage: (language) => dispatch({ type: "pickLanguage", language }),
		tickCompanion: (language) => dispatch({ type: "tickCompanion", language }),
		discard: () => dispatch({ type: "discard" }),
		keep: () => dispatch({ type: "keep" }),
		dialog,
		openDialog: (tab) => {
			if (stateRef.current.status === "saving") return
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
