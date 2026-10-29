import { episodeCode, tonightsPickOf } from "~/domain/my-shows"
// What a member's start is built from (server/start-page/member.server.ts reads it), and the pure steps that shape
// the reads into it. The browser gets MemberStartData from the loader; the deck and the doors are built from it
// (deck.ts, doors.ts).
import type { TalkedRow, TalkedTitle } from "~/domain/talked-about-now"
import type { TonightParts } from "~/server/home-doors.server"
import type { MyShows, NextEpisode } from "~/server/my-shows.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { ShelfTitle } from "../room/ShelfCovers"
import { START_ROOM, START_ROOM_PHONE } from "../room/scene"

/** How many titles each list carries: a door's grid shows eleven and its page tile. */
export const MEMBER_LIST_SIZE = 12

/** For you gets personal from this many ratings; below it, its titles are first guesses ("still forming"). */
export const PERSONAL_AT = 10

/** A show to continue, with its next episode ("S2 E1 · Name"). */
export type ContinueShow = { card: TitleCard; episode: string | null }

/** A title of Hot on socials, with its place and why it's talked about. */
export type HotTitle = { card: TitleCard; rank: number; why: string }

/** A list's first titles and how many it has in all. */
export type MemberList<T> = { titles: T[]; total: number }

export type MemberStartData = {
	/** The member's ratings: For you is still forming below PERSONAL_AT. */
	ratings: number
	/** Their saved services, for the search's scope. */
	services: number[]
	/** Tonight's pick, as the navigation dock and Watch next pick it; null without one. */
	tonight: {
		card: TitleCard
		episode: string | null
		source: "continue" | "wishlist"
	} | null
	/** Each list is null when it couldn't be read. */
	continue: MemberList<ContinueShow> | null
	/** The Wishlist's movies, in My movies' order. */
	wishlist: MemberList<TitleCard> | null
	/** Movies and shows taking turns; empty without ratings. Undefined while it is on its way (MemberStartLater). */
	forYou?: MemberList<TitleCard> | null
	/** Whether the member sees Hot on socials at all (its door). */
	hotOn: boolean
	/** Undefined while it is on its way (MemberStartLater). */
	hot?: MemberList<HotTitle> | null
}

/** The lists that come later in the page's response (Remix's `defer`); each resolves to null when it couldn't be read. */
export type MemberStartLater = {
	forYou?: Promise<MemberList<TitleCard> | null>
	hot?: Promise<MemberList<HotTitle> | null>
}

/** A later list as it settled, with the promise it settled from. */
export type Settled<T> = { from: Promise<T>; value: T }

export type ArrivedLists = {
	forYou?: Settled<MemberStartData["forYou"]>
	hot?: Settled<MemberStartData["hot"]>
}

/**
 * The start with the later lists that have arrived. A list the start already has wins. A settled list counts only
 * for the promise it came from: once the loader's data is read again, with new promises, the old answers are on
 * their way again until the new ones settle.
 */
export function withArrived(
	data: MemberStartData,
	later: MemberStartLater | undefined,
	arrived: ArrivedLists,
): MemberStartData {
	const pick = <T>(
		own: T | undefined,
		promise: Promise<T> | undefined,
		settled: Settled<T> | undefined,
	) =>
		own !== undefined
			? own
			: settled && settled.from === promise
				? settled.value
				: undefined
	return {
		...data,
		forYou: pick(data.forYou, later?.forYou, arrived.forYou),
		hot: pick(data.hot, later?.hot, arrived.hot),
	}
}

/** As many titles as the room with the most shelf cases holds. */
export const MEMBER_SHELF_SIZE = Math.max(
	START_ROOM.slots.length,
	START_ROOM_PHONE.slots.length,
)

/**
 * The titles on a member's shelf: Watch next's movies (the Wishlist in My movies' order); without any, the shows to
 * continue; without those either, For you. Cases left over take the next lists' titles, then everyone's start titles
 * (`everyone`), each title once and only with a poster. Until For you arrives, its titles are simply not there yet.
 */
export function memberShelf(
	data: Pick<MemberStartData, "wishlist" | "continue" | "forYou">,
	everyone: readonly ShelfTitle[],
): ShelfTitle[] {
	const seen = new Set<string>()
	const shelf: ShelfTitle[] = []
	for (const title of [
		...(data.wishlist?.titles ?? []),
		...(data.continue?.titles ?? []).map((show) => show.card),
		...(data.forYou?.titles ?? []),
		...everyone,
	]) {
		const id = `${title.media_type}:${title.tmdb_id}`
		if (!title.poster_path || seen.has(id)) continue
		seen.add(id)
		shelf.push(title)
		if (shelf.length === MEMBER_SHELF_SIZE) break
	}
	return shelf
}

/** A member with nothing read: what the page shows when the member's data couldn't be read at all. */
export const UNREAD_MEMBER: MemberStartData = {
	ratings: 0,
	services: [],
	tonight: null,
	continue: null,
	wishlist: null,
	forYou: null,
	hotOn: false,
	hot: null,
}

/** "S2 E1 · Name", or "S2 E1" when the episode has no name of its own. */
export function episodeLine(next: NextEpisode): string {
	const code = episodeCode(next)
	const name = next.name?.trim()
	return name && !/^episode \d+$/i.test(name) ? `${code} · ${name}` : code
}

/** The shows to continue: Continue (most recently active first), then Pick up, each once. */
export function continueRows(shows: Pick<MyShows, "continue" | "pickUp">) {
	const seen = new Set<number>()
	return [...shows.continue, ...shows.pickUp].filter((row) => {
		if (seen.has(row.id)) return false
		seen.add(row.id)
		return true
	})
}

/** Tonight's pick as Watch next decides it from the same parts. */
export const tonightChoice = (parts: Pick<TonightParts, "shows" | "movies">) =>
	tonightsPickOf(parts.shows, parts.movies[0]?.tmdb_id ?? null)

/** One hot title before its card is read. */
export type HotPick = {
	mediaType: "movie" | "show"
	tmdbId: number
	rank: number
	why: string
}

/**
 * The hot titles a door shows: the first MEMBER_LIST_SIZE with a poster, with why each is talked about (`whyOf`:
 * Hot on socials' own line, ui/talked-about-now/parts.tsx).
 */
export function hotTitles(
	row: TalkedRow,
	whyOf: (title: TalkedTitle) => string,
): HotPick[] {
	return row.titles
		.filter((title) => title.poster)
		.slice(0, MEMBER_LIST_SIZE)
		.map((title) => ({
			mediaType: title.mediaType,
			tmdbId: title.tmdbId,
			rank: title.rank,
			why: whyOf(title),
		}))
}

/** Two lists taking turns, each title once. */
export function interleave<T extends { key: number }>(
	a: readonly T[],
	b: readonly T[],
): T[] {
	const out: T[] = []
	const keys = new Set<number>()
	for (let i = 0; i < Math.max(a.length, b.length); i++)
		for (const item of [a[i], b[i]])
			if (item && !keys.has(item.key)) {
				keys.add(item.key)
				out.push(item)
			}
	return out
}
