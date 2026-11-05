// Before-typing picks reuse the For You ranking; trending and popular tropes complete the guest view.
import { decodeFingerprints } from "~/domain/for-you-page/contract"
import { DESK_SIZE, drawerOrder } from "~/domain/for-you-page/rail"
import { poolStats, rankPool } from "~/domain/for-you-page/rank"
import {
	recipeFitCounts,
	recipeFitScores,
} from "~/domain/for-you-page/recipe-fit"
import { LIBRARY, MIN_FIT, ownRecipes } from "~/domain/for-you-page/recipes"
import { FLAT, familyPushes, steerOf } from "~/domain/for-you-page/shape"
import { loadForYouPage } from "~/server/for-you-page/page.server"
import {
	type TitleDisplay,
	getDisplayFields,
} from "~/server/title-cards.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { cached } from "~/utils/cache"
import type { PaletteStart, PaletteTitle } from "~/utils/command-palette"
import { titleKey } from "~/utils/title-key"
import { popularTropes, rows } from "./catalog.server"
import { paletteFailure } from "./failures.server"

function titleOf(d: TitleDisplay): PaletteTitle {
	return {
		mediaType: d.media_type,
		tmdbId: d.tmdb_id,
		title: d.title,
		year: d.release_year ? String(d.release_year) : "",
		posterPath: d.poster_path,
		score: d.goodwatch_overall_score_normalized_percent,
		canonical_title: d.canonical_title,
		presentation: d.presentation,
	}
}
const guest: PaletteStart["forYou"] = {
	state: "guest",
	message: "Rate a few titles you love to get picks.",
	cta: { label: "Rate titles", href: "/taste/quiz" },
}
const rate: PaletteStart["forYou"] = {
	state: "rate",
	message: "Rate a few titles you love to get picks.",
	cta: { label: "Rate titles", href: "/taste/quiz" },
}
const unavailable: PaletteStart["forYou"] = {
	state: "unavailable",
	message: "For you is unavailable. Try again in a minute.",
	cta: { label: "Try again", href: "/watch/for-you" },
}
async function picks(request: Request): Promise<PaletteStart["forYou"]> {
	const page = await loadForYouPage(request)
	if (page.kind === "guest") return guest
	if (page.status !== "ready")
		return page.status === "empty" ? rate : unavailable
	const { taste } = page
	const pool = {
		...page.pool,
		fingerprints: decodeFingerprints(
			page.pool.fingerprints,
			page.pool.keys.length,
		),
	}
	const stats = poolStats(pool.fingerprints, pool.keys.length)
	const library = [...ownRecipes(taste.groups), ...LIBRARY]
	const count = recipeFitCounts(
		recipeFitScores(library, pool.keys.length, stats),
	)
	const edges = new Map(taste.attributes.map((a) => [a.key, a.edge]))
	const like = Object.fromEntries(
		library.map((recipe) => {
			let sum = 0
			let total = 0
			for (const [key, weight] of Object.entries(recipe.attrs)) {
				sum += weight * (edges.get(key) ?? 0)
				total += Math.abs(weight)
			}
			return [recipe.id, total ? sum / total : 0]
		}),
	)
	const byId = new Map(library.map((r) => [r.id, r]))
	const pushes = familyPushes(taste)
	const tiles = drawerOrder(
		library.filter((r) => (count[r.id] ?? 0) >= MIN_FIT),
		FLAT,
		undefined,
		{ count, like },
		DESK_SIZE,
	)
		.flatMap((id) => {
			const recipe = byId.get(id)
			return recipe?.yours ? [recipe] : []
		})
		.slice(0, 3)
		.map((recipe) => ({
			label: recipe.name,
			href: `/watch/for-you?recipe=${encodeURIComponent(recipe.id)}`,
			keys: rankPool(
				pool,
				stats,
				taste,
				steerOf(recipe, recipe.shape, pushes),
				{ reasonsTop: 0 },
			)
				.slice(0, 6)
				.map((r) => pool.keys[r.index]),
		}))
	const keyOf = (key: string) => {
		const match = /^(movie|show)-(\d+)$/.exec(key)
		return match
			? titleKey(match[1] as "movie" | "show", Number(match[2]))
			: null
	}
	const displays = await getDisplayFields(
		tiles.flatMap((tile) =>
			tile.keys.flatMap((key) => {
				const id = keyOf(key)
				return id == null ? [] : [id]
			}),
		),
	)
	const result = tiles
		.map(({ keys, ...tile }) => ({
			...tile,
			titles: keys.flatMap((key) => {
				const id = keyOf(key)
				const d = id == null ? undefined : displays.get(id)
				return d ? [titleOf(d)] : []
			}),
		}))
		.filter((tile) => tile.titles.length)
	return result.length ? { state: "picks", tiles: result } : rate
}
async function trending(): Promise<PaletteTitle[]> {
	const result = await cached({
		name: "command-palette-trending-v2",
		params: {},
		ttlMinutes: 2,
		staleMinutes: 0,
		target: async () => {
			const found = await rows<[string, number]>(
				"SELECT kind, tmdb_id FROM buzz_trending WHERE snapshot_day = (SELECT max(snapshot_day) FROM buzz_trending) ORDER BY rank LIMIT 40",
			)
			const keys = found.map(([kind, id]) =>
				titleKey(kind === "show" || kind === "tv" ? "show" : "movie", id),
			)
			const displays = await getDisplayFields(keys)
			return {
				titles: keys
					.flatMap((key) => {
						const d = displays.get(key)
						return d?.poster_path ? [titleOf(d)] : []
					})
					.slice(0, 12),
			}
		},
	})
	return result.titles
}
export async function getPaletteStart(request: Request): Promise<PaletteStart> {
	const userId = (await getUserIdFromRequest({ request })) ?? null
	const [forYou, titles] = await Promise.all([
		userId
			? cached({
					name: "command-palette-start-v2",
					params: { userId },
					ttlMinutes: 1,
					staleMinutes: 0,
					target: () => picks(request),
				}).catch((error) => {
					paletteFailure("start-picks", error)
					return unavailable
				})
			: Promise.resolve(guest),
		trending().catch((error) => {
			paletteFailure("start-trending", error)
			return []
		}),
	])
	return { forYou, trending: titles, tropes: popularTropes() }
}
