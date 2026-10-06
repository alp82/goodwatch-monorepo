// PROTOTYPE - throwaway. Types, the settled rules of #365 as far as the page needs them, and the in-memory store for
// /prototype/watching (#371). State lives in React state only: a reload starts over, and nothing is written anywhere.
import { useMemo, useState } from "react"

export type Episode = { s: number; e: number; name: string; /** yyyy-mm-dd */ air: string }
export type Service = { name: string; logo: string | null }

export interface Title {
	key: string
	type: "movie" | "show"
	id: number
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
	runtime: number | null
	score: number | null
	service: Service | null
	match: number
	tagline: string
}

export interface Show extends Title {
	/** Regular episodes from the season the sample member is in, in order. Earlier seasons count as watched. */
	episodes: Episode[]
	/** Regular episodes in the seasons before `episodes`. */
	before: number
	total: number
	/** Seasons exist after the loaded episodes. */
	more: boolean
}

export type Status = "watching" | "on-hold" | "dropped" | "seen" | null
export type Track = { status: Status; /** How many of `episodes` are watched, in order. */ watched: number; /** Days since the last watch. */ lastWatch: number | null }

export type MemberKey = "six" | "one" | "many" | "none"
export type Member = { key: MemberKey; label: string; wishlist: string[]; tracks: Record<string, Track> }
export type Fixture = { today: string; titles: Record<string, Title | Show>; suggestions: string[]; members: Record<MemberKey, Member> }

export type VariantKey = "section" | "merged" | "view" | "mix"
export const VARIANTS: Record<VariantKey, string> = {
	section: "A · Own section",
	merged: "B · Merged Watch next",
	view: "C · Separate view",
	mix: "D · A with C's home line",
}

export const isShow = (t: Title | undefined): t is Show => !!t && t.type === "show" && "episodes" in t
export const img = (path: string | null, size: string) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "")
export const code = (ep: Episode) => `S${ep.s} E${ep.e}`

/** Where a tracked show stands today. */
export type Kind =
	| "next" // Watching, with a Next episode
	| "caughtUp" // Watching, every aired episode watched, more to air
	| "seenNew" // Seen, and episodes have aired since
	| "comingBack" // Seen, and a season is announced but has not started
	| "onHold"
	| "dropped"
	| "seen"

export interface Entry {
	show: Show
	track: Track
	kind: Kind
	/** The Next episode: the earliest aired regular episode not watched. */
	next: Episode | null
	/** The first episode that has not aired yet, when there is no Next episode. */
	upcoming: Episode | null
	/** The episode after the Next episode, if it has aired. */
	after: Episode | null
	/** Regular episodes watched, of all the show has. */
	done: number
	/** Aired episodes not watched. */
	left: number
}

export function entryOf(show: Show, track: Track, today: string): Entry {
	const aired = show.episodes.filter((e) => e.air <= today).length
	const next = track.watched < aired ? show.episodes[track.watched] : null
	const upcoming = next ? null : (show.episodes[track.watched] ?? null)
	const kind: Kind =
		track.status === "dropped"
			? "dropped"
			: track.status === "on-hold"
				? "onHold"
				: track.status === "seen"
					? next
						? "seenNew"
						: upcoming
							? "comingBack"
							: "seen"
					: next
						? "next"
						: upcoming
							? "caughtUp"
							: "seen"
	return {
		show,
		track,
		kind,
		next,
		upcoming,
		after: next && track.watched + 1 < aired ? show.episodes[track.watched + 1] : null,
		done: show.before + track.watched,
		left: aired - track.watched,
	}
}

// ---- Words

const dayOf = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000
export const daysFrom = (today: string, isoDate: string) => Math.round(dayOf(isoDate) - dayOf(today))

export function ago(days: number | null): string {
	if (days == null) return "date unknown"
	if (days <= 0) return "today"
	if (days === 1) return "yesterday"
	if (days < 14) return `${days} days ago`
	if (days < 60) return `${Math.round(days / 7)} weeks ago`
	if (days < 365) return `${Math.round(days / 30)} months ago`
	return days < 550 ? "over a year ago" : `${Math.round(days / 365)} years ago`
}

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
const YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })

/** "Aired today", "Aired Sep 29", "Aired Mar 3, 2022". */
export function aired(today: string, ep: Episode): string {
	const d = -daysFrom(today, ep.air)
	if (d === 0) return "Aired today"
	if (d === 1) return "Aired yesterday"
	return `Aired ${(d > 300 ? YEAR : SHORT).format(new Date(`${ep.air}T00:00:00Z`))}`
}
/** "Fri, Oct 9". */
export const airsOn = (ep: Episode) => WEEKDAY.format(new Date(`${ep.air}T00:00:00Z`))
/** An episode that aired in the last three days. */
export const isNew = (today: string, ep: Episode | null) => !!ep && -daysFrom(today, ep.air) <= 3

/** What a waiting show says instead of a Next episode. */
export function waitLine(e: Entry): string {
	if (!e.upcoming) return ""
	const when = airsOn(e.upcoming)
	if (e.upcoming.e === 1) return `Season ${e.upcoming.s} starts ${when}`
	return `${code(e.upcoming)} airs ${when}`
}

// ---- The store

export type Toast = { id: number; text: string; undo?: Snapshot; rate?: string }
type Snapshot = { tracks: Record<string, Track>; wishlist: string[] }

/** A Watching show not watched for this many days stops leading Watch next in variant B. */
export const QUIET_DAYS = 30

export function useWatching(fixture: Fixture, member: Member) {
	const [tracks, setTracks] = useState<Record<string, Track>>(() => structuredClone(member.tracks))
	const [wishlist, setWishlist] = useState<string[]>(member.wishlist)
	const [passed, setPassed] = useState<string[]>([])
	const [toast, setToast] = useState<Toast | null>(null)
	const { today, titles } = fixture
	const snap = (): Snapshot => ({ tracks, wishlist })
	const say = (text: string, undo?: Snapshot, rate?: string) => setToast({ id: Date.now(), text, undo, rate })

	const entries = useMemo(
		() =>
			Object.entries(tracks)
				.map(([key, track]) => (isShow(titles[key]) ? entryOf(titles[key] as Show, track, today) : null))
				.filter((e): e is Entry => !!e)
				.sort((a, b) => (a.track.lastWatch ?? 9e9) - (b.track.lastWatch ?? 9e9)),
		[tracks, titles, today],
	)
	const of = (kind: Kind) => entries.filter((e) => e.kind === kind)
	const groups = {
		/** Watching with a Next episode, most recently watched first. */
		next: of("next"),
		caughtUp: of("caughtUp"),
		seenNew: of("seenNew"),
		comingBack: of("comingBack"),
		onHold: of("onHold"),
		dropped: of("dropped"),
	}

	/**
	 * One tap on a card: the Next episode is watched now. The first watched episode of a Wishlist show sets Watching
	 * and clears Want to See; an episode of an On hold or Dropped show returns it to Watching; a Seen show stays Seen.
	 * Watching the last episode of a show with no season still to come makes it Seen and asks once for a rating.
	 */
	const markWatched = (key: string) => {
		const show = titles[key]
		if (!isShow(show)) return
		const before = snap()
		const track = tracks[key] ?? { status: null, watched: 0, lastWatch: null }
		const ep = show.episodes[track.watched]
		if (!ep || ep.air > today) return
		const watched = track.watched + 1
		const through = watched >= show.episodes.length && !show.more
		const status: Status = track.status === "seen" || through ? "seen" : "watching"
		const now = entryOf(show, { status, watched, lastWatch: 0 }, today)
		setTracks({ ...tracks, [key]: now.track })
		if (wishlist.includes(key)) setWishlist(wishlist.filter((k) => k !== key))
		setPassed((p) => p.filter((k) => k !== key))
		const done = `${show.title}: ${code(ep)} watched.`
		if (through && track.status !== "seen") say(`You watched ${show.title} through. It is Seen now.`, before, key)
		else if (track.status === null) say(`${done} ${show.title} is Watching and off your Wishlist.`, before)
		else if (track.status === "on-hold" || track.status === "dropped") say(`${done} ${show.title} is Watching again.`, before)
		else if (now.next) say(`${done} Next episode: ${code(now.next)} · ${now.next.name}`, before)
		else if (now.upcoming) say(`${done} ${status === "seen" ? "" : "Caught up. "}${waitLine(now)}.`, before)
		else say(done, before)
	}

	const setStatus = (key: string, status: "watching" | "on-hold" | "dropped") => {
		const show = titles[key]
		const before = snap()
		setTracks({ ...tracks, [key]: { ...(tracks[key] ?? { watched: 0, lastWatch: null }), status } })
		// Dropped clears Want to See.
		if (status === "dropped" && wishlist.includes(key)) setWishlist(wishlist.filter((k) => k !== key))
		say(`${show.title} is ${status === "on-hold" ? "On hold" : status === "dropped" ? "Dropped" : "Watching again"}.`, before)
	}

	/** "I watched it" on a Wishlist film: Seen, and off the Wishlist. */
	const finishTitle = (key: string) => {
		const before = snap()
		setWishlist(wishlist.filter((k) => k !== key))
		say(`${titles[key].title} is Seen.`, before, key)
	}

	/** Not tonight: to the end of the current view for this visit. Writes nothing. */
	const pass = (key: string) => setPassed((p) => [...p.filter((k) => k !== key), key])
	const later = <T extends { key: string }>(list: T[]) => [...list.filter((t) => !passed.includes(t.key)), ...list.filter((t) => passed.includes(t.key))]

	const undo = () => {
		if (toast?.undo) {
			setTracks(toast.undo.tracks)
			setWishlist(toast.undo.wishlist)
		}
		setToast(null)
	}

	return {
		today,
		titles,
		suggestions: fixture.suggestions.map((k) => titles[k]),
		tracks,
		entries,
		groups,
		wishlist: wishlist.map((k) => titles[k]).filter(Boolean),
		passed,
		later,
		markWatched,
		setStatus,
		finishTitle,
		pass,
		toast,
		dismiss: () => setToast(null),
		undo,
	}
}

export type Store = ReturnType<typeof useWatching>

/** One place in Watch next: a Wishlist title, or the Next episode of a show. */
export type Slot = { key: string; title: Title; entry: Entry | null }

/**
 * Watch next under each variant.
 * - A, C and D: the Wishlist, as today.
 * - B: the Next episodes of Watching shows watched in the last 30 days, most recent first, then Seen shows with new
 *   episodes, then the Wishlist, then the Watching shows not watched for longer.
 */
export function watchNextOf(store: Store, variant: VariantKey): { slots: Slot[]; quiet: Entry[] } {
	const wishlist: Slot[] = store.later(store.wishlist).map((title) => ({ key: title.key, title, entry: null }))
	if (variant !== "merged") return { slots: wishlist, quiet: [] }
	const episode = (entry: Entry): Slot => ({ key: entry.show.key, title: entry.show, entry })
	const lead = store.groups.next.filter((e) => (e.track.lastWatch ?? 9e9) <= QUIET_DAYS)
	const quiet = store.groups.next.filter((e) => (e.track.lastWatch ?? 9e9) > QUIET_DAYS)
	return { slots: [...store.later([...lead, ...store.groups.seenNew].map(episode)), ...wishlist], quiet }
}

/**
 * Tonight's pick. A, B and C keep today's definition, the first place of Watch next. D leaves Watch next alone and
 * changes the pick: the Next episode of the Watching show watched most recently in the last 30 days, else the first
 * place of Watch next.
 */
export function tonightsPick(store: Store, variant: VariantKey): Slot | null {
	const recent = variant === "mix" ? store.groups.next.find((e) => (e.track.lastWatch ?? 9e9) <= QUIET_DAYS) : null
	if (recent) return { key: recent.show.key, title: recent.show, entry: recent }
	return watchNextOf(store, variant).slots[0] ?? null
}
