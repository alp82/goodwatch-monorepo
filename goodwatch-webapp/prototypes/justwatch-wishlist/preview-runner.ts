// Runs the real wishlist parser and preview against an in-memory import journal.
// Only catalog reads can leave the process, and only when a read-only catalog is passed.
import "../../app/server/tracking-loader.test-support.ts"
import { FakeTrackingCrate } from "../../app/server/tracking-fake-crate.ts"
import { ImportDb } from "../../app/server/imports/import-db.test-support.ts"
import type { Param } from "../../app/server/imports/store.server.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../app/utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../../app/server/taste/member.server.ts")
holdTasteRebuildsForTest()
const { previewImport, getImportItems } = await import("../../app/server/imports/service.server.ts")
const { setImportDbForTest } = await import("../../app/server/imports/store.server.ts")
const { setImportEffectsForTest } = await import("../../app/server/imports/apply.server.ts")
const { parseWishlistFile } = await import("../../app/server/imports/wishlist.server.ts")

export type CatalogRow = { tmdb_id: number; imdb_id: string | null; title: string; release_year: number | null }
/** Answers the three catalog statements the preview makes, per typed table. */
export type Catalog = (table: "movie" | "show", sql: string, params: Param[]) => Promise<CatalogRow[]>

export function memoryCatalog(rows: { movie: [number, string, string, number][]; show: [number, string, string, number][] }): Catalog {
	const typed = {
		movie: rows.movie.map(([tmdb_id, imdb_id, title, release_year]) => ({ tmdb_id, imdb_id, title, release_year })),
		show: rows.show.map(([tmdb_id, imdb_id, title, release_year]) => ({ tmdb_id, imdb_id, title, release_year })),
	}
	return async (table, sql, params) =>
		typed[table].filter((row) =>
			sql.includes("tmdb_id IN")
				? params.includes(row.tmdb_id)
				: sql.includes("imdb_id IN")
					? params.includes(row.imdb_id)
					: row.title.toLowerCase() === String(params[0]).toLowerCase() && row.release_year === params[1],
		)
}

class TypedCatalogDb extends ImportDb {
	catalogLookup: Catalog
	constructor(catalogLookup: Catalog) {
		super()
		this.catalogLookup = catalogLookup
	}
	catalogReads = 0
	override async select<T extends {}>(sql: string, params: Param[]): Promise<T[]> {
		const s = sql.replace(/\s+/g, " ").trim()
		// Matching reads plus the #714 popularity read for ID-disagreement suggestions.
		const table = s.match(/^SELECT tmdb_id, (?:imdb_id, title, release_year|popularity) FROM (movie|show) WHERE /)?.[1]
		if (table === "movie" || table === "show") {
			this.catalogReads++
			return (await this.catalogLookup(table, s, params)) as unknown as T[]
		}
		return super.select<T>(sql, params)
	}
}

export type Library = { seenMovies: number[]; watchingShows: number[]; wishes: { mediaType: "movie" | "show"; tmdbId: number }[] }

export async function runPreview(bytes: Uint8Array, catalog: Catalog, library: Library) {
	const db = new TypedCatalogDb(catalog)
	for (const tmdb_id of library.seenMovies)
		db.watches.push({ user_id: "member", tmdb_id, media_type: "movie", watch_id: `w${tmdb_id}` })
	for (const wish of library.wishes)
		db.wishlist.push({ user_id: "member", tmdb_id: wish.tmdbId, media_type: wish.mediaType, created_at: new Date(0), updated_at: new Date(0), _seq_no: 1, _primary_term: 1 })
	const tracking = new FakeTrackingCrate()
	tracking.seed(
		"user_watch_state",
		library.watchingShows.map((tmdb_id) => ({
			user_id: "member",
			tmdb_id,
			media_type: "show",
			state: "watching",
			pass: 1,
			state_changed_at: 1000,
			updated_at: 1000,
			created_at: 1000,
			seen_press_group: null,
			seen_press_from: null,
			seen_question: null,
		})),
	)
	tracking.seed(
		"user_watch_log",
		library.watchingShows.map((tmdb_id) => ({ user_id: "member", tmdb_id, media_type: "show", watch_id: `s${tmdb_id}`, season_number: 1, episode_number: 1, watched_at: 1000 })),
	)
	setImportDbForTest(db)
	setCrateClientForTest(tracking as never)
	setImportEffectsForTest(async () => {}, async () => {})
	const started = performance.now()
	try {
		const parsed = parseWishlistFile(bytes, (message) => {
			throw new Error(message)
		})
		const preview = await previewImport("member", "wishlist", "justwatch.json", bytes)
		const items = []
		for (let offset = 0; ; offset += 50) {
			const page = await getImportItems("member", preview.id, undefined, offset, 50)
			items.push(...page.items)
			if (page.items.length < 50) break
		}
		return {
			parsed,
			preview,
			items,
			catalogReads: db.catalogReads,
			wishlistWrites: db.wishlist.length - library.wishes.length,
			durationMs: Math.round(performance.now() - started),
		}
	} finally {
		setImportDbForTest()
		setCrateClientForTest(null)
		setImportEffectsForTest()
	}
}
