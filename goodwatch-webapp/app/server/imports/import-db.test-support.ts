import type { Param } from "./store.server.ts"
type Row = Record<string, unknown>
function requiredRow(row: Row | undefined): Row {
	if (!row) throw new Error("Expected the fake import row to exist.")
	return row
}
// The fake implements only these statement shapes. Reject changed predicates or columns
// instead of silently returning empty rows/success. Placeholder lists may vary in length.
const supportedImportSql = new Set([
	"SELECT tmdb_id, popularity FROM movie WHERE tmdb_id IN (?)",
	"SELECT tmdb_id, popularity FROM show WHERE tmdb_id IN (?)",
	"SELECT tmdb_id, state FROM user_watch_state WHERE user_id = ? AND media_type = 'show' AND tmdb_id IN (?)",
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
	"SELECT created_at, updated_at, _seq_no, _primary_term FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"DELETE FROM user_not_interested WHERE user_id = ? AND tmdb_id = ? AND media_type = ? AND _seq_no = ? AND _primary_term = ?",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, apply_state, watch_id, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? ORDER BY row_index LIMIT 100001",
	"SELECT tmdb_id, title, release_year, poster_path FROM movie WHERE tmdb_id IN (?)",
	"SELECT tmdb_id, title, release_year, poster_path FROM show WHERE tmdb_id IN (?)",
	"UPDATE doc.user_import_item SET undo_outcome = ? WHERE import_id = ? AND row_index = ?",
	"SELECT apply_state, count(*) AS n FROM doc.user_import_item WHERE import_id = ? AND kind <> 'state' GROUP BY apply_state",
	"SELECT created_at, updated_at FROM user_favorite WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT created_at, updated_at, _seq_no, _primary_term FROM user_favorite WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT created_at, updated_at, _seq_no, _primary_term FROM user_wishlist WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT id, user_id, source, status, file_name, counts, processed, total, added, updated, kept, failed, error, created_at, updated_at, confirmed_at, finished_at, options, warnings, kinds, CURRENT_TIMESTAMP AS read_at, _seq_no, _primary_term FROM doc.user_import WHERE id = ?",
	"SELECT id, user_id, source, status, file_name, counts, processed, total, added, updated, kept, failed, error, created_at, updated_at, confirmed_at, finished_at, options, warnings, kinds, CURRENT_TIMESTAMP AS read_at, _seq_no, _primary_term FROM doc.user_import WHERE user_id = ? AND source IN (?) AND status <> 'preview' ORDER BY created_at DESC LIMIT 100",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' AND (apply_state IS NULL OR apply_state = 'failed') ORDER BY row_index LIMIT 100001",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' ORDER BY row_index LIMIT 100001",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' ORDER BY row_index LIMIT ? OFFSET ?",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' AND outcome = ? ORDER BY row_index LIMIT ? OFFSET ?",
	"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND row_index = ? AND kind <> 'state' LIMIT 1",
	"SELECT row_index, source_key, payload, apply_state, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind = 'state' LIMIT 100001",
	"SELECT score, review, created_at, updated_at, _seq_no, _primary_term FROM user_score WHERE user_id = ? AND tmdb_id = ? AND media_type = ?",
	"SELECT tmdb_id, imdb_id, title, release_year FROM movie WHERE imdb_id IN (?)",
	"SELECT tmdb_id, imdb_id, title, release_year FROM show WHERE imdb_id IN (?)",
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
	"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND user_id = ? AND kind IN ('watch','state') AND apply_state IN ('added','kept')",
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

export class ImportDb {
	animeSnapshot: unknown = null
	imports: Row[] = []
	items: Row[] = []
	favorites: Row[] = []
	wishlist: Row[] = []
	watches: Row[] = []
	notInterested: Row[] = []
	showStates: Row[] = []
	catalog: Row[] = []
	episodes: Row[] = []
	catalogQueries: { sql: string; params: Param[] }[] = []
	scores: Row[] = []
	failWishlistDeleteOnce = false
	failFavoriteOnce = false
	failScoreOnce = false
	/** Throws once when Undo records this outcome, as a crash right after its write would. */
	failUndoOutcomeOnce: string | null = null
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
		if (s.includes("FROM user_watch_state"))
			return this.showStates.filter(
				(row) =>
					row.user_id === params[0] &&
					row.media_type === "show" &&
					params.slice(1).includes(Number(row.tmdb_id)),
			) as T[]
		if (s.includes("FROM episode WHERE"))
			return this.episodes.filter((row) => row.show_id === params[0]) as T[]
		if (s.includes("FROM movie WHERE") || s.includes("FROM show WHERE")) {
			this.catalogQueries.push({ sql: s, params: [...params] })
			const rows = this.catalog
				.filter(
					(row) =>
						!row.media_type ||
						row.media_type ===
							(s.includes("FROM movie WHERE") ? "movie" : "show"),
				)
				.filter((row) =>
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
		if (s.includes("FROM user_watch_log"))
			return this.watches.filter(
				(row) =>
					row.user_id === params[0] &&
					(params.length === 1 ||
						(row.tmdb_id === params[1] && row.media_type === params[2])),
			) as T[]
		if (s.includes("FROM user_not_interested"))
			return this.notInterested
				.filter(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2],
				)
				.map((x) => ({ ...x })) as T[]
		if (s.includes("FROM doc.user_import WHERE user_id = ?"))
			return this.imports
				.filter(
					(row) =>
						row.user_id === params[0] &&
						params.slice(1).includes(String(row.source)) &&
						row.status !== "preview",
				)
				.slice(0, 100)
				.map((row) => ({ ...row, read_at: new Date() })) as unknown as T[]
		if (s.includes("FROM doc.user_import WHERE id = ?")) {
			const row = this.imports.find((x) => x.id === params[0])
			return (row ? [{ ...row, read_at: new Date() }] : []) as unknown as T[]
		}
		if (s.includes("FROM doc.user_import_item")) {
			let rows = this.items.filter(
				(x) =>
					x.import_id === params[0] && (!params[1] || x.user_id === params[1]),
			)
			if (s.includes("AND row_index = ?"))
				rows = rows.filter((x) => x.row_index === params[2])
			if (s.includes("AND outcome = ?"))
				rows = rows.filter((x) => x.outcome === params[2])
			if (s.includes("LIMIT ? OFFSET ?"))
				rows = rows.slice(
					Number(params.at(-1)),
					Number(params.at(-1)) + Number(params.at(-2)),
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
			if (params.length === 1)
				return this.scores.filter((x) => x.user_id === params[0]) as T[]
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
		if (s.startsWith("UPDATE doc.user_import_item SET undo_outcome = ?")) {
			if (this.failUndoOutcomeOnce === params[0]) {
				this.failUndoOutcomeOnce = null
				throw new Error("injected interruption")
			}
			const row = requiredRow(
				this.items.find(
					(x) => x.import_id === params[1] && x.row_index === params[2],
				),
			)
			row.undo_outcome = params[0]
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
					["added", "updated", "kept"].includes(String(row.apply_state)) &&
					(!s.includes("kind IN") ||
						(s.includes("'show_status'")
							? ["watch", "show_status", "state"]
							: ["watch", "state"]
						).includes(String(row.kind)))
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
			if (this.failWishlistDeleteOnce && name === "wishlist") {
				this.failWishlistDeleteOnce = false
				throw new Error("injected interruption")
			}
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
		if (s.startsWith("DELETE FROM user_not_interested")) {
			const before = this.notInterested.length
			this.notInterested = this.notInterested.filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2] &&
						x._seq_no === params[3] &&
						x._primary_term === params[4]
					),
			)
			return { rowcount: before - this.notInterested.length }
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
