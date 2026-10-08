// PROTOTYPE - throwaway. Sample titles, sample members and the in-memory member state of /prototype/title-overview.
// Nothing here is read from or written to a server. Image paths are TMDB's, the numbers are the titles' real ones
// at the time of writing, and what the sample member watched and scored is made up.
import { useState } from "react"

export type Kind = "movie" | "show"
export type Status = "not_started" | "watching" | "on_hold" | "dropped" | "seen"

export interface Title {
	kind: Kind
	name: string
	facts: string[]
	overview: string
	poster: string
	backdrop: string
	/** GoodWatch score, 0 to 100. */
	gw: number
	imdb: string | null
	mcCritics: string | null
	mcAudience: string | null
	rtCritics: string | null
	rtAudience: string | null
	/** Shows only. */
	running: boolean
	seasons: number
	aired: number
	next: { code: string; name: string }
}

export const img = (size: string, path: string) => `https://image.tmdb.org/t/p/${size}${path}`

export const TITLES: Record<Kind, Title> = {
	show: {
		kind: "show",
		name: "Alice in Borderland",
		facts: ["2020", "3 seasons", "16+", "Mystery · Sci-Fi · Action"],
		overview:
			"With his two friends, a video-game-obsessed young man finds himself in a strange version of Tokyo where they must compete in dangerous games to win.",
		poster: "/Ac8ruycRXzgcsndTZFK6ouGA0FA.jpg",
		backdrop: "/QZaPkNUvhdcKONuO2fXuqtcQRo.jpg",
		gw: 78,
		imdb: "7.8",
		mcCritics: null,
		mcAudience: "7.8",
		rtCritics: "78%",
		rtAudience: "79%",
		running: true,
		seasons: 3,
		aired: 22,
		next: { code: "S3 E1", name: "Episode 1" },
	},
	movie: {
		kind: "movie",
		name: "Interstellar",
		facts: ["2014", "2h 49m", "12+", "Adventure · Drama · Sci-Fi"],
		overview:
			"The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.",
		poster: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg",
		backdrop: "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
		gw: 84,
		imdb: "8.7",
		mcCritics: "74",
		mcAudience: "8.7",
		rtCritics: "73%",
		rtAudience: "87%",
		running: false,
		seasons: 0,
		aired: 0,
		next: { code: "", name: "" },
	},
}

// ---------------------------------------------------------------------------------------------------------
// Where to watch
// ---------------------------------------------------------------------------------------------------------

export interface Provider {
	name: string
	logo: string
	owned?: boolean
}
export type Offer = "stream" | "rent" | "buy"
export type ProviderKey = "one" | "many" | "none"

const P = {
	netflix: { name: "Netflix", logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png", owned: true },
	prime: { name: "Prime", logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png" },
	paramount: { name: "Paramount+", logo: "/4N4BMd0Mm0kHAmF7RZgL5lW3cwc.png" },
	plex: { name: "Plex", logo: "/blAEhvx3XX8sV0fFVFk88FFjubs.png" },
	youtube: { name: "YouTube", logo: "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png" },
	apple: { name: "Apple TV", logo: "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png" },
	amazon: { name: "Amazon Video", logo: "/jn6TLbtaTZntTRX9UYucHJvpQx1.png" },
	google: { name: "Google Play", logo: "/aZRENwYILujqs0RVOZutTh0BVGV.png" },
	fandango: { name: "Fandango", logo: "/wpOt6x0dRxTrIzuBosto4LGd7E9.png" },
	flixfling: { name: "FlixFling", logo: "/hkw2s2Su8EyifB9EbbQP64Fj1xA.png" },
	justwatch: { name: "JustWatch TV", logo: "/aJXLTvX11u4fBLMPRVJZVKkLYHP.png" },
	roku: { name: "Roku Channel", logo: "/tnZCMxbcKdxuVmjxefyXCaip7q3.png" },
} satisfies Record<string, Provider>

export const PROVIDERS: Record<ProviderKey, { label: string; offers: Record<Offer, Provider[]> }> = {
	one: { label: "One service", offers: { stream: [P.netflix], rent: [], buy: [] } },
	many: {
		label: "Many services",
		offers: {
			stream: [P.netflix, P.prime, P.paramount, P.plex, P.youtube, P.roku, P.justwatch, P.flixfling, P.apple, P.fandango, P.google],
			rent: [P.apple, P.amazon, P.google, P.youtube, P.fandango, P.flixfling],
			buy: [P.apple, P.amazon, P.google, P.fandango],
		},
	},
	none: { label: "No service", offers: { stream: [], rent: [], buy: [] } },
}

// ---------------------------------------------------------------------------------------------------------
// The sample member
// ---------------------------------------------------------------------------------------------------------

export interface Member {
	score: number | null
	want: boolean
	/** Not interested. */
	hidden: boolean
	/** A movie is only ever not_started or seen. */
	status: Status
	watched: number
	/** What Seen replaced, so that taking it back restores it. */
	before?: { status: Status; watched: number }
}

export type ScenarioKey = "show-watching" | "show-new" | "show-caught-up" | "movie-new" | "movie-seen"

export const SCENARIOS: Record<ScenarioKey, { label: string; kind: Kind; member: Member }> = {
	"show-watching": { label: "Show · Watching, scored 7", kind: "show", member: { score: 7, want: false, hidden: false, status: "watching", watched: 16 } },
	"show-new": { label: "Show · not started, no score", kind: "show", member: { score: null, want: false, hidden: false, status: "not_started", watched: 0 } },
	"show-caught-up": { label: "Show · Caught up, scored 9", kind: "show", member: { score: 9, want: false, hidden: false, status: "seen", watched: 22 } },
	"movie-new": { label: "Movie · no score", kind: "movie", member: { score: null, want: false, hidden: false, status: "not_started", watched: 0 } },
	"movie-seen": { label: "Movie · Seen, scored 8", kind: "movie", member: { score: 8, want: false, hidden: false, status: "seen", watched: 0 } },
}

export interface Action {
	id: "want" | "seen" | "drop" | "hide"
	label: string
	active: boolean
	disabled?: boolean
	hint?: string
	run: () => void
}
export interface MenuEntry {
	id: string
	label: string
	note: string
	run: () => void
}

export interface Tracking {
	label: string
	count: string
	percent: number
	eyebrow: string
	line: string
	chip: string
}

export interface Api {
	rate: (score: number) => void
	clear: () => void
	actions: Action[]
	/** The status menu of a show that has a status. */
	menu: MenuEntry[]
	/** Shows only. */
	tracking: Tracking | null
}

export const STATUS_LOOK: Record<Exclude<Status, "not_started">, string> = {
	watching: "bg-sky-500 text-black",
	on_hold: "bg-violet-500 text-white",
	dropped: "bg-pink-500 text-black",
	seen: "bg-green-500 text-black",
}

export function useMember(title: Title, start: Member): { m: Member; api: Api } {
	const [m, setM] = useState(start)
	const set = (patch: Partial<Member>) => setM((now) => ({ ...now, ...patch }))
	const show = title.kind === "show"
	const seen = m.status === "seen"
	const started = m.status !== "not_started"

	const toggleSeen = () =>
		setM((now) =>
			now.status === "seen"
				? { ...now, status: now.before?.status ?? "not_started", watched: now.before?.watched ?? 0, before: undefined }
				: { ...now, before: { status: now.status, watched: now.watched }, status: "seen", watched: title.aired, want: false, hidden: false },
		)
	const seenLabel = seen ? (show && title.running ? "Caught up" : "Seen") : "Mark as Seen"

	const want: Action = {
		id: "want",
		label: "Want to See",
		active: m.want,
		disabled: started,
		hint: started ? (show ? "You've started it already." : "You've seen it already.") : undefined,
		run: () => set({ want: !m.want, hidden: false }),
	}
	const seenAction: Action = { id: "seen", label: seenLabel, active: seen, hint: seen ? "Press to take it back." : undefined, run: toggleSeen }
	const hide: Action = {
		id: "hide",
		label: "Not interested",
		active: m.hidden,
		hint: "Hide it from your recommendations",
		run: () => set({ hidden: !m.hidden, want: false }),
	}
	const drop: Action = { id: "drop", label: "Drop", active: false, hint: "Give it up. It is hidden from your recommendations.", run: () => set({ status: "dropped", want: false }) }
	const dropped: Action = { id: "drop", label: "Dropped", active: true, hint: "Press to resume it.", run: () => set({ status: "watching" }) }

	const actions: Action[] =
		m.status === "not_started" ? [want, seenAction, hide] : m.status === "dropped" ? [seenAction, dropped] : seen ? [seenAction] : [seenAction, drop]

	const resume: MenuEntry = { id: "resume", label: "Resume", note: "Back to Watching.", run: () => set({ status: "watching" }) }
	const hold: MenuEntry = { id: "hold", label: "Put on hold", note: "Set it aside. It stays in My shows.", run: () => set({ status: "on_hold" }) }
	const all: MenuEntry = { id: "all", label: "Mark as Seen", note: `Ticks all ${title.aired} aired episodes.`, run: toggleSeen }
	const dropEntry: MenuEntry = { id: "drop", label: "Drop", note: "Give it up. It is hidden from your recommendations.", run: drop.run }
	const takeBack: MenuEntry = { id: "takeBack", label: "Take back Seen", note: "Back to where you were before.", run: toggleSeen }
	const menu: MenuEntry[] =
		m.status === "watching" ? [all, hold, dropEntry] : m.status === "on_hold" ? [resume, all, dropEntry] : m.status === "dropped" ? [resume] : seen ? [takeBack] : []

	const size = `${title.seasons} seasons · ${title.aired} episodes`
	const tracking: Tracking | null = !show
		? null
		: {
				label: { not_started: "Not started", watching: "Watching", on_hold: "On hold", dropped: "Dropped", seen: title.running ? "Caught up" : "Seen" }[m.status],
				count: `${m.watched} of ${title.aired}`,
				percent: title.aired ? (m.watched / title.aired) * 100 : 0,
				...(m.status === "not_started"
					? { eyebrow: "Already watching?", line: size, chip: "Episodes" }
					: m.status === "dropped"
						? { eyebrow: "Dropped", line: "Resume brings it back.", chip: "Episodes" }
						: seen
							? { eyebrow: "Episodes", line: "All watched", chip: "Episodes" }
							: { eyebrow: "Next episode", line: `${title.next.code} · ${title.next.name}`, chip: title.next.code }),
			}

	return { m, api: { rate: (score) => set({ score, hidden: false }), clear: () => set({ score: null }), actions, menu, tracking } }
}
