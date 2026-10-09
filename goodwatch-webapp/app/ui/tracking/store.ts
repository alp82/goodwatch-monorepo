// One show's tracking on its page, for a member (#384). The hero box and the episode list are separate chunks that
// load at different times, so what they share lives here, outside React: the show's session (the browser's copy
// and the actions on their way), the toast, the dialog that sets a group's date, and the request to open an
// episode in the list. Loaded on first use, never with the page.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useSyncExternalStore } from "react"
import type { DateWords } from "~/domain/tracking/seen-press"
import { afterShowTracking } from "~/domain/tracking/show-member-data"
import {
	type ActionAnswer,
	type PageAction,
	type PageEpisode,
	type Restore,
	type ShowCopy,
	type ShowTrackingPage,
	type ShowView,
	viewOf,
	watchStateEntryOf,
} from "~/domain/tracking/show-page"
import { ShowSession } from "~/domain/tracking/show-session"
import type { LogRow } from "~/domain/tracking/storage"
import { useIsOnWishlist, useUserScore } from "~/hooks/useUserDataAccessors"
import { getQueryKeyUserData } from "~/routes/api.user-data"
import type { UserData } from "~/types/user-data"
import { useUser } from "~/utils/auth"
import { OPEN_EPISODES_EVENT } from "./gate"

// ---------------------------------------------------------------------------------------------------------
// The device's clock and ids
// ---------------------------------------------------------------------------------------------------------

const two = (value: number) => String(value).padStart(2, "0")

/** The clock of the device. What has aired for a member goes by its date, not by UTC. */
export const deviceClock = {
	now: () => Date.now(),
	/** The calendar date on the device, "YYYY-MM-DD". */
	today: () => {
		const at = new Date(deviceClock.now())
		return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
	},
}

/**
 * An id for a watch or a group action, made in the browser so that a request sent twice records once.
 * `crypto.randomUUID` exists only on secure pages; the fallback gives the same amount of randomness.
 */
export function newActionId(): string {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	)
}

// ---------------------------------------------------------------------------------------------------------
// The requests
// ---------------------------------------------------------------------------------------------------------

const ENDPOINT = "/api/tracking/show"

async function readShow(showId: number): Promise<ShowTrackingPage> {
	const response = await fetch(`${ENDPOINT}?id=${showId}`)
	if (!response.ok)
		throw new Error(`Reading the show's tracking failed: ${response.status}`)
	return response.json()
}

async function sendAction(showId: number, body: object): Promise<ActionAnswer> {
	const response = await fetch(ENDPOINT, {
		method: "POST",
		body: JSON.stringify({ id: showId, ...body }),
	})
	if (!response.ok)
		throw new Error(`The action was not applied: ${response.status}`)
	return response.json()
}

// ---------------------------------------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------------------------------------

export interface ToastAction {
	label: string
	run: () => void
}
export interface TrackingToast {
	id: number
	text: string
	tone: "done" | "error"
	actions: ToastAction[]
}
/** "Set a date" on the watches of a group action. */
export interface DateRequest {
	group: string
	count: number
}
/** An episode to open in the episode list; null opens the list at its start. `at` tells one request from the next. */
export interface OpenRequest {
	episodeId: number | null
	at: number
}

interface Snapshot {
	page: ShowTrackingPage | null
	copy: ShowCopy | null
	toast: TrackingToast | null
	dateRequest: DateRequest | null
	open: OpenRequest | null
}

export class ShowStore {
	readonly showId: number
	private session: ShowSession | null = null
	private listeners = new Set<() => void>()
	private timer: ReturnType<typeof setTimeout> | undefined
	private made = 0
	private asked = 0
	snapshot: Snapshot = {
		page: null,
		copy: null,
		toast: null,
		dateRequest: null,
		open: null,
	}
	/** Reads the show's tracking again. Set by the page that holds the query. */
	refetch: () => void = () => {}
	/** Which of the mounted pieces shows the toast and the dialog: the first that asked. */
	private hosts: object[] = []

	constructor(showId: number) {
		this.showId = showId
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}
	getSnapshot = () => this.snapshot

	private set(change: Partial<Snapshot>) {
		this.snapshot = { ...this.snapshot, ...change }
		for (const listener of this.listeners) listener()
	}

	/** Takes what the server read. While actions are on their way it is read again once they are through. */
	load(page: ShowTrackingPage) {
		if (this.session?.busy) {
			this.session.load(page)
			return
		}
		const session: ShowSession = new ShowSession({
			showId: this.showId,
			episodes: page.episodes,
			copy: { state: page.state, log: page.log },
			send: ({ action, actionId, restore }) =>
				sendAction(this.showId, { event: action, actionId, restore }),
			onChange: () => this.set({ copy: session.shown }),
			onError: (message) => {
				this.say(message, [], "error")
				this.refetch()
			},
			onStale: () => this.refetch(),
		})
		this.session = session
		this.set({ page, copy: session.shown })
	}

	/**
	 * Applies an action: shown at once, sent in turn. An action the page refuses is said in a toast and not sent.
	 * `done` resolves with the server's answer, or null when there is none.
	 */
	act(
		action: PageAction,
		options: { actionId?: string; restore?: Restore } = {},
	): { ok: boolean; done: Promise<ActionAnswer | null> } {
		if (!this.session) return { ok: false, done: Promise.resolve(null) }
		const acted = this.session.act(action, {
			...options,
			today: deviceClock.today(),
			now: deviceClock.now(),
		})
		if (acted.refused) this.say(acted.refused, [], "error")
		return { ok: !acted.refused, done: acted.done }
	}

	say(
		text: string,
		actions: ToastAction[] = [],
		tone: TrackingToast["tone"] = "done",
	) {
		clearTimeout(this.timer)
		this.made += 1
		this.set({ toast: { id: this.made, text, tone, actions } })
		this.timer = setTimeout(() => this.set({ toast: null }), 9000)
	}
	dismissToast = () => {
		clearTimeout(this.timer)
		this.set({ toast: null })
	}

	askDate(request: DateRequest | null) {
		this.set({ dateRequest: request })
	}

	/** Opens the episode list at an episode, loading the list's code if the page has not yet. */
	openEpisode(episodeId: number | null) {
		// A number of its own per request, so that asking twice in one tick of the clock is asking twice.
		this.asked += 1
		this.set({ open: { episodeId, at: this.asked } })
		window.dispatchEvent(new Event(OPEN_EPISODES_EVENT))
	}

	/** The episode list took the request. */
	openHandled() {
		if (this.snapshot.open) this.set({ open: null })
	}

	claimHost(host: object) {
		this.hosts.push(host)
		this.set({})
		return () => {
			this.hosts = this.hosts.filter((each) => each !== host)
			this.set({})
		}
	}
	isHost(host: object) {
		return this.hosts[0] === host
	}
}

const stores = new Map<string, ShowStore>()

function storeOf(userId: string, showId: number): ShowStore {
	const key = `${userId}:${showId}`
	let store = stores.get(key)
	if (!store) {
		store = new ShowStore(showId)
		stores.set(key, store)
	}
	return store
}

// ---------------------------------------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------------------------------------

export interface Season {
	/** 0 holds the specials. */
	number: number
	episodes: PageEpisode[]
}

export interface ShowTracking {
	store: ShowStore
	/** The show has an episode list and the member's rows are read: tracking is offered. */
	ready: boolean
	page: ShowTrackingPage | null
	view: ShowView | null
	/** Regular seasons in order, the specials last. */
	seasons: Season[]
	/** The date on the device. */
	today: string
	toast: TrackingToast | null
	dateRequest: DateRequest | null
	open: OpenRequest | null
}

export const queryKeyShowTracking = (userId: string, showId: number) =>
	["show-tracking", userId, showId] as const

/** A show's tracking for the signed-in member. Call it only for a member. */
export function useShowTracking(showId: number): ShowTracking {
	const { user } = useUser()
	const userId = user?.id ?? ""
	const store = storeOf(userId, showId)
	const queryClient = useQueryClient()
	const query = useQuery({
		queryKey: queryKeyShowTracking(userId, showId),
		queryFn: () => readShow(showId),
		enabled: Boolean(userId),
	})
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	)
	const { refetch, data } = query
	useEffect(() => {
		store.refetch = () => void refetch()
	}, [store, refetch])
	useEffect(() => {
		if (data && data !== store.snapshot.page) store.load(data)
	}, [data, store])

	const { page, copy } = snapshot
	const ready = Boolean(page?.episodes.length && copy)
	const score = useUserScore("show", showId)?.score ?? null
	const wantToSee = useIsOnWishlist("show", showId)
	const today = deviceClock.today()
	const view = useMemo(
		() =>
			page && copy && page.episodes.length
				? viewOf(copy, page.episodes, {
						today,
						running: page.running,
						score,
						wantToSee,
						words: LOCALE_DATES,
					})
				: null,
		[page, copy, today, score, wantToSee],
	)
	const seasons = useMemo(() => {
		const byNumber = new Map<number, PageEpisode[]>()
		for (const episode of page?.episodes ?? []) {
			const list = byNumber.get(episode.season)
			if (list) list.push(episode)
			else byNumber.set(episode.season, [episode])
		}
		const order = [...byNumber.keys()].sort(
			(a, b) => Number(a === 0) - Number(b === 0) || a - b,
		)
		return order.map((number) => ({
			number,
			episodes: (byNumber.get(number) ?? []).sort(
				(a, b) => a.number - b.number,
			),
		}))
	}, [page])

	// The member data map's entry follows the page, so that cards and lists agree with it.
	useEffect(() => {
		if (!ready || !copy || !userId) return
		queryClient.setQueryData<UserData>(getQueryKeyUserData(userId), (old) =>
			afterShowTracking(old, showId, watchStateEntryOf(copy)),
		)
	}, [ready, copy, userId, showId, queryClient])

	return {
		store,
		ready,
		page,
		view,
		seasons,
		today,
		toast: snapshot.toast,
		dateRequest: snapshot.dateRequest,
		open: snapshot.open,
	}
}

// ---------------------------------------------------------------------------------------------------------
// Words and dates the hero box and the episode list share
// ---------------------------------------------------------------------------------------------------------

export const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
/** The surface of the episode grid, which the episode list sits on too. */
export const SURFACE = "bg-[#141923]"

export const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`

export const seasonTitle = (season: number) =>
	season === 0 ? "Specials" : `Season ${season}`
export const seasonShort = (season: number) =>
	season === 0 ? "Sp" : `S${season}`

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
]

const DAY_WORDS = { day: "numeric", month: "short", year: "numeric" } as const
/**
 * Dates in the member's locale, "19 Oct 2024" or "Oct 19, 2024": a moment as its day on the device, a calendar day
 * as that day. Only code that runs in the browser after hydration reads it.
 */
export const LOCALE_DATES: DateWords = {
	moment: (at) => new Intl.DateTimeFormat(undefined, DAY_WORDS).format(at),
	day: (day) =>
		new Intl.DateTimeFormat(undefined, {
			...DAY_WORDS,
			timeZone: "UTC",
		}).format(Date.parse(`${day}T00:00:00Z`)),
}

/** A calendar day, "YYYY-MM-DD", in words. */
export function formatDay(day: string, today?: string): string {
	if (today && day === today) return "today"
	const [year, month, date] = day.split("-").map(Number)
	return `${MONTHS[month - 1]} ${date}, ${year}`
}

/** The day of a day-precise watch: stored as midnight UTC, and read in UTC so that it never shifts. */
export const dayOfWatch = (row: LogRow): string | null =>
	row.watched_at !== null && row.watched_at_precision === "day"
		? new Date(row.watched_at).toISOString().slice(0, 10)
		: null

/** When a watch happened, in words: a time in the viewer's zone, a day, or that nobody recorded it. */
export function formatWatched(row: LogRow, today: string): string {
	if (row.watched_at === null) return "date unknown"
	const day = dayOfWatch(row)
	if (day) return formatDay(day, today)
	const at = new Date(row.watched_at)
	const local = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
	return `${formatDay(local, today)}, ${two(at.getHours())}:${two(at.getMinutes())}`
}
