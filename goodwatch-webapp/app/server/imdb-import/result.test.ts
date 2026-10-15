// The IMDb import's result and Undo result: its own rows mapped to the shared sections.
// node-crate loads before the alias hook, which can't resolve the requires inside a CommonJS package.
import "node-crate"
import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { afterEach, beforeEach, test } from "node:test"
import ts from "typescript"
import { setCrateClientForTest } from "../../utils/crate.ts"

const STUBS: Record<string, string> = {
	"/server/onboarding-media.server.ts":
		"export const resetOnboardingMediaCache = async () => {}",
	"/server/taste/index.server.ts":
		"export const markTasteChanged = async () => {}",
	"/server/userData.server.ts":
		"export const resetUserDataCache = async () => {}",
	"/server/title-snapshot/format.server.ts":
		"export const getTitleSnapshot = () => null",
	// The movie rule has its own tests; here it would pull in the cache and Redis.
	"/server/tracking.server.ts": "export const settleMovies = async () => {}",
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		const stub = Object.keys(STUBS).find((path) => url.endsWith(path))
		if (stub)
			return { format: "module", source: STUBS[stub], shortCircuit: true }
		// The error class declares a field in its constructor, which Node can't run by stripping the types.
		if (!url.includes("/imdb-import/file.server.ts")) return next(url, context)
		const source = readFileSync(new URL(url), "utf8")
		return {
			format: "module",
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
				},
			}).outputText,
			shortCircuit: true,
		}
	},
})

const { undoImport } = await import("./apply.server.ts")
const { imdbImportResult, imdbImportResultPage } = await import(
	"./result.server.ts"
)

const USER = "member-1"
const IMPORT = "5b0c8f0e-7d0a-4c53-9f6b-0d1f1f6a2a10"
type Row = Record<string, unknown>

/** Enough of Crate for a finished IMDb import, its Undo and its result. Every statement sees the live rows. */
class FakeCrate {
	row: Row = {}
	items: Row[] = []
	scores: Row[] = []
	catalog: Row[] = []

	async execute(sql: string, params: unknown[] = []) {
		const s = sql.trim().replace(/\s+/g, " ")
		const done = (json: Row[], rowcount = json.length) => ({ json, rowcount })
		if (s.startsWith("REFRESH")) return done([])
		if (/^SELECT .* FROM doc\.user_import WHERE id = \?$/.test(s))
			return done(
				this.row.id === params[0] ? [{ ...this.row, read_at: Date.now() }] : [],
			)
		const tail = (from: number) => params.slice(from).map(Number)
		if (
			s.startsWith(
				"SELECT row_index, tmdb_id, media_type, prior_score, applied_score FROM doc.user_import_item WHERE import_id = ? AND apply_state IN ('added', 'updated')",
			)
		)
			return done(
				this.items.filter(
					(item) =>
						item.import_id === params[0] &&
						["added", "updated"].includes(String(item.apply_state)),
				),
			)
		if (
			s.startsWith(
				"SELECT row_index, imdb_id, title, year, outcome, reason, tmdb_id, media_type, current_score, apply_state, prior_score, applied_score, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? ORDER BY row_index",
			)
		)
			return done(
				this.items.filter(
					(item) => item.import_id === params[0] && item.user_id === params[1],
				),
			)
		if (
			s.startsWith(
				"SELECT tmdb_id, score FROM user_score WHERE user_id = ? AND media_type = ? AND tmdb_id IN",
			)
		)
			return done(
				this.scores.filter(
					(x) =>
						x.user_id === params[0] &&
						x.media_type === params[1] &&
						tail(2).includes(Number(x.tmdb_id)),
				),
			)
		const catalog = s.match(
			/^SELECT tmdb_id, title, release_year, poster_path FROM (movie|show) WHERE tmdb_id IN/,
		)
		if (catalog)
			return done(
				this.catalog.filter(
					(x) =>
						x.media_type === catalog[1] && tail(0).includes(Number(x.tmdb_id)),
				),
			)
		if (
			s.startsWith(
				"DELETE FROM user_score WHERE user_id = ? AND media_type = ? AND score = ? AND (review IS NULL OR review = '') AND tmdb_id IN",
			)
		) {
			const before = this.scores.length
			this.scores = this.scores.filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.media_type === params[1] &&
						x.score === params[2] &&
						!x.review &&
						tail(3).includes(Number(x.tmdb_id))
					),
			)
			return done([], before - this.scores.length)
		}
		if (
			s.startsWith(
				"UPDATE user_score SET score = ?, updated_at = ? WHERE user_id = ? AND media_type = ? AND score = ? AND tmdb_id IN",
			)
		) {
			let n = 0
			for (const x of this.scores)
				if (
					x.user_id === params[2] &&
					x.media_type === params[3] &&
					x.score === params[4] &&
					tail(5).includes(Number(x.tmdb_id))
				) {
					x.score = params[0]
					n++
				}
			return done([], n)
		}
		if (
			s.startsWith(
				"UPDATE doc.user_import_item SET undo_outcome = ? WHERE import_id = ? AND row_index IN",
			)
		) {
			for (const item of this.items)
				if (
					item.import_id === params[1] &&
					tail(2).includes(Number(item.row_index))
				)
					item.undo_outcome = params[0]
			return done([], 1)
		}
		if (
			s ===
			"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added', 'updated')"
		) {
			for (const item of this.items)
				if (["added", "updated"].includes(String(item.apply_state)))
					item.apply_state = "undone"
			return done([], 1)
		}
		if (
			s ===
			"UPDATE doc.user_import SET status = 'undone', updated_at = ? WHERE id = ?"
		) {
			this.row.status = "undone"
			return done([], 1)
		}
		throw new Error(`The fake Crate doesn't know this statement: ${s}`)
	}
}

let crate: FakeCrate

const item = (row_index: number, fields: Row): Row => ({
	import_id: IMPORT,
	user_id: USER,
	row_index,
	imdb_id: `tt${1000 + row_index}`,
	title: null,
	year: null,
	outcome: "new",
	reason: null,
	tmdb_id: null,
	media_type: "movie",
	current_score: null,
	apply_state: null,
	prior_score: null,
	applied_score: null,
	undo_outcome: null,
	...fields,
})

beforeEach(() => {
	crate = new FakeCrate()
	setCrateClientForTest(crate)
	const now = new Date("2026-10-06T12:00:00Z")
	crate.row = {
		id: IMPORT,
		user_id: USER,
		source: "imdb",
		status: "done",
		file_name: "ratings.csv",
		conflict_choice: "keep",
		counts: JSON.stringify({
			rows: 6,
			new: 2,
			update: 1,
			unchanged: 1,
			conflict: 1,
			unmatched: 1,
			unsupported: 0,
			invalid: 0,
		}),
		processed: 3,
		total: 3,
		added: 2,
		updated: 1,
		kept: 1,
		failed: 0,
		without_fingerprint: null,
		error: null,
		created_at: now,
		updated_at: now,
		confirmed_at: now,
		finished_at: now,
		_seq_no: 7,
		_primary_term: 1,
	}
	crate.items = [
		item(0, {
			title: "Dune: Part Two",
			year: 2024,
			tmdb_id: 693134,
			imdb_score: 9,
			apply_state: "added",
			applied_score: 9,
		}),
		item(1, {
			title: "Arrival",
			year: 2016,
			tmdb_id: 329865,
			imdb_score: 9,
			outcome: "update",
			current_score: 7,
			apply_state: "updated",
			prior_score: 7,
			applied_score: 9,
		}),
		item(2, {
			title: "Shōgun",
			year: 2024,
			tmdb_id: 126308,
			media_type: "show",
			imdb_score: 9,
			apply_state: "added",
			applied_score: 9,
		}),
		item(3, {
			title: "Parasite",
			year: 2019,
			tmdb_id: 496243,
			imdb_score: 10,
			outcome: "unchanged",
			current_score: 10,
		}),
		item(4, {
			title: "Heat",
			year: 1995,
			tmdb_id: 949,
			imdb_score: 6,
			outcome: "conflict",
			current_score: 8,
			apply_state: "kept",
		}),
		item(5, {
			title: "Kurzfilmnacht",
			year: 2021,
			imdb_score: 6,
			outcome: "unmatched",
			reason: "This IMDb title isn't in the GoodWatch catalog yet.",
		}),
	]
	crate.scores = [
		{
			user_id: USER,
			tmdb_id: 693134,
			media_type: "movie",
			score: 9,
			review: null,
		},
		{
			user_id: USER,
			tmdb_id: 329865,
			media_type: "movie",
			score: 9,
			review: null,
		},
		// The member rated Shōgun again after the import.
		{
			user_id: USER,
			tmdb_id: 126308,
			media_type: "show",
			score: 10,
			review: null,
		},
		{
			user_id: USER,
			tmdb_id: 496243,
			media_type: "movie",
			score: 10,
			review: null,
		},
		{
			user_id: USER,
			tmdb_id: 949,
			media_type: "movie",
			score: 8,
			review: null,
		},
	]
	crate.catalog = [
		{
			media_type: "movie",
			tmdb_id: 693134,
			title: "Dune: Part Two",
			release_year: 2024,
			poster_path: "/dune.jpg",
		},
		{
			media_type: "show",
			tmdb_id: 126308,
			title: "Shōgun",
			release_year: 2024,
			poster_path: "/shogun.jpg",
		},
	]
})
afterEach(() => setCrateClientForTest(null))

const view = (result: {
	sections: {
		key: string
		rows: { title: { title: string } | null; changes: unknown[] }[]
	}[]
}) =>
	result.sections.map((s) => [
		s.key,
		s.rows.map((row) => [row.title?.title ?? null, row.changes]),
	])

test("an IMDb import lists ratings added and replaced, kept and not imported, under the catalog's posters", async () => {
	const result = await imdbImportResult(USER, IMPORT)
	assert.equal(result.operation, "import")
	assert.equal(result.titles, 3)
	assert.deepEqual(view(result), [
		[
			"ratings_added",
			[
				["Dune: Part Two", [{ type: "rating-added", score: 9 }]],
				["Shōgun", [{ type: "rating-added", score: 9 }]],
			],
		],
		[
			"ratings_replaced",
			[["Arrival", [{ type: "rating-replaced", from: 7, to: 9 }]]],
		],
		[
			"kept",
			[
				[
					"Parasite",
					[
						{
							type: "kept",
							kind: "rating",
							reason: "Already the same in GoodWatch.",
						},
					],
				],
				[
					"Heat",
					[
						{
							type: "kept",
							kind: "rating",
							reason: "You chose to keep your GoodWatch rating of 8.",
						},
					],
				],
			],
		],
		[
			"skipped",
			[
				[
					null,
					[
						{
							type: "skipped",
							kind: "rating",
							label: "Kurzfilmnacht (2021)",
							row: 6,
							reason: "This IMDb title isn't in the GoodWatch catalog yet.",
						},
					],
				],
			],
		],
	])
	assert.equal(result.sections[0].rows[0].title?.posterPath, "/dune.jpg")
	const page = await imdbImportResultPage(USER, IMPORT, "ratings_added", 1, 10)
	assert.deepEqual(
		page.rows.map((row) => [row.title?.title, row.title?.posterPath]),
		[["Shōgun", "/shogun.jpg"]],
	)
	assert.equal(page.total, 2)
})

test("IMDb Undo records per rating whether it took it back or left the member's later rating", async () => {
	await undoImport(USER, IMPORT)
	assert.deepEqual(
		crate.scores.map((x) => [x.tmdb_id, x.score]),
		[
			[329865, 7],
			[126308, 10],
			[496243, 10],
			[949, 8],
		],
	)
	const result = await imdbImportResult(USER, IMPORT)
	assert.equal(result.operation, "undo")
	assert.equal(result.titles, 2)
	assert.deepEqual(view(result), [
		[
			"ratings_removed",
			[["Dune: Part Two", [{ type: "rating-removed", score: 9 }]]],
		],
		[
			"ratings_restored",
			[["Arrival", [{ type: "rating-restored", from: 9, to: 7 }]]],
		],
		["left", [["Shōgun", [{ type: "left", kind: "rating" }]]]],
	])
})
