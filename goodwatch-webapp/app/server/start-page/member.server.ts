// A member's own start (docs/implementation/start-page-redesign.md, "Member start"): the titles of their lists that
// "this or that" deals from, and the "Go deeper" doors' sections. A member's page is never stored, so everything here
// is the member's own.
//
// The reads are the site's own, each with its cache:
// - Tonight's pick and the shows to continue: `getTonightParts` (home-doors.server.ts), as the TV's loader reads them.
// - The Wishlist's movies: Watch next's plan over the Wishlist (`planWatchNext`), in My movies' order. Its sort facts
//   are kept in process memory (`sortFactsOutsideSnapshot`); the plan itself is in memory.
// - For you: Discover's results with For you on (`getDiscoverResults`), movies and shows, through Discover's filter
//   cache. Not read without a single rating: without taste it would only be the popular titles.
// - Hot on socials: the page's ranking (`getHotOnSocials`, shared and kept 10 minutes), while the surface is on.
// - The cards: `getTitleCards`, one read for the shows and one for the hot titles.
// Every read starts as soon as what it needs is there, side by side; none waits for another list. A read that fails
// leaves its list `null` (the door says it couldn't load) and never fails the page.
//
// The page waits for the member's own lists (Tonight's pick, Continue, the Wishlist): "this or that" deals from them
// and the first door is usually one of them. For you and Hot on socials are the slow reads (Discover's ranking, the
// shared ranking and its cards), so they come later in the same response (`later`, streamed with Remix's `defer`)
// and the page doesn't wait for them, except for the one door that opens on load: the open door's section is in the
// server's HTML. The open door is decided before they arrive (`openDoorOf`, from the own lists, the ratings and
// whether Hot on socials shows), so when it is For you or Hot on socials, that list is read before the page and the
// other still comes later.
//
// Nothing here writes: no list exposure, no history. "This or that" happens in the browser and writes nothing either.
import type { TonightParts } from "~/server/home-doors.server"
import { talkedAboutNowEnabled } from "~/server/talked-about-now/flags.server"
import type { Taste } from "~/server/taste/index.server"
import type { TitleCard } from "~/server/title-cards.server"
import type { ViewerContext } from "~/server/viewer.server"
import { openDoorOf } from "~/ui/start/member/doors"
import {
	type HotPick,
	MEMBER_LIST_SIZE,
	type MemberStartData,
	type MemberStartLater,
	continueRows,
	episodeLine,
	hotTitles,
	interleave,
	tonightChoice,
} from "~/ui/start/member/member-data"
import { type TitleKey, titleKey } from "~/utils/title-key"

export type { MemberStartData, MemberStartLater }

/** What the member start reads. The defaults are the site's reads; tests pass their own. */
export interface MemberStartReads {
	viewer(request: Request, userId: string): Promise<ViewerContext>
	taste(userId: string): Promise<Taste>
	tonightParts(
		ctx: ViewerContext,
		taste: Taste,
		now: number,
	): Promise<TonightParts>
	/** The Wishlist's movies in My movies' order (at most MEMBER_LIST_SIZE), and how many there are. */
	wishlist(
		ctx: ViewerContext,
		taste: Taste,
	): Promise<{ cards: TitleCard[]; total: number }>
	/** For you's first titles of one kind. */
	forYou(ctx: ViewerContext, kind: "movie" | "show"): Promise<TitleCard[]>
	/** Whether the member sees Hot on socials. */
	hotEnabled(userId: string): boolean
	/** Hot on socials' ranking, its first titles with why each is talked about; null when there is none. */
	hot(): Promise<HotPick[] | null>
	cards(
		keys: TitleKey[],
		ctx: ViewerContext,
		taste: Taste,
	): Promise<TitleCard[]>
}

export const memberStartReads: MemberStartReads = {
	async viewer(request, userId) {
		const { getViewerContext } = await import("~/server/viewer.server")
		return getViewerContext(request, undefined, userId)
	},
	async taste(userId) {
		const { loadMemberTaste } = await import("~/server/taste/member.server")
		return loadMemberTaste(userId)
	},
	async tonightParts(ctx, taste, now) {
		const { getTonightParts } = await import("~/server/home-doors.server")
		return getTonightParts(ctx, taste, now)
	},
	async wishlist(ctx, taste) {
		const [{ planWatchNext, sortFactsOutsideSnapshot }, { getTitleCards }] =
			await Promise.all([
				import("~/server/watch-next.server"),
				import("~/server/title-cards.server"),
			])
		const outside = await sortFactsOutsideSnapshot(ctx.wishlist.keys())
		// My movies' first view: Best match (Last added without taste), on the member's services first, any mood.
		const plan = planWatchNext(
			ctx,
			taste,
			{ onMyServices: true, moods: [], kind: "movie" },
			outside,
		)
		const keys = [
			...new Set([
				...plan.head.map((entry) => entry.key),
				...plan.tiers.flatMap((tier) => tier.keys),
			]),
		]
		// A title the catalog lacks is left out of the cards; read a few more so the grid stays full.
		const cards = await getTitleCards(
			keys.slice(0, MEMBER_LIST_SIZE + 4),
			ctx,
			taste,
		)
		return { cards: cards.slice(0, MEMBER_LIST_SIZE), total: plan.total }
	},
	async forYou(ctx, kind) {
		const [
			{ filterStateFromParams, sortFromParams },
			{ readyToWatchDefaults, getDiscoverResults },
		] = await Promise.all([
			import("~/domain/filter-state"),
			import("~/server/discover-results.server"),
		])
		const params = new URLSearchParams({ type: kind })
		const results = await getDiscoverResults(ctx, {
			state: filterStateFromParams(params, readyToWatchDefaults(ctx)),
			sort: sortFromParams(params, false),
			forYou: true,
			page: 1,
			// The start page shows a few of these titles; it is not a Discover page view.
			exposure: false,
		})
		return results.cards.slice(0, MEMBER_LIST_SIZE)
	},
	hotEnabled(userId) {
		return talkedAboutNowEnabled("row", userId)
	},
	async hot() {
		const [{ getHotOnSocials }, { why }] = await Promise.all([
			import("~/server/talked-about-now/start-row.server"),
			import("~/ui/talked-about-now/parts"),
		])
		const row = await getHotOnSocials()
		return row ? hotTitles(row, why) : null
	},
	async cards(keys, ctx, taste) {
		const { getTitleCards } = await import("~/server/title-cards.server")
		return getTitleCards(keys, ctx, taste)
	},
}

/** Logs a failed read and answers null, so one list's failure leaves the rest of the page. */
const orNull =
	(what: string) =>
	(error: unknown): null => {
		console.error(`Member start: reading ${what} failed`, error)
		return null
	}

/** What the page waits for, and the lists that come later in the same response. */
export type MemberStart = { data: MemberStartData; later: MemberStartLater }

export async function loadMemberStart(
	request: Request,
	userId: string,
	reads: MemberStartReads = memberStartReads,
	now = Date.now(),
): Promise<MemberStart> {
	const started = performance.now()
	const viewer = reads.viewer(request, userId)
	const taste = reads.taste(userId)
	const hotOn = reads.hotEnabled(userId)
	// The ranking is the same for everyone: start it at once.
	const hotRow = hotOn ? reads.hot().catch(orNull("Hot on socials")) : null
	const both = Promise.all([viewer, taste])

	const shows = both.then(async ([ctx, t]) => {
		const parts = await reads.tonightParts(ctx, t, now)
		const rows = continueRows(parts.shows)
		const listed = rows.slice(0, MEMBER_LIST_SIZE)
		const choice = tonightChoice(parts)
		// Tonight's pick is the show last active on, while Continue is in its own order: the pick's show can be past the
		// first titles, so its card is read with them.
		const chosen =
			choice?.kind === "episode" || choice?.kind === "start"
				? titleKey("show", choice.showId)
				: null
		const keys = [
			...new Set([
				...listed.map((row) => titleKey("show", row.id)),
				...(chosen === null ? [] : [chosen]),
			]),
		]
		const cards = keys.length ? await reads.cards(keys, ctx, t) : []
		const byKey = new Map(cards.map((card) => [card.key, card]))
		const list = listed.flatMap((row) => {
			const card = byKey.get(titleKey("show", row.id))
			return card
				? [{ card, episode: row.next ? episodeLine(row.next) : null }]
				: []
		})
		const chosenCard = chosen === null ? undefined : byKey.get(chosen)
		const chosenRow =
			choice?.kind === "episode"
				? rows.find((row) => row.id === choice.showId)
				: undefined
		const tonight =
			choice?.kind === "episode"
				? chosenCard
					? {
							card: chosenCard,
							episode: chosenRow?.next ? episodeLine(chosenRow.next) : null,
							source: "continue" as const,
						}
					: null
				: choice?.kind === "movie" && parts.movies[0]
					? {
							card: parts.movies[0],
							episode: null,
							source: "wishlist" as const,
						}
					: choice?.kind === "start" && chosenCard
						? { card: chosenCard, episode: null, source: "wishlist" as const }
						: null
		return { list, total: rows.length, tonight }
	})

	const wishlist = both.then(([ctx, t]) => reads.wishlist(ctx, t))

	const forYou = both
		.then(async ([ctx, t]) => {
			if (!t.ratings) return { titles: [], total: 0 }
			const [movies, series] = await Promise.all([
				reads.forYou(ctx, "movie"),
				reads.forYou(ctx, "show"),
			])
			const titles = interleave(movies, series).slice(0, MEMBER_LIST_SIZE)
			return { titles, total: titles.length }
		})
		.catch(orNull("For you"))

	const hot = hotRow
		? Promise.all([hotRow, both])
				.then(async ([row, [ctx, t]]) => {
					if (!row) return null
					const cards = row.length
						? await reads.cards(
								row.map((title) => titleKey(title.mediaType, title.tmdbId)),
								ctx,
								t,
							)
						: []
					const byKey = new Map(cards.map((card) => [card.key, card]))
					const titles = row.flatMap((title) => {
						const card = byKey.get(titleKey(title.mediaType, title.tmdbId))
						return card ? [{ card, rank: title.rank, why: title.why }] : []
					})
					return { titles, total: titles.length }
				})
				.catch(orNull("Hot on socials"))
		: null

	const [ctx, t, own, movies] = await Promise.all([
		viewer,
		taste,
		shows.catch(orNull("shows")),
		wishlist.catch(orNull("the Wishlist")),
	])
	const data: MemberStartData = {
		ratings: t.ratings,
		services: ctx.services,
		tonight: own?.tonight ?? null,
		continue: own ? { titles: own.list, total: own.total } : null,
		wishlist: movies ? { titles: movies.cards, total: movies.total } : null,
		hotOn,
		// Without Hot on socials there is nothing to wait for.
		...(hot ? {} : { hot: null }),
	}
	// Without a rating For you isn't read: it is known to be empty, nothing to wait for.
	if (!t.ratings) data.forYou = await forYou
	// The open door's list is read before the page. If it turns out empty, the next door opens instead: read that too.
	for (;;) {
		const open = openDoorOf(data)
		if (open === "forYou" && data.forYou === undefined)
			data.forYou = await forYou
		else if (open === "hot" && data.hot === undefined)
			data.hot = hot ? await hot : null
		else break
	}
	console.info(
		`Member start computed in ${Math.round(performance.now() - started)} ms`,
	)
	return {
		data,
		later: {
			...(data.forYou === undefined ? { forYou } : {}),
			...(data.hot === undefined && hot ? { hot } : {}),
		},
	}
}
