// The genre row of a title page: eight titles of the genre its breadcrumb shows, "More drama movies", linking to the
// genre page. pick.ts chooses them; this module hands it the genre's titles and what their cards show.
//
// A render reads nothing of its own: the sitemap's titles come with the build (the sitemap files' selection comment),
// the genre's titles from the title snapshot in memory (kept per snapshot version), and their cards' names and posters
// from a store in memory that a genre's first page fills in the background and that renews after six hours, like the
// title cards' cache it reads from. Until the store holds a card, the render reads it from that cache (memory, then
// Redis; Crate only for a title neither holds), while the page waits for the related map. A viewer's language takes
// the same title overlay as the rest of the page.

import {
	copyPresentationFields,
	overlayTitles,
} from "~/server/media-overlay.server"
import type { RelatedMapLookup } from "~/server/related-map.server"
import { titleGenrePage } from "~/server/title-breadcrumb.server"
import {
	MAX_KEYS,
	type TitleDisplay,
	getDisplayFields,
} from "~/server/title-cards.server"
import {
	FLAG_ADULT,
	FLAG_POSTER,
	type TitleSnapshot,
	getTitleSnapshot,
} from "~/server/title-snapshot/index.server"
import type { MediaPresentation } from "~/utils/media-presentation"
import { type TitleKey, titleKey } from "~/utils/title-key"
import movieSitemap from "../../../public/sitemaps/sitemap_movie_detail_0.xml?raw"
import showSitemap from "../../../public/sitemaps/sitemap_show_detail_0.xml?raw"
import {
	GENRE_ROW_SIZE,
	type GenreRowCandidate,
	genreRowHeading,
	pickGenreRow,
	rankGenreRow,
	sitemapSelection,
} from "./pick"

/** What a card of the row shows. */
export interface GenreRowTitle {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	goodwatch_overall_score_normalized_percent: number | null
	canonical_title?: string
	presentation?: MediaPresentation
}

export interface GenreRow {
	/** "More drama movies". */
	heading: string
	/** The genre page's path. */
	path: string
	titles: GenreRowTitle[]
}

/** The row, none (the title has no genre with a page, or the genre no titles), or late: the page is incomplete. */
export type GenreRowResult = GenreRow | null | "late"

// The genre's most voted titles outside the sitemap that a short row may take from.
const FALLBACK_POOL = 64
// Cards read early, before the related map is in: the row's eight and spares for the ones the map may take.
const SPARE = 16
// As long as the title cards' cache keeps a card.
const STORE_TTL_MS = 6 * 60 * 60 * 1000

const cohort = new Set<TitleKey>([
	...sitemapSelection(movieSitemap).map((id) => titleKey("movie", id)),
	...sitemapSelection(showSitemap).map((id) => titleKey("show", id)),
])

interface Pool {
	preferred: GenreRowCandidate[]
	fallback: GenreRowCandidate[]
}

let pools: { version: string; byGenre: Map<string, Pool> } | null = null

/** The genre's titles of the media type with a poster, from one pass over the snapshot; kept until the next version. */
function poolOf(
	snapshot: TitleSnapshot,
	mediaType: "movie" | "show",
	genre: string,
): Pool {
	if (pools?.version !== snapshot.version)
		pools = { version: snapshot.version, byGenre: new Map() }
	const name = `${mediaType}:${genre}`
	const known = pools.byGenre.get(name)
	if (known) return known
	const { pointIds, genres, genreNames, votes, flags } = snapshot.columns
	const bit = genreNames.indexOf(genre)
	const pool: Pool = { preferred: [], fallback: [] }
	if (bit >= 0) {
		const low = titleKey(mediaType, 0)
		const high =
			mediaType === "movie" ? titleKey("show", 0) : Number.POSITIVE_INFINITY
		const others: GenreRowCandidate[] = []
		for (let row = 0; row < pointIds.length; row++) {
			const key = pointIds[row]
			if (key < low || key >= high) continue
			if (!(genres[row] & (1 << bit))) continue
			if (!(flags[row] & FLAG_POSTER) || flags[row] & FLAG_ADULT) continue
			const title = { key, votes: votes[row] }
			;(cohort.has(key) ? pool.preferred : others).push(title)
		}
		pool.fallback = others
			.sort((a, b) => b.votes - a.votes || a.key - b.key)
			.slice(0, FALLBACK_POOL)
	}
	pools.byGenre.set(name, pool)
	return pool
}

// ---------------------------------------------------------------- the cards' store

const store = new Map<TitleKey, { display: TitleDisplay; until: number }>()
// The pools being filled, or filled until a time. A pool of an older snapshot version goes with it.
const filled = new WeakMap<Pool, number | Promise<void>>()

function stored(key: TitleKey): TitleDisplay | undefined {
	const entry = store.get(key)
	return entry && entry.until > Date.now() ? entry.display : undefined
}

function keep(displays: Map<TitleKey, TitleDisplay>) {
	const until = Date.now() + STORE_TTL_MS
	for (const [key, display] of displays) store.set(key, { display, until })
}

/**
 * Starts filling the store with the cards of a pool that it doesn't hold, once per six hours; one read of up to
 * MAX_KEYS cards at a time.
 */
function fill(pool: Pool) {
	const state = filled.get(pool)
	if (state instanceof Promise || (state && state > Date.now())) return
	const keys = [...pool.preferred, ...pool.fallback]
		.map((title) => title.key)
		.filter((key) => !stored(key))
	const work = (async () => {
		for (let at = 0; at < keys.length; at += MAX_KEYS)
			keep(await getDisplayFields(keys.slice(at, at + MAX_KEYS)))
	})()
	filled.set(pool, work)
	work.then(
		() => filled.set(pool, Date.now() + STORE_TTL_MS),
		(error: unknown) => {
			// The next page of the genre tries again.
			filled.delete(pool)
			console.error("Genre row: store not filled", error)
		},
	)
}

/** The cards of titles the store doesn't hold yet, from the title cards' cache. They go into the store too. */
async function readMissing(keys: TitleKey[]) {
	const missing = keys.filter((key) => !stored(key))
	if (missing.length) keep(await getDisplayFields(missing))
}

/** The canonical cards of the keys, in the viewer's language when there is one. */
async function present(keys: TitleKey[], language?: string) {
	const originals = keys.flatMap((key) => stored(key) ?? [])
	if (!language) return originals
	return (await overlayTitles(originals, language)).map((row, at) =>
		copyPresentationFields(originals[at], row),
	)
}

// ---------------------------------------------------------------- the row

/**
 * The row for a title page. Waits at most `budgetMs` for cards the store doesn't hold yet after the related map is in;
 * later, the page is incomplete.
 */
export async function genreRow(params: {
	mediaType: "movie" | "show"
	tmdbId: number
	genres: readonly string[] | null | undefined
	/** Titles the page shows elsewhere, known now: the movie's collection. */
	exclude: Iterable<TitleKey>
	/** Titles the page shows elsewhere, known later: the related map. Never rejects. */
	later: Promise<Iterable<TitleKey>>
	budgetMs: number
	language?: string
}): Promise<GenreRowResult> {
	const page = titleGenrePage(params.mediaType, params.genres)
	if (!page) return null
	const snapshot = getTitleSnapshot()
	if (!snapshot) return "late"
	const pool = poolOf(snapshot, params.mediaType, page.genre)
	fill(pool)
	const candidates = {
		page: titleKey(params.mediaType, params.tmdbId),
		preferred: pool.preferred,
		fallback: pool.fallback,
	}
	const known = new Set(params.exclude)
	const early = rankGenreRow({
		...candidates,
		exclude: known,
		size: GENRE_ROW_SIZE + SPARE,
	}).map((title) => title.key)
	if (!early.length) return null
	const earlyRead = readMissing(early)
	earlyRead.catch(() => {})

	const picks = pickGenreRow({
		...candidates,
		exclude: new Set([...known, ...(await params.later)]),
	}).map((title) => title.key)
	if (!picks.length) return null
	let timer: ReturnType<typeof setTimeout> | undefined
	const late = new Promise<"late">((resolve) => {
		timer = setTimeout(() => resolve("late"), params.budgetMs)
	})
	try {
		// A pick outside the early read, because the related map took more than the spares, is read now.
		const read = earlyRead.then(() => readMissing(picks))
		if ((await Promise.race([read, late])) === "late") return "late"
		const titles = (await present(picks, params.language)).map(
			(display): GenreRowTitle => ({
				tmdb_id: display.tmdb_id,
				title: display.title,
				release_year: display.release_year,
				poster_path: display.poster_path,
				goodwatch_overall_score_normalized_percent:
					display.goodwatch_overall_score_normalized_percent,
				...(display.canonical_title !== undefined && {
					canonical_title: display.canonical_title,
				}),
				...(display.presentation && { presentation: display.presentation }),
			}),
		)
		return titles.length
			? {
					heading: genreRowHeading(page.label, params.mediaType),
					path: page.path,
					titles,
				}
			: null
	} catch (error) {
		console.error("Genre row: cards not read", error)
		return "late"
	} finally {
		clearTimeout(timer)
	}
}

/** The titles of a related map lookup: the map shows them, and its hidden links name them. */
export function relatedMapKeys(lookup: RelatedMapLookup): TitleKey[] {
	if (lookup === "none" || lookup === "late") return []
	return lookup.n.map(([id]) =>
		titleKey(id[0] === "m" ? "movie" : "show", Number(id.slice(1))),
	)
}
