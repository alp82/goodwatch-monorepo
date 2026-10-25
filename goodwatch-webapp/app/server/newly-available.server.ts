// Newly available on a member's services (#456): which of a member's Want to See titles, and of the shows they are
// Watching or have On hold, landed on one of their saved services since they last opened the page the title lives
// on. And which of them landed in the last 14 days, whether the member opened the page or not (#489): the row on
// My movies and My shows, the mark on a poster, and the first title of a home door. The rules are in
// domain/newly-available.ts.
//
// Reads: the member data and the settings (both cached), and the availability index, which is in memory. Only when
// a title landed after the launch are the two visits read, each by its whole key, and the name of the title when
// it is the only one of its kind. The titles of the last 14 days are read by key for the pages that list them. For
// every other request that is no statement at all (docs/implementation/tracking/newly-available/README.md).
import {
	type Candidate,
	type Landed,
	type LandedTitles,
	type NewlyAvailable,
	daysSinceLanding,
	listedLandingsOf,
	newlyAvailableOf,
	recentlyLandedOf,
	titlesThatCanLand,
} from "~/domain/newly-available"
import type { LandedTitle, NewOn } from "~/domain/newly-available-words"
import { launchTime } from "~/server/availability-first-seen.server"
import { landingsOnServices } from "~/server/availability-index.server"
import { MY_SHOWS_VISIT_KEY } from "~/server/new-episodes.server"
import {
	MAX_KEYS,
	getDisplayFields,
	getServiceCards,
} from "~/server/title-cards.server"
import { MY_SHOWS_VISIT_QUERY } from "~/server/tracking-sql"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserData } from "~/server/userData.server"
import { type ViewerContext, getViewerContext } from "~/server/viewer.server"
import { query, upsert } from "~/utils/crate"
import { brandName, getShorterProviderLabel } from "~/utils/streaming-links"
import type { TitleKey } from "~/utils/title-key"

/** The member's row of `user_setting` that holds when they last opened My movies, as an ISO time. */
export const MY_MOVIES_VISIT_KEY = "my_movies_visited_at"

const NOTHING: NewlyAvailable = {
	movies: { ids: [], only: null },
	shows: { ids: [], only: null },
}

/** When the member last opened a page, in milliseconds; null when they never did. A read by key (Q10). */
async function readVisit(userId: string, key: string): Promise<number | null> {
	const [row] = await query<{ value: string }>(MY_SHOWS_VISIT_QUERY, [
		userId,
		key,
	])
	const at = row ? Date.parse(row.value) : Number.NaN
	return Number.isNaN(at) ? null : at
}

/** The member has opened My movies: the movies that landed up to now are no longer news. */
export async function recordMyMoviesVisit(
	userId: string,
	now = Date.now(),
): Promise<void> {
	await upsert({
		table: "user_setting",
		data: [
			{
				user_id: userId,
				key: MY_MOVIES_VISIT_KEY,
				value: new Date(now).toISOString(),
			},
		],
		conflictColumns: ["user_id", "key"],
	})
}

/** The titles of one kind that are news. One is named with the service it landed on; several are counted. */
async function named(landed: Landed[]): Promise<LandedTitles> {
	const ids = landed.map(({ tmdbId }) => tmdbId)
	if (landed.length !== 1) return { ids, only: null }
	const [{ key, service: serviceId }] = landed
	const [displays, [service]] = await Promise.all([
		getDisplayFields([key]),
		getServiceCards([serviceId]),
	])
	// A title the catalog lacks is counted and not named.
	const title = displays.get(key)?.title
	return {
		ids,
		only: title && service ? { title, service: service.name } : null,
	}
}

/**
 * The member's titles that can land, each with when it landed on their services. Null for a guest, and for a
 * member without a saved country or a saved service: a guessed country does not say where they watch.
 */
async function landedCandidates(
	ctx: ViewerContext,
): Promise<Candidate[] | null> {
	if (ctx.viewer.kind !== "member" || !ctx.services.length) return null
	const { userId } = ctx.viewer
	const [settings, userData] = await Promise.all([
		getUserSettings({ userId }),
		getUserData({ user_id: userId }),
	])
	if (!/^[A-Za-z]{2}$/.test(settings.country_default?.trim() ?? "")) return null

	const titles = titlesThatCanLand(ctx.wishlist, userData.watchState)
	const landings = landingsOnServices(
		ctx.country,
		ctx.services,
		titles.map(({ key }) => key),
	)
	return titles
		.map((title, i) => ({ ...title, landing: landings[i] }))
		.filter(({ landing }) => landing)
}

/** What landed on the member's services and is news to them. Nothing for a guest. */
export async function getNewlyAvailable(
	ctx: ViewerContext,
): Promise<NewlyAvailable> {
	const candidates = await landedCandidates(ctx)
	if (!candidates?.length || ctx.viewer.kind !== "member") return NOTHING
	const { userId } = ctx.viewer
	const launch = launchTime()
	// Without a visit yet, everything since the launch counts: usually nothing, and then no visit is read.
	const unseen = newlyAvailableOf(candidates, {
		launch,
		visits: { movie: null, show: null },
	})
	if (!unseen.movies.length && !unseen.shows.length) return NOTHING

	const [movie, show] = await Promise.all([
		unseen.movies.length ? readVisit(userId, MY_MOVIES_VISIT_KEY) : null,
		unseen.shows.length ? readVisit(userId, MY_SHOWS_VISIT_KEY) : null,
	])
	const news = newlyAvailableOf(candidates, { launch, visits: { movie, show } })
	const [movies, shows] = await Promise.all([
		named(news.movies),
		named(news.shows),
	])
	return { movies, shows }
}

// ---------------------------------------------------------------------------------------------------------
// Recently landed (#489)

/**
 * The member's titles that landed in the last 14 days, movies and shows apart, the latest first. From memory: no
 * statement. Nothing for a guest.
 */
export async function getLandings(
	ctx: ViewerContext,
	now = Date.now(),
): Promise<{ movies: Landed[]; shows: Landed[] }> {
	const candidates = await landedCandidates(ctx)
	if (!candidates?.length) return { movies: [], shows: [] }
	return recentlyLandedOf(candidates, { launch: launchTime(), now })
}

/** A service's short name, as the title page and Watch next say it: "Prime", "Disney+". */
const shortName = (name: string) => brandName(getShorterProviderLabel(name))

/** The services some landings are on, by id, each with its short name and its logo. */
export async function newOnOf(
	landed: readonly Landed[],
): Promise<Map<number, NewOn>> {
	const ids = [...new Set(landed.map(({ service }) => service))]
	if (!ids.length) return new Map()
	// One by one: a list of ids is answered with one service per name.
	const cards = await Promise.all(ids.map((id) => getServiceCards([id])))
	return new Map(
		cards.flatMap(([card]) =>
			card ? [[card.id, { ...card, name: shortName(card.name) }]] : [],
		),
	)
}

/**
 * The service each of the member's titles is new on, by title, for a list that marks its titles: the Want to See
 * list. From memory, like `getLandings`.
 */
export async function getNewOn(
	ctx: ViewerContext,
	now = Date.now(),
): Promise<Map<TitleKey, NewOn>> {
	const { movies, shows } = await getLandings(ctx, now)
	const landed = [...movies, ...shows]
	const services = await newOnOf(landed)
	return new Map(
		landed.flatMap(({ key, service }) => {
			const found = services.get(service)
			return found ? [[key, found]] : []
		}),
	)
}

/**
 * The same for a member's request for their Want to See list, and nothing for any other list. A list without its
 * marks is still the list, so a failed read is logged and answered with nothing.
 */
export async function newOnForLibrary(
	request: Request,
	userId: string,
	status: string,
): Promise<Map<TitleKey, NewOn> | undefined> {
	if (status !== "want") return undefined
	try {
		return await getNewOn(await getViewerContext(request, undefined, userId))
	} catch (error) {
		console.error("My library: reading what landed failed:", error)
		return undefined
	}
}

export interface RecentlyLanded {
	movies: LandedTitle[]
	shows: LandedTitle[]
}

/**
 * What My movies and My shows list and mark: the titles that landed on the member's services in the last 14 days,
 * and the older ones that are still news to them, which the signal that led to the page counts (#456). The visits
 * are read only for a member with a landing older than the 14 days, and the display fields of the titles (cached)
 * only when something is listed. A title the catalog lacks is left out.
 */
export async function getRecentlyLanded(
	ctx: ViewerContext,
	now = Date.now(),
): Promise<RecentlyLanded> {
	const candidates = await landedCandidates(ctx)
	if (!candidates?.length || ctx.viewer.kind !== "member")
		return { movies: [], shows: [] }
	const { userId } = ctx.viewer
	const launch = launchTime()
	const recent = recentlyLandedOf(candidates, { launch, now })
	const since = newlyAvailableOf(candidates, {
		launch,
		visits: { movie: null, show: null },
	})
	const [movie, show] = await Promise.all([
		since.movies.length > recent.movies.length
			? readVisit(userId, MY_MOVIES_VISIT_KEY)
			: null,
		since.shows.length > recent.shows.length
			? readVisit(userId, MY_SHOWS_VISIT_KEY)
			: null,
	])
	const { movies, shows } = listedLandingsOf(candidates, {
		launch,
		now,
		visits: { movie, show },
	})
	if (!movies.length && !shows.length) return { movies: [], shows: [] }
	// More than a page lists is a catch-up the index let through: the latest are enough.
	const some = {
		movies: movies.slice(0, MAX_KEYS / 2),
		shows: shows.slice(0, MAX_KEYS / 2),
	}
	const listed = [...some.movies, ...some.shows]
	const [displays, services] = await Promise.all([
		getDisplayFields(listed.map(({ key }) => key)),
		newOnOf(listed),
	])
	const titles = (landed: Landed[]) =>
		landed.flatMap((landing): LandedTitle[] => {
			const display = displays.get(landing.key)
			if (!display) return []
			return [
				{
					mediaType: display.media_type,
					tmdbId: landing.tmdbId,
					title: display.title,
					poster_path: display.poster_path,
					goodwatch: display.goodwatch_overall_score_normalized_percent ?? null,
					at: landing.at,
					days: daysSinceLanding(landing.at, now),
					service: services.get(landing.service) ?? null,
				},
			]
		})
	return { movies: titles(some.movies), shows: titles(some.shows) }
}
