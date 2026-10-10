import "node-crate"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import type { ImportOptions } from "../../domain/imports.ts"
import type { Param } from "./store.server.ts"

const { confirmImport, getImport, undoImport } = await import(
	"./service.server.ts"
)
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

class ImportDb {
	imports: Row[] = []
	items: Row[] = []
	favorites: Row[] = []
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
		if (s.includes("FROM user_favorite")) {
			const row = this.favorites.find(
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
		if (s.startsWith("INSERT INTO user_favorite")) {
			if (this.failFavoriteOnce) {
				this.failFavoriteOnce = false
				throw new Error("injected interruption")
			}
			if (
				!this.favorites.some(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2],
				)
			)
				this.favorites.push({
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
		if (s.startsWith("DELETE FROM user_favorite")) {
			const before = this.favorites.length
			this.favorites = this.favorites.filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.media_type === params[2] &&
						x._seq_no === params[3] &&
						x._primary_term === params[4]
					),
			)
			return { rowcount: before - this.favorites.length }
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
		if (s.includes("kind IN ('watch','state')")) return { rowcount: 0 }
		throw new Error(`Unexpected run: ${s}`)
	}
}

async function waitFor(db: ImportDb, status: string) {
	for (let i = 0; i < 100; i++) {
		if (db.imports[0].status === status) return
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail(`import stayed ${db.imports[0].status}`)
}

afterEach(() => {
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
