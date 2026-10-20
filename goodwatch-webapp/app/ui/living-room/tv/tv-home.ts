import type { PresentedMedia } from "../../../utils/media-presentation.ts"
import { copyMediaPresentation } from "../../../utils/media-presentation.ts"
// What the new TV's home shows, and how the page's data becomes the machine's `TvContext`. Pure, shared by the
// server (server/living-room/tv-loader.server.ts shapes `TvHomeData`) and the browser.
//
// A guest's first paint is the same for every guest: the tiles, and one picture, the first start title's backdrop.
// The pool (`POST /api/living-room/picks?view=pool`) arrives after the first interaction and swaps in the person's
// own picks. A member's Tonight and My shows come with the loader; a member asks for the pool only for the
// Discover tile's posters and the service tiles' pictures.
//
// The person's two streaming services come with the loader too (`TvService`): a member's first two saved ones,
// filled up with Netflix and Prime Video, which are a guest's. The Remote's two keys and home's two tiles after
// the apps stand for them.
import type { TitleCard } from "~/server/title-cards.server"
import { QUIZ_GOAL } from "../../taste-quiz/quiz-flow.ts"
import { TASTE_GROUPS_NAME } from "../../taste/taste-groups-name.ts"
import type { StartTitle } from "../living-room-data"
import type { TvListTitle } from "./TitleList.tsx"
import {
	EMPTY_CONTEXT,
	TITLE_KEY,
	TONIGHT_PICKS,
	TV_APPS,
	type TvApp,
	type TvContext,
} from "./tv-machine.ts"

/** One of Tonight's picks. */
export type TvTonightPick = {
	card: TitleCard
	/** The member page the pick is the first thing on; null for a guest's pick. */
	href: string | null
	/** A guest's own Tonight's pick: the last title they added to the Wishlist in their browser. */
	wished?: boolean
	/** When the pick is a Next episode: "S2 E3" and its name. */
	episode?: { code: string; name: string | null; language?: string }
}

/** A show with a Next episode, as My shows lists it on the TV. */
export type TvShowNext = PresentedMedia & {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	/** Null when the show's episode list was not read. */
	episode: { code: string; name: string | null; language?: string; runtime: number | null } | null
	// My shows (slice 9).
	/** Aired episodes not watched yet: what is left of a Watching show, what is new on a Seen one. */
	left?: number
	/** A Seen show with new episodes: `left` counts what is new since the member saw it. */
	caughtUp?: boolean
}

/** A Want to See show the member has not started. */
export type TvShowStart = PresentedMedia & {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
	match: number | null
	service: string | null
	// My shows (slice 9).
	seasons?: number | null
}

/**
 * A streaming service that a key of the Remote and a tile of home stand for. The Remote has a drawn mark for
 * Netflix and for Prime Video (`ServiceMark`, ui/living-room/Remote.tsx); any other shows the catalog's logo.
 */
export type TvService = {
	/** Its TMDB provider id, which Discover's `services` parameter takes. */
	id: number
	/** Its name as the app says it in a line: "Netflix", "Prime", "Disney+". */
	name: string
	/** The catalog's logo, a TMDB path; null when the catalog has none. */
	logo_path: string | null
}

/** What the loader of the start page with the new TV returns. */
export type TvHomeData = {
	member: boolean
	/** The titles below the room, the same for everyone. Empty while the title snapshot loads. */
	startTitles: StartTitle[]
	/** The first start title's backdrop: the home's first picture until the person's own picks are there. */
	picture: string | null
	/** A member's Tonight, Tonight's pick first. Empty for a guest, and for a member with nothing to pick from. */
	tonight: TvTonightPick[]
	/** A member's My shows on the TV. Null for a guest. */
	shows: { next: TvShowNext[]; start: TvShowStart[] } | null
	/**
	 * The person's two streaming services: a member's first two saved ones, filled up with Netflix and Prime
	 * Video, which are a guest's, so a guest's HTML is the same for every guest.
	 */
	services: TvService[]
	/**
	 * A member's country and saved services, as the Discover page's loader gives them to its search: the TV's
	 * search narrows its ranking to them as the page does (tv-search.ts). A guest's are in their browser, and
	 * nothing of them is in the HTML.
	 */
	scope?: { country: string; services: number[] }
	/** "Talked about now" below the room (#557), for this viewer. Absent while the feature is off for them. */
	talked?: true
	/**
	 * A member's Sides of you, as home's list shows them (#673): the side holding the best pick in personal order
	 * first. Absent for a guest; empty for a member without sides, whose home stays the row of tiles.
	 */
	sides?: TvHomeSide[]
}

/**
 * One side of the member's taste on home: its entry in the list under the apps, and what shows on the right while
 * it is on. Shaped on the server (server/living-room/tv-sides.server.ts).
 */
export type TvHomeSide = {
	id: string
	/** The loved titles it is shown by: its most typical, one per franchise, up to four. */
	loved: { key: string; title: string; poster: string | null }[]
	/** Unseen titles of the side, in the member's personal order when it is on for them. */
	picks: TvListTitle[]
	/** The member has services and too few of the picks stream there, so the picks are from everywhere. */
	fewOnServices: boolean
	/** Watch next with the side's moods. */
	watchNext: string
	/** The side's name and its moods' names: null when a side has none. */
	words: { name: string; moods: string[] } | null
}

/** What the TV reads of the pool: its suggestions, best first for the person, and whose services are theirs. */
export type TvPool = {
	suggestions: TitleCard[]
	/** A member's saved services, by name, as the pool answers them. */
	savedServices?: string[]
	/** A guest's saved services, by id: what their browser sent with the request (use-tv-pool.ts adds it). */
	ownServiceIds?: number[]
	/**
	 * Mini Discover's tile pictures: a backdrop's path per option, by its item (`mood:funny`, `theme:crime`,
	 * `style:slow`). An option without a title has none. The same for everyone.
	 */
	choiceArt?: Record<string, string>
}

/** A title's key on the TV and in its URL: `<media_type>-<tmdb_id>`. */
export const tvTitleKey = (title: { media_type: string; tmdb_id: number }) =>
	`${title.media_type}-${title.tmdb_id}`

/**
 * My shows (slice 9): what My shows knows of a show, by its key on the TV, so a show's title screen names it at
 * once (`TvKnownTitle` in tv-title.ts). Null for a title that is not one of the member's shows on the TV.
 */
export function knownShow(data: Pick<TvHomeData, "shows">, key: string) {
	const show = [...(data.shows?.next ?? []), ...(data.shows?.start ?? [])].find(
		(one) => `show-${one.id}` === key,
	)
	return show
		? {
				media_type: "show" as const,
				tmdb_id: show.id,
				...copyMediaPresentation(show),
				title: show.title,
				poster_path: show.poster_path,
				backdrop_path: show.backdrop_path,
			}
		: null
}

/**
 * How ready a title is to be watched tonight: 0 when it streams on one of the person's own services, 1 when it
 * streams on another service in their country, 2 when it streams nowhere there or nobody knows yet (a card's
 * services are null while the country's availability loads).
 */
export function watchRank(
	card: Pick<TitleCard, "services">,
	pool: Pick<TvPool, "savedServices" | "ownServiceIds">,
): 0 | 1 | 2 {
	if (!card.services?.length) return 2
	const names = pool.savedServices ?? []
	const ids = pool.ownServiceIds ?? []
	return card.services.some(
		(service) => ids.includes(service.id) || names.includes(service.name),
	)
		? 0
		: 1
}

/**
 * The pool's titles in the order Tonight offers them. Tonight is for watching tonight: the titles that stream on
 * the person's own services come first, then those that stream on another service in their country, then the
 * rest. Inside each group the pool's own order stays (best first for the person). Nothing is left out, so when
 * too few titles stream, the picks are filled up with the best of the rest, which say "Not streaming".
 */
export function tonightOrder(pool: TvPool): TitleCard[] {
	return pool.suggestions
		.map((card, at) => ({ card, at, rank: watchRank(card, pool) }))
		.sort((a, b) => a.rank - b.rank || a.at - b.at)
		.map(({ card }) => card)
}

/**
 * Tonight's picks: a member's from the loader. A guest's, and those of a member with nothing to pick from, are the
 * first three of the pool in Tonight's order (`tonightOrder`), once the pool is there. `wished` is a guest's own
 * Tonight's pick, the last title on the Wishlist in their browser (`useTonightsPick`): it leads, as it does in the
 * site's navigation.
 */
export function tonightPicks(
	data: TvHomeData,
	pool: TvPool | null,
	wished: TitleCard | null = null,
): TvTonightPick[] {
	if (data.tonight.length) return data.tonight.slice(0, TONIGHT_PICKS)
	const best: TvTonightPick[] = (pool ? tonightOrder(pool) : [])
		.filter((card) => !wished || card.key !== wished.key)
		.map((card) => ({ card, href: null }))
	return [
		...(wished ? [{ card: wished, href: null, wished: true }] : []),
		...best,
	].slice(0, TONIGHT_PICKS)
}

/**
 * The machine's context for the screens built so far: home, the menu and What is GoodWatch? Each app's slice
 * adds what its screens show (the titles of a list, the islands, the sides, the quiz's progress, the draft).
 */
export function tvContextOf(
	data: TvHomeData,
	pool: TvPool | null,
	wished: TitleCard | null = null,
): TvContext {
	return {
		...EMPTY_CONTEXT,
		member: data.member,
		tonight: tonightPicks(data, pool, wished).map((pick) => ({
			title: tvTitleKey(pick.card),
			href: pick.href,
		})),
		nextEpisodes: (data.shows?.next ?? []).map((show) => `show-${show.id}`),
		toStart: (data.shows?.start ?? []).map((show) => `show-${show.id}`),
		services: data.services.map((service) => service.id),
		homeSides: homeSidesContext(data.sides ?? []),
	}
}

/** What the machine knows of home's sides: their ids, the keys of their picks, and where Watch next leads. */
export function homeSidesContext(
	sides: readonly TvHomeSide[],
): TvContext["homeSides"] {
	return sides.map((side) => ({
		id: side.id,
		picks: side.picks.map((pick) => pick.key),
		watchNext: side.watchNext,
	}))
}

/** What home's sides know of a title, so a pick's title screen names it at once. Null for any other title. */
export function knownHomePick(
	data: Pick<TvHomeData, "sides">,
	key: string,
) {
	for (const side of data.sides ?? []) {
		const pick = side.picks.find((one) => one.key === key)
		const [, mediaType, tmdbId] = TITLE_KEY.exec(key) ?? []
		if (pick && mediaType)
			return {
				media_type: mediaType as "movie" | "show",
				tmdb_id: Number(tmdbId),
				...copyMediaPresentation(pick),
				title: pick.title,
				poster_path: pick.poster,
				backdrop_path: pick.backdrop,
			}
	}
	return null
}

/** An app tile's picture: real art for Tonight, Discover and My shows, a drawing for Explorer and Taste. */
export type TvAppArt =
	/** A backdrop; without a path the tile is plain: dark, or of `color`, a service's own. */
	| { kind: "backdrop"; path: string | null; color?: string | null }
	/** Posters side by side. */
	| { kind: "posters"; paths: string[] }
	| { kind: "map" }
	| { kind: "print" }

export type TvAppTile = {
	app: TvApp
	name: string
	/** What the home says about the app while its tile has the focus. */
	line: string
	art: TvAppArt
	/** My shows (slice 9): the New episodes signal on the tile, the number and what a screen reader hears for it. */
	signal?: { badge: string; label: string }
}

/** The New episodes signal as home's My shows tile says it (`SignalWords` of domain/new-episodes-signal.ts). */
export type TvTileSignal = { badge: string; tile: string; door: string }

const APP_NAME: Record<TvApp, string> = {
	tonight: "Watch next",
	discover: "Discover",
	explorer: "Explorer",
	taste: "Taste",
	shows: "My shows",
}

/** How many posters the Discover tile shows. */
const DISCOVER_POSTERS = 4

/** Home's tiles in order, with what each shows. My shows is a member's. */
export function homeApps(
	data: TvHomeData,
	pool: TvPool | null,
	taste = false,
	wished: TitleCard | null = null,
	/** My shows (slice 9): what is new for the member's shows, or null. */
	fresh: TvTileSignal | null = null,
): TvAppTile[] {
	const picks = tonightPicks(data, pool, wished)
	const own = data.tonight.length > 0
	const best: { poster_path: string | null }[] =
		pool?.suggestions ?? data.startTitles
	// Until the pool is there, a guest's picture is the first start title's: for a visitor nobody knows anything
	// about it is the pool's best title.
	const tonightPicture = picks[0] ? picks[0].card.backdrop_path : data.picture
	// Tonight's pick is often the first show to continue: the My shows tile then takes the next show's picture, so
	// the two tiles don't show the same one.
	const shows = [...(data.shows?.next ?? []), ...(data.shows?.start ?? [])]
	const showPicture =
		shows.find(
			(show) => show.backdrop_path && show.backdrop_path !== tonightPicture,
		)?.backdrop_path ??
		shows[0]?.backdrop_path ??
		null
	const tile: Record<TvApp, Omit<TvAppTile, "app" | "name">> = {
		tonight: {
			line: !own
				? "One pick at a time, best rated right now."
				: picks[0].episode
					? "One pick at a time, your next episode first."
					: "One pick at a time, from your Wishlist.",
			art: { kind: "backdrop", path: tonightPicture },
		},
		discover: {
			line: "Pick a mood.",
			art: {
				kind: "posters",
				paths: best
					.flatMap((title) => title.poster_path ?? [])
					.slice(0, DISCOVER_POSTERS),
			},
		},
		explorer: { line: "Sail a small map of islands.", art: { kind: "map" } },
		taste: {
			line: taste
				? `${TASTE_GROUPS_NAME.title}.`
				: `Rate ${QUIZ_GOAL} titles, get picks made for you.`,
			art: { kind: "print" },
		},
		shows: {
			// The New episodes signal: one new show is named, several are counted.
			line: fresh ? `${fresh.tile}.` : "Your next episodes.",
			art: { kind: "backdrop", path: showPicture },
			...(fresh && { signal: { badge: fresh.badge, label: fresh.door } }),
		},
	}
	return TV_APPS.filter((app) => app !== "shows" || data.member).map((app) => ({
		app,
		name: APP_NAME[app],
		...tile[app],
	}))
}

/** A service's tile on home, after the apps. */
export type TvServiceTile = {
	service: TvService
	/** What the home says about the service while its tile has the focus. */
	line: string
	/**
	 * A picture from that service, a backdrop's path: the first of the person's picks that streams there. Null
	 * until one is known (before the pool is there, and when none of its titles streams there): the tile is then
	 * the service's own colour.
	 */
	picture: string | null
}

/** Whether a card streams on a service, by the catalog's id for it. */
const streamsOn = (card: Pick<TitleCard, "services">, service: TvService) =>
	Boolean(card.services?.some((one) => one.id === service.id))

/**
 * Home's tiles for the person's services, in the order of the Remote's keys. A tile's picture is the first of
 * Tonight's picks and then of the pool's titles that streams on the service, a picture no tile before it shows
 * (Tonight's tile and the service before it) while there is such a title.
 */
export function homeServices(
	data: TvHomeData,
	pool: TvPool | null,
	wished: TitleCard | null = null,
): TvServiceTile[] {
	const picks = tonightPicks(data, pool, wished).map((pick) => pick.card)
	const cards = [...picks, ...(pool?.suggestions ?? [])]
	const shown = new Set([picks[0]?.backdrop_path ?? data.picture])
	return data.services.map((service) => {
		const there = cards.filter(
			(card) => card.backdrop_path && streamsOn(card, service),
		)
		const picture =
			(there.find((card) => !shown.has(card.backdrop_path)) ?? there[0])
				?.backdrop_path ?? null
		shown.add(picture)
		return { service, line: `What to watch on ${service.name}.`, picture }
	})
}
