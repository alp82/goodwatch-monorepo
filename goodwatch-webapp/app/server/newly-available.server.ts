// Newly available on a member's services (#456): which of a member's Want to See titles, and of the shows they are
// Watching or have On hold, landed on one of their saved services since they last opened the page the title lives
// on. The rules are in domain/newly-available.ts.
//
// Reads: the member data and the settings (both cached), and the availability index, which is in memory. Only when
// a title landed after the launch are the two visits read, each by its whole key, and the names of up to three
// titles a kind. For every other request that is no statement at all
// (docs/implementation/tracking/newly-available/README.md).
import {
	type Landed,
	type LandedTitles,
	type NewlyAvailable,
	newlyAvailableOf,
	titlesThatCanLand,
} from "~/domain/newly-available"
import { LINE_NAMES } from "~/domain/newly-available-words"
import { launchTime } from "~/server/availability-first-seen.server"
import { landingsOnServices } from "~/server/availability-index.server"
import { MY_SHOWS_VISIT_KEY } from "~/server/new-episodes.server"
import { getDisplayFields, getServiceCards } from "~/server/title-cards.server"
import { MY_SHOWS_VISIT_QUERY } from "~/server/tracking-sql"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserData } from "~/server/userData.server"
import type { ViewerContext } from "~/server/viewer.server"
import { query, upsert } from "~/utils/crate"

/** The member's row of `user_setting` that holds when they last opened My movies, as an ISO time. */
export const MY_MOVIES_VISIT_KEY = "my_movies_visited_at"

const NOTHING: NewlyAvailable = {
	movies: { ids: [], titles: [], service: null },
	shows: { ids: [], titles: [], service: null },
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

async function named(landed: Landed[]): Promise<LandedTitles> {
	if (!landed.length) return NOTHING.movies
	const first = landed.slice(0, LINE_NAMES)
	const [displays, [service]] = await Promise.all([
		getDisplayFields(first.map(({ key }) => key)),
		getServiceCards([landed[0].service]),
	])
	return {
		ids: landed.map(({ tmdbId }) => tmdbId),
		// A title the catalog lacks is counted and not named.
		titles: first.flatMap(({ key }) => displays.get(key)?.title ?? []),
		service: service?.name ?? null,
	}
}

/**
 * What landed on the member's services and is news to them. Nothing for a guest, and for a member without a saved
 * country or a saved service: a guessed country does not say where they watch.
 */
export async function getNewlyAvailable(
	ctx: ViewerContext,
): Promise<NewlyAvailable> {
	if (ctx.viewer.kind !== "member" || !ctx.services.length) return NOTHING
	const { userId } = ctx.viewer
	const [settings, userData] = await Promise.all([
		getUserSettings({ userId }),
		getUserData({ user_id: userId }),
	])
	if (!/^[A-Za-z]{2}$/.test(settings.country_default?.trim() ?? ""))
		return NOTHING

	const titles = titlesThatCanLand(ctx.wishlist, userData.watchState)
	const landings = landingsOnServices(
		ctx.country,
		ctx.services,
		titles.map(({ key }) => key),
	)
	const candidates = titles
		.map((title, i) => ({ ...title, landing: landings[i] }))
		.filter(({ landing }) => landing)
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
