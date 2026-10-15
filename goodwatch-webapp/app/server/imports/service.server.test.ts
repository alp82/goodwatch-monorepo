import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import type { ImportOptions } from "../../domain/imports.ts"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import type { Param } from "./store.server.ts"

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")

const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { getMovieTracking, getShowTracking } = await import(
	"../tracking.server.ts"
)
const {
	previewImport,
	previewParsedImport,
	getImportItems,
	confirmImport,
	getImport,
	undoImport,
} = await import("./service.server.ts")
const { setImportDbForTest, itemRows } = await import("./store.server.ts")
const { setImportEffectsForTest } = await import("./apply.server.ts")

type Row = Record<string, unknown>
function requiredRow(row: Row | undefined): Row {
	if (!row) throw new Error("Expected the fake import row to exist.")
	return row
}
const options: ImportOptions = {
	kinds: ["favorite"],
	conflictChoice: "source",
	watchDates: "preserve",
}

// The fake implements only these statement shapes. Reject changed predicates or columns
// instead of silently returning empty rows/success. Placeholder lists may vary in length.
const supportedImportSql = new Set([
	"SELECT payload, refreshed_at FROM anime_mapping_snapshot WHERE id = ?",
	"UPDATE doc.user_import SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
	"DELETE FROM user_favorite WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
	"DELETE FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
	"DELETE FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
	"INSERT INTO doc.user_import (id,user_id,source,status,file_name,counts,processed,total,added,updated,kept,failed,error,created_at,updated_at,warnings,kinds,file_hash) VALUES (?,'preview',?,0,?,0,0,0,0,NULL,?)",
	"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,source_key,payload,imdb_id,title,year,outcome,reason,tmdb_id,media_type,current_score,season_number,episode_number,episode_tmdb_id,watched_at,watched_at_precision,pass) VALUES (?)",
	"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,source_key,payload,outcome,reason,tmdb_id,media_type) VALUES (?, ?, ?, 'state', ?, ?, 'new', NULL, ?, ?) ON CONFLICT (import_id,row_index) DO NOTHING",
	"INSERT INTO user_favorite (user_id,tmdb_id,media_type,created_at,updated_at) VALUES (?) ON CONFLICT (user_id,tmdb_id,media_type) DO NOTHING",
	"INSERT INTO user_score (user_id,tmdb_id,media_type,score,review,created_at,updated_at) VALUES (?) ON CONFLICT (user_id,tmdb_id,media_type) DO NOTHING",
	"INSERT INTO user_wishlist (user_id,tmdb_id,media_type,created_at,updated_at) VALUES (?) ON CONFLICT (user_id,tmdb_id,media_type) DO NOTHING",
	"REFRESH TABLE doc.user_import",
	"REFRESH TABLE doc.user_import_item",
	"REFRESH TABLE user_favorite",
	"REFRESH TABLE user_not_interested",
	"REFRESH TABLE user_score",
	"REFRESH TABLE user_score, user_wishlist, user_favorite, user_watch_log, user_watch_state",
	"REFRESH TABLE user_wishlist",
	"REFRESH TABLE user_wishlist, user_watch_log",
	"SELECT DISTINCT tmdb_id, media_type FROM user_watch_log WHERE user_id = ? LIMIT 100000",
	"SELECT _seq_no, _primary_term FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT apply_state, count(*) AS n FROM doc.user_import_item WHERE import_id = ? AND kind <> 'state' GROUP BY apply_state",
	"SELECT created_at, updated_at FROM user_favorite WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT created_at, updated_at, _seq_no, _primary_term FROM user_favorite WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT created_at, updated_at, _seq_no, _primary_term FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT id, user_id, source, status, file_name, counts, processed, total, added, updated, kept, failed, error, created_at, updated_at, confirmed_at, finished_at, options, warnings, kinds, CURRENT_TIMESTAMP AS read_at, _seq_no, _primary_term FROM doc.user_import WHERE id = ?",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' AND (apply_state IS NULL OR apply_state = 'failed') ORDER BY row_index LIMIT 100001",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' ORDER BY row_index LIMIT 100001",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' ORDER BY row_index LIMIT ? OFFSET ?",
	"SELECT row_index, source_key, payload, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind = 'state' LIMIT 100001",
	"SELECT score, review, created_at, updated_at, _seq_no, _primary_term FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE imdb_id IN (?)",
	"SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
	"SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE tmdb_id IN (?)",
	"SELECT tmdb_id, imdb_id, title, release_year FROM show WHERE tmdb_id IN (?)",
	"SELECT tmdb_id, media_type FROM user_favorite WHERE user_id = ? LIMIT 100000",
	"SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ? LIMIT 100000",
	"SELECT tmdb_id, media_type, score, review, updated_at, _seq_no, _primary_term FROM user_score WHERE user_id = ? LIMIT 100000",
	"SELECT tmdb_id, show_id, season_number, episode_number, name, tvdb_id FROM episode WHERE show_id = ? AND removed_at IS NULL LIMIT 50001",
	"SELECT watch_id FROM user_watch_log WHERE user_id = ? AND tmdb_id = ? AND media_type = ? LIMIT 1",
	"UPDATE doc.user_import SET processed = ?, added = ?, updated = ?, kept = ?, failed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
	"UPDATE doc.user_import SET status = 'running', options = ?, conflict_choice = ?, confirmed_at = COALESCE(confirmed_at,CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ? AND _seq_no = ? AND _primary_term = ?",
	"UPDATE doc.user_import SET status = 'running', options = ?, updated_at = CURRENT_TIMESTAMP, error = NULL WHERE id = ? AND _seq_no = ? AND _primary_term = ?",
	"UPDATE doc.user_import SET status = 'undone', updated_at = CURRENT_TIMESTAMP, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
	"UPDATE doc.user_import SET status = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, error = ? WHERE id = ?",
	"UPDATE doc.user_import_item SET apply_state = 'added', applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND apply_state IS NULL",
	"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added','updated')",
	"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND user_id = ? AND kind IN ('watch','show_status','state') AND apply_state IN ('added','kept')",
	"UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed')",
	"UPDATE doc.user_import_item SET apply_state = ?, watch_id = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed')",
	"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
	"UPDATE episode SET tvdb_id = ? WHERE show_id = ? AND tmdb_id = ? AND removed_at IS NULL AND tvdb_id = ?",
	"UPDATE user_score SET score = ?, review = ?, created_at = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
	"UPDATE user_score SET score = ?, review = ?, updated_at = ? WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
])
function assertSupportedImportSql(sql: string) {
	const shape = sql
		.replace(/\?(?:,\?)+/g, "?")
		.replace(/\(\?\)(?:,\(\?\))+/g, "(?)")
	if (!supportedImportSql.has(shape))
		throw new Error(`Unexpected import SQL: ${sql}`)
}

class ImportDb {
	animeSnapshot: unknown = null
	imports: Row[] = []
	items: Row[] = []
	favorites: Row[] = []
	wishlist: Row[] = []
	catalog: Row[] = []
	episodes: Row[] = []
	catalogQueries: { sql: string; params: Param[] }[] = []
	scores: Row[] = []
	failFavoriteOnce = false
	failScoreOnce = false
	private version = 10

	seed(userId = "member") {
		const now = new Date("2026-10-09T12:00:00Z")
		this.imports.push({
			id: "11111111-1111-4111-8111-111111111111",
			user_id: userId,
			source: "letterboxd",
			status: "preview",
			file_name: "export.zip",
			counts: JSON.stringify({
				rows: 1,
				new: 1,
				unchanged: 0,
				conflict: 0,
				unmatched: 0,
				unsupported: 0,
				invalid: 0,
			}),
			processed: 0,
			total: 1,
			added: 0,
			updated: 0,
			kept: 0,
			failed: 0,
			error: null,
			created_at: now,
			updated_at: now,
			confirmed_at: null,
			finished_at: null,
			options: null,
			warnings: "[]",
			kinds: JSON.stringify({
				rating: 0,
				watch: 0,
				want: 0,
				favorite: 1,
				review: 0,
			}),
			_seq_no: 1,
			_primary_term: 1,
		})
		this.items.push({
			import_id: this.imports[0].id,
			row_index: 0,
			user_id: userId,
			kind: "favorite",
			source_key: "letterboxd:favorite:one",
			payload: JSON.stringify({
				key: "letterboxd:favorite:one",
				kind: "favorite",
				mediaType: "movie",
				title: "One",
				year: 2024,
				tmdbId: 42,
				imdbId: null,
				index: 0,
				outcome: "new",
				reason: null,
			}),
			outcome: "new",
			reason: null,
			tmdb_id: 42,
			media_type: "movie",
			current_score: null,
			apply_state: null,
		})
	}

	async select<T extends {}>(sql: string, params: Param[]): Promise<T[]> {
		const s = sql.replace(/\s+/g, " ").trim()
		assertSupportedImportSql(s)
		if (s.includes("FROM anime_mapping_snapshot"))
			return [
				{
					payload: JSON.stringify(this.animeSnapshot),
					refreshed_at: Date.now(),
				},
			] as unknown as T[]
		if (s.includes("FROM episode WHERE"))
			return this.episodes.filter((row) => row.show_id === params[0]) as T[]
		if (s.includes("FROM movie WHERE") || s.includes("FROM show WHERE")) {
			this.catalogQueries.push({ sql: s, params: [...params] })
			const rows = this.catalog.filter((row) =>
				s.includes("tmdb_id IN")
					? params.includes(Number(row.tmdb_id))
					: s.includes("imdb_id IN")
						? params.includes(String(row.imdb_id))
						: String(row.title).toLowerCase() ===
								String(params[0]).toLowerCase() &&
							row.release_year === params[1],
			)
			return rows as T[]
		}
		if (s.includes("FROM user_watch_log")) return []
		if (s.includes("FROM doc.user_import WHERE id = ?")) {
			const row = this.imports.find((x) => x.id === params[0])
			return (row ? [{ ...row, read_at: new Date() }] : []) as unknown as T[]
		}
		if (s.includes("FROM doc.user_import_item")) {
			let rows = this.items.filter(
				(x) =>
					x.import_id === params[0] && (!params[1] || x.user_id === params[1]),
			)
			if (s.includes("kind = 'state'"))
				rows = rows.filter((x) => x.kind === "state")
			if (s.includes("kind <> 'state'"))
				rows = rows.filter((x) => x.kind !== "state")
			if (s.includes("apply_state IS NULL OR apply_state = 'failed'"))
				rows = rows.filter(
					(x) => x.apply_state == null || x.apply_state === "failed",
				)
			if (s.includes("GROUP BY apply_state")) {
				const counts = new Map<unknown, number>()
				for (const row of rows)
					counts.set(row.apply_state, (counts.get(row.apply_state) ?? 0) + 1)
				return [...counts].map(([apply_state, n]) => ({
					apply_state,
					n,
				})) as unknown as T[]
			}
			return rows.map((x) => ({ ...x })) as T[]
		}
		if (s.includes("FROM user_favorite") || s.includes("FROM user_wishlist")) {
			const list = s.includes("FROM user_wishlist")
				? this.wishlist
				: this.favorites
			if (params.length === 1)
				return list
					.filter((x) => x.user_id === params[0])
					.map((x) => ({ ...x })) as T[]
			const row = list.find(
				(x) =>
					x.user_id === params[0] &&
					x.tmdb_id === params[1] &&
					x.media_type === params[2],
			)
			return (row ? [{ ...row }] : []) as T[]
		}
		if (s.includes("FROM user_score")) {
			const row = this.scores.find(
				(x) =>
					x.user_id === params[0] &&
					x.tmdb_id === params[1] &&
					x.media_type === params[2],
			)
			return (row ? [{ ...row }] : []) as T[]
		}
		if (
			s.includes("FROM user_wishlist") ||
			s.includes("FROM user_not_interested")
		)
			return []
		throw new Error(`Unexpected select: ${s}`)
	}

	async run(sql: string, params: Param[]) {
		const s = sql.replace(/\s+/g, " ").trim()
		assertSupportedImportSql(s)
		if (s.startsWith("INSERT INTO doc.user_import (")) {
			this.imports.push({
				id: params[0],
				user_id: params[1],
				source: params[2],
				status: "preview",
				file_name: params[3],
				counts: params[4],
				total: params[5],
				created_at: params[6],
				updated_at: params[7],
				warnings: params[8],
				kinds: params[9],
				processed: 0,
				added: 0,
				updated: 0,
				kept: 0,
				failed: 0,
				finished_at: null,
				options: null,
				_seq_no: 1,
				_primary_term: 1,
			})
			return { rowcount: 1 }
		}
		if (
			s.startsWith("INSERT INTO doc.user_import_item (") &&
			s.includes("'state'")
		) {
			this.items.push({
				import_id: params[0],
				row_index: params[1],
				user_id: params[2],
				kind: "state",
				source_key: params[3],
				payload: params[4],
				outcome: "new",
				tmdb_id: params[5],
				media_type: params[6],
				apply_state: null,
			})
			return { rowcount: 1 }
		}
		if (s.startsWith("INSERT INTO doc.user_import_item (")) {
			const columns = s.slice(s.indexOf("(") + 1, s.indexOf(")")).split(",")
			for (let i = 0; i < params.length; i += columns.length)
				this.items.push(
					Object.fromEntries(
						columns.map((column, j) => [column, params[i + j]]),
					),
				)
			return { rowcount: params.length / columns.length }
		}
		if (s.startsWith("UPDATE episode SET")) return { rowcount: 0 }
		if (s.startsWith("REFRESH TABLE")) return { rowcount: 1 }
		if (s.startsWith("UPDATE doc.user_import SET")) {
			if (s.includes("_seq_no = ?")) {
				const seq = Number(params.at(-2))
				const term = Number(params.at(-1))
				const claimId = String(params.at(-3))
				const claim = this.imports.find((x) => x.id === claimId)
				if (!claim || claim._seq_no !== seq || claim._primary_term !== term)
					return { rowcount: 0 }
				if (s.includes("options = ?")) claim.options = params[0]
				claim.status = "running"
				claim.error = null
				claim.updated_at = new Date()
				claim._seq_no = ++this.version
				return { rowcount: 1 }
			}
			const id = String(params.at(-1))
			const row = this.imports.find((x) => x.id === id)
			if (!row) return { rowcount: 0 }
			if (s.includes("processed = ?"))
				Object.assign(row, {
					processed: params[0],
					added: params[1],
					updated: params[2],
					kept: params[3],
					failed: params[4],
				})
			else if (s.includes("status = ?"))
				Object.assign(row, {
					status: params[0],
					error: params[1],
					finished_at: new Date(),
				})
			else if (s.includes("status = 'undone'"))
				Object.assign(row, { status: "undone", finished_at: new Date() })
			else if (s.includes("status = 'failed'"))
				Object.assign(row, { status: "failed", error: params[0] })
			else if (
				s !==
				"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
			)
				throw new Error(`Unexpected import update: ${s}`)
			row.updated_at = new Date()
			row._seq_no = ++this.version
			return { rowcount: 1 }
		}
		if (s.startsWith("UPDATE doc.user_import_item SET payload")) {
			const row = requiredRow(
				this.items.find(
					(x) => x.import_id === params[1] && x.row_index === params[2],
				),
			)
			row.payload = params[0]
			return { rowcount: 1 }
		}
		if (s.startsWith("UPDATE doc.user_import_item SET apply_state = 'added'")) {
			const row = requiredRow(
				this.items.find(
					(x) => x.import_id === params[0] && x.row_index === params[1],
				),
			)
			row.apply_state = "added"
			return { rowcount: 1 }
		}
		if (
			s.startsWith("UPDATE doc.user_import_item SET apply_state = ?") &&
			s.includes("watch_id = ?")
		) {
			const row = requiredRow(
				this.items.find(
					(x) => x.import_id === params[2] && x.row_index === params[3],
				),
			)
			row.apply_state = params[0]
			row.watch_id = params[1]
			return { rowcount: 1 }
		}
		if (s.startsWith("UPDATE doc.user_import_item SET apply_state = ?")) {
			const row = requiredRow(
				this.items.find(
					(x) => x.import_id === params[1] && x.row_index === params[2],
				),
			)
			row.apply_state = params[0]
			return { rowcount: 1 }
		}
		if (s.includes("UPDATE doc.user_import_item SET apply_state = 'undone'")) {
			for (const row of this.items)
				if (
					row.import_id === params[0] &&
					["added", "updated"].includes(String(row.apply_state))
				)
					row.apply_state = "undone"
			return { rowcount: 1 }
		}
		if (
			s.startsWith("INSERT INTO user_favorite") ||
			s.startsWith("INSERT INTO user_wishlist")
		) {
			const list = s.startsWith("INSERT INTO user_wishlist")
				? this.wishlist
				: this.favorites
			if (this.failFavoriteOnce) {
				this.failFavoriteOnce = false
				throw new Error("injected interruption")
			}
			if (
				!list.some(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2],
				)
			)
				list.push({
					user_id: params[0],
					tmdb_id: params[1],
					media_type: params[2],
					created_at: params[3],
					updated_at: params[4],
					_seq_no: ++this.version,
					_primary_term: 1,
				})
			return { rowcount: 1 }
		}
		if (
			s.startsWith("DELETE FROM user_favorite") ||
			s.startsWith("DELETE FROM user_wishlist")
		) {
			const name = s.startsWith("DELETE FROM user_wishlist")
				? "wishlist"
				: "favorites"
			const before = this[name].length
			this[name] = this[name].filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2] &&
						x._seq_no === params[3] &&
						x._primary_term === params[4]
					),
			)
			return { rowcount: before - this[name].length }
		}
		if (s.startsWith("INSERT INTO user_score")) {
			if (this.failScoreOnce) {
				this.failScoreOnce = false
				throw new Error("injected score interruption")
			}
			if (
				!this.scores.some(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2],
				)
			)
				this.scores.push({
					user_id: params[0],
					tmdb_id: params[1],
					media_type: params[2],
					score: params[3],
					review: params[4],
					created_at: params[5],
					updated_at: params[6],
					_seq_no: ++this.version,
					_primary_term: 1,
				})
			return { rowcount: 1 }
		}
		if (s.startsWith("UPDATE user_score SET score")) {
			const restore = s.includes("created_at = ?")
			const at = restore ? 4 : 3
			const row = this.scores.find(
				(x) =>
					x.user_id === params[at] &&
					x.tmdb_id === params[at + 1] &&
					x.media_type === params[at + 2] &&
					x._seq_no === params[at + 3] &&
					x._primary_term === params[at + 4],
			)
			if (!row) return { rowcount: 0 }
			Object.assign(row, {
				score: params[0],
				review: params[1],
				...(restore
					? { created_at: params[2], updated_at: params[3] }
					: { updated_at: params[2] }),
				_seq_no: ++this.version,
			})
			return { rowcount: 1 }
		}
		if (s.startsWith("DELETE FROM user_score")) {
			const before = this.scores.length
			this.scores = this.scores.filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2] &&
						x._seq_no === params[3] &&
						x._primary_term === params[4]
					),
			)
			return { rowcount: before - this.scores.length }
		}

		throw new Error(`Unexpected run: ${s}`)
	}
}

async function waitFor(db: ImportDb, status: string) {
	for (let i = 0; i < 100; i++) {
		if (db.imports[0].status === status) return
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail(`import stayed ${db.imports[0].status}: ${db.imports[0].error}`)
}

afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})

describe("native import service", () => {
	it("enforces ownership and applies then safely undoes a durable receipt", async () => {
		const db = new ImportDb()
		db.seed()
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await assert.rejects(
			() => getImport("someone-else", String(db.imports[0].id)),
			/couldn't find/,
		)
		await confirmImport("member", String(db.imports[0].id), options)
		await waitFor(db, "done")
		assert.equal(db.favorites.length, 1)
		assert.ok(
			JSON.parse(String(db.items[0].payload)).journal,
			"before/after receipt is stored before completion",
		)
		await undoImport("member", String(db.imports[0].id))
		assert.equal(db.favorites.length, 0)
		assert.equal(db.imports[0].status, "undone")
	})

	it("resumes an interrupted row and undo preserves a later edit", async () => {
		const db = new ImportDb()
		db.seed()
		db.failFavoriteOnce = true
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await confirmImport("member", String(db.imports[0].id), options)
		await waitFor(db, "failed")
		assert.ok(
			JSON.parse(String(db.items[0].payload)).journal,
			"the receipt survives the failed write",
		)
		await confirmImport("member", String(db.imports[0].id), options)
		await waitFor(db, "done")
		assert.equal(db.favorites.length, 1)
		db.favorites[0].updated_at = new Date("2026-10-10T00:00:00Z")
		await undoImport("member", String(db.imports[0].id))
		assert.equal(
			db.favorites.length,
			1,
			"a row edited after the import is not removed",
		)
	})

	it("resumes dependent rating and review writes on one title, then undoes both", async () => {
		const db = new ImportDb()
		db.seed()
		db.failScoreOnce = true
		db.imports[0].total = 2
		db.imports[0].counts = JSON.stringify({
			rows: 2,
			new: 2,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		})
		db.items = [
			{
				...db.items[0],
				kind: "rating",
				source_key: "rating:one",
				payload: JSON.stringify({
					key: "rating:one",
					kind: "rating",
					mediaType: "movie",
					title: "One",
					year: 2024,
					tmdbId: 42,
					imdbId: null,
					score: 8,
					index: 0,
					outcome: "new",
					reason: null,
					_preview: null,
				}),
			},
			{
				...db.items[0],
				row_index: 1,
				kind: "review",
				source_key: "review:one",
				payload: JSON.stringify({
					key: "review:one",
					kind: "review",
					mediaType: "movie",
					title: "One",
					year: 2024,
					tmdbId: 42,
					imdbId: null,
					review: "Source review",
					index: 1,
					outcome: "new",
					reason: null,
					_preview: null,
				}),
			},
		]
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const ratingOptions: ImportOptions = {
			...options,
			kinds: ["rating", "review"],
		}
		await confirmImport("member", String(db.imports[0].id), ratingOptions)
		await waitFor(db, "failed")
		await confirmImport("member", String(db.imports[0].id), ratingOptions)
		await waitFor(db, "done")
		assert.deepEqual(
			db.scores.map(({ score, review }) => ({ score, review })),
			[{ score: 8, review: "Source review" }],
		)
		await undoImport("member", String(db.imports[0].id))
		assert.equal(db.scores.length, 0)
	})

	it("journals rejected watch rows as kept without invoking tracking", async () => {
		const db = new ImportDb()
		db.seed()
		Object.assign(db.items[0], {
			kind: "watch",
			outcome: "invalid",
			source_key: "watch:bad",
			payload: JSON.stringify({
				key: "watch:bad",
				kind: "watch",
				mediaType: "movie",
				title: "Bad",
				year: 2024,
				tmdbId: 42,
				imdbId: null,
				index: 0,
				outcome: "invalid",
				reason: "Bad date",
			}),
		})
		setImportDbForTest(db)
		setImportEffectsForTest(async () => {})
		await confirmImport("member", String(db.imports[0].id), {
			...options,
			kinds: ["watch"],
		})
		await waitFor(db, "done")
		assert.equal(db.items[0].apply_state, "kept")
		assert.equal(
			db.items.some((item) => item.kind === "state"),
			false,
		)
	})

	it("keeps a pending synthetic watch plan out of generic resume processing", async () => {
		const db = new ImportDb()
		db.seed()
		db.items.push({
			...db.items[0],
			row_index: 1,
			kind: "state",
			source_key: "state:movie:42",
			apply_state: null,
			payload: JSON.stringify({
				title: { mediaType: "movie", tmdbId: 42 },
				watches: [],
			}),
		})
		setImportDbForTest(db)
		assert.deepEqual(
			(await itemRows("member", String(db.imports[0].id), true)).map(
				(item) => item.kind,
			),
			["favorite"],
		)
		assert.equal(db.items[1].apply_state, null)
	})
})

it("CSV preview matches IDs in priority order and only unique exact title/year, then applies and undoes its receipt", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
		{
			tmdb_id: 655,
			imdb_id: "tt0087884",
			title: "Paris, Texas",
			release_year: 1984,
		},
		{ tmdb_id: 10, imdb_id: "tt10", title: "Ambiguous", release_year: 2000 },
		{ tmdb_id: 11, imdb_id: "tt11", title: "Ambiguous", release_year: 2000 },
	]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewImport(
		"member",
		"csv",
		"export.csv",
		Buffer.from(
			"tmdbID,imdbID,Title,Year,Rating10,Extra\n862,tt0087884,Wrong,1995,8,x\n999,tt0087884,Wrong,1984,5,x\n,,Toy Story,1995,8,x\n,,Ambiguous,2000,7,x\n,,Missing,2000,6,x\n",
		),
	)
	assert.deepEqual(db.catalogQueries, [
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE tmdb_id IN (?,?)",
			params: [862, 999],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE imdb_id IN (?)",
			params: ["tt0087884"],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
			params: ["Toy Story", 1995],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
			params: ["Ambiguous", 2000],
		},
		{
			sql: "SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2",
			params: ["Missing", 2000],
		},
	])
	assert.equal(preview.counts.new, 3)
	assert.equal(preview.counts.unmatched, 2)
	const items = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		items.items.map((x) => x.tmdbId),
		[862, 655, 862, null, null],
	)
	assert.ok(items.items.slice(3).every((x) => x.reason))
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.status, "done")
	assert.equal(receipt.applied.added, 2)
	assert.match(receipt.warnings.join(" "), /Extra/)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
})

it("MovieLens combined upload matches only IDs and applies and undoes ratings and Want to See with receipt notes", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
		{
			tmdb_id: 655,
			imdb_id: "tt0087884",
			title: "Paris, Texas",
			release_year: 1984,
		},
	]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewImport(
		"member",
		"movielens",
		"ratings.csv + wishlist.csv",
		Buffer.from(
			"movie_id,imdb_id,tmdb_id,rating,title\n1,0087884,862,4.5,Toy Story (1995)\n2,,,3,Toy Story (1995)\n",
		),
		Buffer.from(
			'movie_id,imdb_id,tmdb_id,title\n3,87884,999,"Paris, Texas (1984)"\n',
		),
	)
	assert.equal(preview.counts.new, 2)
	assert.equal(preview.counts.unmatched, 1)
	assert.equal(preview.kinds.watch, 0)
	assert.equal(preview.kinds.want, 1)
	const items = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		items.items.map((x) => x.tmdbId),
		[862, null, 655],
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["rating", "want"],
	})
	await waitFor(db, "done")
	const receipt = await getImport("member", preview.id)
	assert.equal(receipt.applied.added, 2)
	assert.match(
		receipt.warnings.join(" "),
		/tags and activity logs are not applied/,
	)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	const again = await previewImport(
		"member",
		"movielens",
		"ratings.csv",
		Buffer.from(
			"movie_id,imdb_id,tmdb_id,rating,title\n1,0114709,862,4.5,Toy Story (1995)\n",
		),
	)
	assert.equal(again.counts.new, 1)
})

it("Kodi preview, apply, repeat receipt and undo preserve one watch and respect the date choice", async () => {
	for (const watchDates of ["preserve", "unknown"] as const) {
		const db = new ImportDb()
		db.catalog = [
			{
				tmdb_id: 862,
				imdb_id: "tt0114709",
				title: "Toy Story",
				release_year: 1995,
			},
		]
		const trackingDb = new FakeTrackingCrate()
		setCrateClientForTest(trackingDb)
		setImportDbForTest(db)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const file = Buffer.from(
			`<videodb><movie><title>Toy Story</title><uniqueid type="tmdb">862</uniqueid><playcount>5</playcount><lastplayed>2026-10-12</lastplayed></movie></videodb>`,
		)
		const preview = await previewImport("member", "kodi", "videodb.xml", file)
		assert.equal(preview.kinds.watch, 1)
		assert.equal((await getMovieTracking("member", 862)).log.length, 0)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["watch"],
			watchDates,
		})
		await waitFor(db, "done")
		const receipt = await getImport("member", preview.id)
		assert.equal(receipt.applied.added, 1)
		const tracking = await getMovieTracking("member", 862)
		assert.equal(tracking.log.length, 1)
		assert.equal(
			tracking.log[0].watched_at,
			watchDates === "preserve" ? Date.parse("2026-10-12") : null,
		)
		const repeated = await previewImport("member", "kodi", "videodb.xml", file)
		assert.equal(repeated.counts.unchanged, 1)
		await undoImport("member", preview.id)
		assert.equal((await getImport("member", preview.id)).status, "undone")
		assert.equal((await getMovieTracking("member", 862)).log.length, 0)
	}
})

it("Kodi episodes resolve through TMDB and TVDB evidence, leave untrusted coordinates unmatched, and apply canonical watches", async (t) => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 1668,
			imdb_id: "tt0108778",
			title: "Friends",
			release_year: 1994,
		},
	]
	db.episodes = [
		{
			show_id: 1668,
			tmdb_id: 101,
			season_number: 4,
			episode_number: 23,
			name: "Finale",
			tvdb_id: null,
			removed_at: null,
			air_date: Date.UTC(1998, 4, 7),
		},
		{
			show_id: 1668,
			tmdb_id: 102,
			season_number: 4,
			episode_number: 22,
			name: "Before",
			tvdb_id: 9002,
			removed_at: null,
			air_date: Date.UTC(1998, 4, 1),
		},
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	setCrateClientForTest(trackingDb)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	t.mock.method(
		globalThis,
		"fetch",
		async () =>
			new Response(
				JSON.stringify({ tv_episode_results: [{ id: 102, show_id: 1668 }] }),
				{ status: 200 },
			),
	)
	const episode = (ids: string, number: number) =>
		`<episodedetails>${ids}<season>4</season><episode>${number}</episode><playcount>3</playcount><lastplayed>2026-10-12</lastplayed></episodedetails>`
	const file = Buffer.from(
		`<videodb><tvshow><title>Friends</title><uniqueid type="tmdb">1668</uniqueid><playcount>100</playcount>${episode('<uniqueid type="tmdb">101</uniqueid>', 24)}${episode('<uniqueid type="tmdb">999</uniqueid><uniqueid type="tvdb">9002</uniqueid>', 23)}${episode("", 22)}</tvshow></videodb>`,
	)
	const preview = await previewImport("member", "kodi", "videodb.xml", file)
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.deepEqual(
		receipt.items.map((x) => [x.outcome, x.episodeTmdbId, x.episode]),
		[
			["new", 101, 23],
			["new", 102, 22],
			["unmatched", null, 22],
		],
	)
	assert.ok(receipt.items[2].reason)
	await confirmImport("member", preview.id, { ...options, kinds: ["watch"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 2)
	assert.deepEqual(
		(await getShowTracking("member", 1668)).log
			.map((x) => x.episode_tmdb_id)
			.sort(),
		[101, 102],
	)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).log.length, 0)
})

it("Kodi ratings prefer TMDB then IMDb, keep missing IDs unmatched, and apply and undo their receipt", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
		{
			tmdb_id: 655,
			imdb_id: "tt0087884",
			title: "Paris, Texas",
			release_year: 1984,
		},
	]
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const file = Buffer.from(
		`<videodb><movie><uniqueid type="tmdb">862</uniqueid><uniqueid type="imdb">tt0087884</uniqueid><userrating>9</userrating></movie><movie><uniqueid type="tmdb">999</uniqueid><id>tt0087884</id><userrating>8</userrating></movie><movie><title>Toy Story</title><year>1995</year><userrating>7</userrating></movie></videodb>`,
	)
	const preview = await previewImport("member", "kodi", "videodb.xml", file)
	assert.deepEqual(
		(await getImportItems("member", preview.id, undefined, 0, 50)).items.map(
			(x) => [x.outcome, x.tmdbId],
		),
		[
			["new", 862],
			["new", 655],
			["unmatched", null],
		],
	)
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 2)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(
		(await previewImport("member", "kodi", "videodb.xml", file)).counts.new,
		2,
	)
})

it("anime cour progress previews canonical episodes, keeps failed mappings on the receipt, and applies and undoes only its cour", async () => {
	const db = new ImportDb()
	db.catalog = [
		{
			tmdb_id: 120089,
			title: "Spy x Family",
			imdb_id: null,
			release_year: 2022,
		},
		{
			tmdb_id: 1429,
			title: "Attack on Titan",
			imdb_id: null,
			release_year: 2013,
		},
	]
	db.episodes = Array.from({ length: 25 }, (_, i) => ({
		show_id: 120089,
		tmdb_id: 10001 + i,
		season_number: 1,
		episode_number: i + 1,
		name: null,
		tvdb_id: null,
		removed_at: null,
		air_date: Date.UTC(2022, 0, 1),
	}))
	db.animeSnapshot = {
		schemaVersion: 1,
		entries: [
			{
				anidbId: 17061,
				showId: 120089,
				season: 1,
				offset: 12,
				ranges: [],
				ids: { myanimelist: [50602], anilist: [142838], kitsu: [45619] },
			},
			{
				anidbId: 17303,
				showId: 1429,
				season: 4,
				offset: 28,
				ranges: [],
				ids: { myanimelist: [51535], anilist: [146984], kitsu: [46038] },
			},
		],
	}
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	setCrateClientForTest(trackingDb)
	setImportDbForTest(db)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const base = {
		kind: "watch" as const,
		mediaType: "show" as const,
		title: "Spy x Family Part 2",
		year: 2022,
		tmdbId: null,
		imdbId: null,
		animeEntry: {
			source: "myanimelist" as const,
			id: 50602,
			progress: 13,
			episodeCount: 13,
		},
	}
	const preview = await previewParsedImport("member", "normalized-anime", {
		source: "csv",
		warnings: [],
		observations: [
			...Array.from({ length: 13 }, (_, i) => ({
				...base,
				key: `anime:50602:${i + 1}`,
				episode: i + 1,
				watchedAt: "2022-12-24",
				precision: "day" as const,
			})),
			{ ...base, key: "anime:50602:completed" },
			{
				...base,
				key: "anime:51535:1",
				animeEntry: {
					source: "myanimelist",
					id: 51535,
					progress: 2,
					episodeCount: 2,
				},
				episode: 1,
			},
			{
				...base,
				key: "anime:51535:want",
				kind: "want",
				animeEntry: { source: "myanimelist", id: 51535 },
			},
			...(["rating", "review"] as const).flatMap((kind) =>
				[null, 120089].map((tmdbId) => ({
					...base,
					key: `anime:50602:${kind}:${tmdbId}`,
					kind,
					tmdbId,
					score: 8,
					review: "A cour review",
				})),
			),
		],
	})
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.equal(preview.counts.new, 14)
	assert.equal(preview.counts.unmatched, 2)
	assert.equal(preview.counts.unsupported, 4)
	assert.ok(
		receipt.items
			.slice(16)
			.every(
				(item) =>
					item.outcome === "unsupported" &&
					/cour.*rating|cour.*review/i.test(item.reason ?? ""),
			),
	)
	assert.deepEqual(
		receipt.items.slice(0, 13).map((x) => x.episode),
		[13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
	)
	assert.ok(
		receipt.items
			.slice(0, 13)
			.every((x) => x.watchedAt === null && x.precision === "unknown"),
	)
	assert.match(receipt.items[14].reason ?? "", /does not fit/)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["watch", "want", "rating", "review"],
	})
	await waitFor(db, "done")
	const tracked = await getShowTracking("member", 120089)
	assert.equal(tracked.log.length, 13)
	assert.equal(tracked.state?.state, "watching")
	assert.ok(tracked.log.every((x) => x.watched_at === null))
	assert.equal((await getShowTracking("member", 1429)).log.length, 0)
	assert.equal((await getImport("member", preview.id)).applied.added, 14)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 120089)).log.length, 0)
})

it("show status observations preview, apply without watches, appear in the receipt, and undo", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	for (const showStatus of ["watching", "on_hold", "dropped"] as const) {
		const db = new ImportDb()
		db.catalog = [
			{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
		]
		setImportDbForTest(db)
		setCrateClientForTest(new FakeTrackingCrate())
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const parsed = {
			source: "trakt" as const,
			warnings: [],
			observations: [
				{
					key: "status:1668",
					kind: "show_status" as const,
					mediaType: "show" as const,
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus,
				},
			],
		}
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			parsed,
			"synthetic",
		)
		assert.equal(preview.kinds.show_status, 1)
		assert.equal(preview.counts.new, 1)
		assert.equal((await getShowTracking("member", 1668)).state, null)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
		})
		await waitFor(db, "done")
		const show = await getShowTracking("member", 1668)
		assert.equal(show.state?.state, showStatus)
		assert.deepEqual(show.log, [])
		assert.equal((await getImport("member", preview.id)).applied.added, 1)
		const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
		assert.equal(receipt.items[0].showStatus, showStatus)
		assert.equal(receipt.items[0].applyState, "added")
		const repeated = await previewParsedImport(
			"member",
			"statuses.json",
			parsed,
			"synthetic",
		)
		assert.equal(repeated.counts.unchanged, 1)
		await undoImport("member", preview.id)
		assert.equal((await getShowTracking("member", 1668)).state, null)
	}
})

it("Completed without whole-show scope stays unapplied; whole-show completion marks aired regular episodes and undo removes them", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	for (const completionScope of [undefined, "part", "show"] as const) {
		const db = new ImportDb()
		db.catalog = [
			{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
		]
		const trackingDb = new FakeTrackingCrate()
		trackingDb.seed("episode", [
			{
				show_id: 1668,
				tmdb_id: 101,
				season_number: 1,
				episode_number: 1,
				air_date: Date.UTC(1994, 0, 1),
				removed_at: null,
			},
		])
		setImportDbForTest(db)
		setCrateClientForTest(trackingDb)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			{
				source: "trakt",
				warnings: [],
				observations: [
					{
						key: "status:1668",
						kind: "show_status",
						mediaType: "show",
						title: "Friends",
						year: 1994,
						tmdbId: 1668,
						imdbId: null,
						showStatus: "completed",
						completionScope,
					},
				],
			},
			"synthetic",
		)
		assert.equal(preview.counts.unsupported, completionScope === "show" ? 0 : 1)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
		})
		await waitFor(db, "done")
		const show = await getShowTracking("member", 1668)
		if (completionScope === "show") {
			assert.equal(show.state?.state, "seen")
			assert.equal(show.state?.seen_press_group, null)
			assert.deepEqual(
				show.log.map((w) => [w.episode_tmdb_id, w.watched_at, w.origin]),
				[[101, null, "import"]],
			)
			assert.equal((await getImport("member", preview.id)).applied.added, 1)
		} else {
			assert.equal(show.state, null)
			assert.deepEqual(show.log, [])
			const receipt = await getImportItems(
				"member",
				preview.id,
				undefined,
				0,
				50,
			)
			assert.match(receipt.items[0].reason ?? "", /whole.*show/i)
		}
		await undoImport("member", preview.id)
		assert.equal((await getShowTracking("member", 1668)).state, null)
		assert.deepEqual((await getShowTracking("member", 1668)).log, [])
	}
})

it("Plan to watch is selectable as a show status and adds only Want to See, with receipt and undo", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const parsed = {
		source: "trakt" as const,
		warnings: [],
		observations: [
			{
				key: "status:1668",
				kind: "show_status" as const,
				mediaType: "show" as const,
				title: "Friends",
				year: 1994,
				tmdbId: 1668,
				imdbId: null,
				showStatus: "plan_to_watch" as const,
			},
		],
	}
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		parsed,
		"synthetic",
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 1)
	assert.equal((await getShowTracking("member", 1668)).state, null)
	const again = await previewParsedImport(
		"member",
		"statuses.json",
		parsed,
		"synthetic",
	)
	assert.equal(again.counts.unchanged, 1)
	await undoImport("member", preview.id)
	assert.equal((await getImport("member", preview.id)).status, "undone")
	assert.equal(
		(await previewParsedImport("member", "statuses.json", parsed, "synthetic"))
			.counts.new,
		1,
	)
})

it("a member's move after preview wins over a source status, even when the new state is Watching", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const { applyTrackingEvent } = await import("../tracking.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed(
		"episode",
		[1, 2].map((id) => ({
			show_id: 1668,
			tmdb_id: id,
			season_number: 1,
			episode_number: id,
			air_date: Date.UTC(1994, 0, 1),
			removed_at: null,
		})),
	)
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{
					key: "status:1668",
					kind: "show_status",
					mediaType: "show",
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus: "dropped",
				},
			],
		},
		"synthetic",
	)
	await applyTrackingEvent(
		"member",
		{ mediaType: "show", tmdbId: 1668 },
		{ type: "watch", season: 1, number: 1 },
		"645-member-watch",
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "done")
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
	assert.equal((await getImport("member", preview.id)).applied.kept, 1)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
})

it("conflicting statuses for one show stay unapplied with a reason instead of choosing an arbitrary row", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: ["watching", "dropped"].map((showStatus, index) => ({
				key: `status:${index}`,
				kind: "show_status" as const,
				mediaType: "show" as const,
				title: "Friends",
				year: 1994,
				tmdbId: 1668,
				imdbId: null,
				showStatus: showStatus as "watching" | "dropped",
			})),
		},
		"synthetic",
	)
	assert.equal(preview.counts.invalid, 2)
	const receipt = await getImportItems("member", preview.id, undefined, 0, 50)
	assert.ok(
		receipt.items.every((item) => /multiple.*status/i.test(item.reason ?? "")),
	)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "done")
	assert.equal((await getShowTracking("member", 1668)).state, null)
})

it("show statuses reject movies and missing values and respect the selected kinds", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Title", release_year: 1994 },
	]
	setImportDbForTest(db)
	setCrateClientForTest(new FakeTrackingCrate())
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const base = {
		key: "status",
		kind: "show_status" as const,
		mediaType: "show" as const,
		title: "Title",
		year: 1994,
		tmdbId: 1668,
		imdbId: null,
	}
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{ ...base, key: "movie", mediaType: "movie", showStatus: "dropped" },
				{ ...base, key: "missing" },
				{
					...base,
					key: "season",
					season: 1,
					showStatus: "completed",
					completionScope: "show",
				},
				{ ...base, showStatus: "watching" },
			],
		},
		"synthetic",
	)
	assert.deepEqual(
		[preview.counts.unsupported, preview.counts.invalid, preview.counts.new],
		[2, 1, 1],
	)
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.kept, 4)
	assert.equal((await getShowTracking("member", 1668)).state, null)
})

it("a status receipt resumes after an interrupted write and undo restores the previous status without watches", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("user_watch_state", [
		{
			user_id: "member",
			tmdb_id: 1668,
			media_type: "show",
			state: "watching",
			pass: 1,
			state_changed_at: 0,
			updated_at: 1000,
			created_at: 1000,
			seen_press_group: null,
			seen_press_from: null,
			seen_question: null,
			rate_prompt_dismissed_at: null,
		},
	])
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{
					key: "status",
					kind: "show_status",
					mediaType: "show",
					title: "Friends",
					year: 1994,
					tmdbId: 1668,
					imdbId: null,
					showStatus: "on_hold",
				},
			],
		},
		"synthetic",
	)
	const run = db.run.bind(db)
	let interrupted = false
	db.run = async (sql, params) => {
		if (!interrupted && sql.includes("SET apply_state = 'added'")) {
			interrupted = true
			throw new Error("Interrupted after the tracking write")
		}
		return run(sql, params)
	}
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["show_status"],
	})
	await waitFor(db, "failed")
	assert.equal((await getShowTracking("member", 1668)).state?.state, "on_hold")
	await confirmImport("member", preview.id, { ...options, kinds: ["rating"] })
	await waitFor(db, "done")
	assert.equal((await getImport("member", preview.id)).applied.added, 1)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
	assert.deepEqual((await getShowTracking("member", 1668)).log, [])
})

it("existing On hold, Dropped and Seen decisions remain protected regardless of the conflict choice", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	for (const state of ["on_hold", "dropped", "seen"]) {
		const db = new ImportDb()
		db.catalog = [
			{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
		]
		const trackingDb = new FakeTrackingCrate()
		trackingDb.seed("user_watch_state", [
			{
				user_id: "member",
				tmdb_id: 1668,
				media_type: "show",
				state,
				pass: 1,
				state_changed_at: 1000,
				updated_at: 1000,
				created_at: 1000,
				seen_press_group: null,
				seen_press_from: null,
				seen_question: null,
				rate_prompt_dismissed_at: null,
			},
		])
		setImportDbForTest(db)
		setCrateClientForTest(trackingDb)
		setImportEffectsForTest(
			async () => {},
			async () => {},
		)
		const preview = await previewParsedImport(
			"member",
			"statuses.json",
			{
				source: "trakt",
				warnings: [],
				observations: [
					{
						key: "status",
						kind: "show_status",
						mediaType: "show",
						title: "Friends",
						year: 1994,
						tmdbId: 1668,
						imdbId: null,
						showStatus: "watching",
					},
				],
			},
			"synthetic",
		)
		assert.equal(preview.counts.unchanged, 1)
		await confirmImport("member", preview.id, {
			...options,
			kinds: ["show_status"],
			conflictChoice: "source",
		})
		await waitFor(db, "done")
		assert.equal((await getImport("member", preview.id)).applied.kept, 1)
		await undoImport("member", preview.id)
		assert.equal((await getShowTracking("member", 1668)).state?.state, state)
	}
})

it("an explicit Watching status follows newly imported watches even when the show was already Watching", async () => {
	const { previewParsedImport } = await import("./service.server.ts")
	const db = new ImportDb()
	db.catalog = [
		{ tmdb_id: 1668, imdb_id: null, title: "Friends", release_year: 1994 },
	]
	db.episodes = [
		{
			show_id: 1668,
			tmdb_id: 101,
			season_number: 1,
			episode_number: 1,
			name: "Pilot",
			air_date: Date.UTC(1994, 0, 1),
			removed_at: null,
		},
	]
	const trackingDb = new FakeTrackingCrate()
	trackingDb.seed("episode", db.episodes)
	trackingDb.seed("user_watch_state", [
		{
			user_id: "member",
			tmdb_id: 1668,
			media_type: "show",
			state: "watching",
			pass: 1,
			state_changed_at: 0,
			updated_at: 1000,
			created_at: 1000,
			seen_press_group: null,
			seen_press_from: null,
			seen_question: null,
			rate_prompt_dismissed_at: null,
		},
	])
	setImportDbForTest(db)
	setCrateClientForTest(trackingDb)
	setImportEffectsForTest(
		async () => {},
		async () => {},
	)
	const base = {
		mediaType: "show" as const,
		title: "Friends",
		year: 1994,
		tmdbId: 1668,
		imdbId: null,
	}
	const preview = await previewParsedImport(
		"member",
		"statuses.json",
		{
			source: "trakt",
			warnings: [],
			observations: [
				{ ...base, key: "status", kind: "show_status", showStatus: "watching" },
				{
					...base,
					key: "watch",
					kind: "watch",
					episodeTmdbId: 101,
					season: 1,
					episode: 1,
				},
			],
		},
		"synthetic",
	)
	assert.equal(preview.counts.new, 2)
	await confirmImport("member", preview.id, {
		...options,
		kinds: ["watch", "show_status"],
	})
	await waitFor(db, "done")
	const watched = await getShowTracking("member", 1668)
	assert.equal(watched.state?.state, "watching")
	assert.equal(watched.log.length, 1)
	assert.equal((await getImport("member", preview.id)).applied.added, 2)
	await undoImport("member", preview.id)
	assert.equal((await getShowTracking("member", 1668)).state?.state, "watching")
	assert.deepEqual((await getShowTracking("member", 1668)).log, [])
})
