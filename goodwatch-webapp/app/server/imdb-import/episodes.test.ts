// IMDb ratings files keep "TV Episode" rows as the member's episode scores (#759): matched to a GoodWatch episode by
// the episode grid's identity rule, previewed against the member's episode scores, written to user_episode_score
// through the shared journal, and taken back by Undo. Never to user_score. Synthetic data only.
import "./loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { setCrateClientForTest } from "../../utils/crate.ts"

const { createPreview } = await import("./preview.server.ts")
const { confirmImport, undoImport } = await import("./apply.server.ts")
const { getImportRow, listItems } = await import("./store.server.ts")
const { imdbImportResult } = await import("./result.server.ts")
const { clearResultCacheForTest } = await import(
	"../imports/result-catalog.server.ts"
)
const { setScoreWatchTrackingForTest } = await import(
	"../imports/episode-score-watches.server.ts"
)
type Plan = import("../imports/tracking.server.ts").ImportTrackingPlan
type PlanInput = Parameters<
	(typeof import("../imports/tracking.server.ts"))["prepareImportTrackingPlan"]
>[0]

/**
 * The tracking writer's side of an import's episode score watches, in memory: the member's watched episodes, and
 * what each plan asked for. The writer itself is tested with tracking.server.ts.
 */
class FakeTracking {
	watched = new Set<number>()
	asked: Omit<PlanInput, "items" | "now">[] = []
	undone: string[] = []
	restored = 0
	async prepareImportTrackingPlan(input: PlanInput): Promise<Plan> {
		const { items, now, ...rest } = input
		this.asked.push(rest)
		const fresh = items.filter((item) => !this.watched.has(Number(item.episodeTmdbId)))
		return {
			userId: input.userId,
			importId: input.importId,
			title: { mediaType: "show", tmdbId: input.tmdbId },
			now,
			beforeState: null,
			afterState: null,
			watches: fresh.map((item) => ({
				watch_id: `i-${item.key}`,
				media_type: "show",
				tmdb_id: input.tmdbId,
				episode_tmdb_id: item.episodeTmdbId ?? null,
				season_number: item.season ?? null,
				episode_number: item.episode ?? null,
				watched_at: null,
				watched_at_precision: item.precision ?? "unknown",
				origin: "import",
				group_id: null,
				import_id: input.importId,
				pass: 1,
				created_at: now,
			})),
			addedKeys: fresh.map((item) => item.key),
			keptKeys: items.filter((item) => !fresh.includes(item)).map((item) => item.key),
			clear: [],
		}
	}
	async applyImportTrackingPlan(_userId: string, plan: Plan) {
		for (const watch of plan.watches) this.watched.add(Number(watch.episode_tmdb_id))
		return { added: plan.watches.length, kept: 0, watchIds: [], statusKeys: [] }
	}
	async undoImportTrackingPlan(_userId: string, plan: Plan) {
		for (const watch of plan.watches) {
			this.watched.delete(Number(watch.episode_tmdb_id))
			this.undone.push(watch.watch_id)
		}
		return "reverted" as const
	}
	async restoreImportTrackingIntentions() {
		this.restored++
	}
}
let tracking: FakeTracking

const USER = "member-1"
const SHOW = 1399
type Row = Record<string, unknown>

/**
 * Enough of Crate for the IMDb import's preview, apply and Undo of episode rows, and the shared episode score writer.
 * Every statement sees the live rows. A statement it doesn't know fails the test.
 */
class FakeCrate {
	imports: Row[] = []
	items: Row[] = []
	userScores: Row[] = []
	episodeScores: Row[] = []
	episodes: Row[] = []
	imdbEpisodes: Row[] = []
	catalog: Row[] = []
	/** Answers like Crate before the user_episode_score migration ran. */
	missingEpisodeScores = false
	statements: string[] = []
	private version = 100

	async execute(sql: string, params: unknown[] = []) {
		const s = sql.trim().replace(/\s+/g, " ")
		this.statements.push(s)
		const done = (json: Row[], rowcount = json.length) => ({ json, rowcount })
		if (this.missingEpisodeScores && s.includes("user_episode_score"))
			throw new Error("RelationUnknown[Relation 'user_episode_score' unknown]")
		if (s.startsWith("REFRESH")) return done([])
		const list = (from: number) => params.slice(from)

		// The import row.
		if (/^SELECT .* FROM doc\.user_import WHERE id = \?$/.test(s))
			return done(
				this.imports
					.filter((x) => x.id === params[0])
					.map((x) => ({ ...x, read_at: Date.now() })),
			)
		if (
			/^SELECT .* FROM doc\.user_import WHERE user_id = \? AND source = 'imdb' AND status = \?/.test(
				s,
			)
		)
			return done(
				this.imports.filter(
					(x) => x.user_id === params[0] && x.status === params[1],
				),
			)
		if (s.startsWith("INSERT INTO doc.user_import (")) {
			this.imports.push({
				id: params[0],
				user_id: params[1],
				source: "imdb",
				status: "preview",
				file_name: params[2],
				counts: params[3],
				processed: 0,
				total: 0,
				added: 0,
				updated: 0,
				kept: 0,
				failed: 0,
				conflict_choice: null,
				without_fingerprint: null,
				error: null,
				created_at: params[4],
				updated_at: params[5],
				confirmed_at: null,
				finished_at: null,
				_seq_no: ++this.version,
				_primary_term: 1,
			})
			return done([], 1)
		}
		if (
			s.startsWith(
				"UPDATE doc.user_import SET status = 'running', conflict_choice = ?",
			)
		) {
			const row = this.imports.find(
				(x) => x.id === params[3] && x._seq_no === params[4],
			)
			if (!row) return done([], 0)
			Object.assign(row, {
				status: "running",
				conflict_choice: params[0],
				total: params[1],
				confirmed_at: params[2],
				_seq_no: ++this.version,
			})
			return done([], 1)
		}
		if (s.startsWith("UPDATE doc.user_import SET processed = ?")) {
			const row = this.imports.find((x) => x.id === params[5])
			Object.assign(row ?? {}, {
				processed: params[0],
				added: params[1],
				updated: params[2],
				kept: params[3],
				failed: params[4],
			})
			return done([], 1)
		}
		if (s.startsWith("UPDATE doc.user_import SET status = ?, error = ?")) {
			const row = this.imports.find((x) => x.id === params[10])
			Object.assign(row ?? {}, {
				status: params[0],
				error: params[1],
				added: params[3],
				updated: params[4],
				kept: params[5],
				failed: params[6],
				finished_at: params[8],
				updated_at: params[9],
				_seq_no: ++this.version,
			})
			return done([], 1)
		}
		if (s.startsWith("UPDATE doc.user_import SET status = 'failed'")) {
			const row = this.imports.find((x) => x.id === params[2])
			Object.assign(row ?? {}, { status: "failed", error: params[0] })
			return done([], 1)
		}
		if (
			s ===
			"UPDATE doc.user_import SET status = 'undone', updated_at = ? WHERE id = ?"
		) {
			const row = this.imports.find((x) => x.id === params[1])
			Object.assign(row ?? {}, { status: "undone", updated_at: params[0] })
			return done([], 1)
		}
		if (s === "DELETE FROM doc.user_import_item WHERE import_id = ?") {
			this.items = this.items.filter((x) => x.import_id !== params[0])
			return done([], 1)
		}
		if (s === "DELETE FROM doc.user_import WHERE id = ?") {
			this.imports = this.imports.filter((x) => x.id !== params[0])
			return done([], 1)
		}

		// The import's rows.
		if (s.startsWith("INSERT INTO doc.user_import_item (")) {
			const columns = s
				.slice(s.indexOf("(") + 1, s.indexOf(")"))
				.split(",")
				.map((c) => c.trim())
			for (let i = 0; i < params.length; i += columns.length)
				this.items.push(
					Object.fromEntries(columns.map((c, j) => [c, params[i + j]])),
				)
			return done([], params.length / columns.length)
		}
		const own = (id: unknown) => this.items.filter((x) => x.import_id === id)
		if (
			s.startsWith(
				"SELECT tmdb_id, media_type, applied_score FROM doc.user_import_item WHERE user_id = ? AND apply_state IN ('added', 'updated') AND (kind IS NULL OR kind <> 'episode_rating')",
			)
		)
			return done(
				this.items.filter(
					(x) =>
						x.user_id === params[0] &&
						["added", "updated"].includes(String(x.apply_state)) &&
						x.kind !== "episode_rating",
				),
			)
		if (
			s.startsWith(
				"SELECT tmdb_id, episode_tmdb_id, applied_score FROM doc.user_import_item WHERE user_id = ? AND kind = 'episode_rating' AND apply_state IN ('added', 'updated') AND applied_score IS NOT NULL",
			)
		)
			return done(
				this.items.filter(
					(x) =>
						x.user_id === params[0] &&
						x.kind === "episode_rating" &&
						["added", "updated"].includes(String(x.apply_state)) &&
						x.applied_score != null,
				),
			)
		if (
			s ===
			"UPDATE doc.user_import_item SET apply_state = 'kept' WHERE import_id = ? AND outcome = 'conflict' AND apply_state IS NULL"
		) {
			for (const x of own(params[0]))
				if (x.outcome === "conflict" && x.apply_state == null)
					x.apply_state = "kept"
			return done([], 1)
		}
		const pending = (x: Row, outcomes: string) =>
			outcomes.includes(`'${x.outcome}'`) &&
			(x.apply_state == null || x.apply_state === "failed")
		if (
			s.startsWith(
				"SELECT row_index, tmdb_id, media_type, imdb_score, current_score FROM doc.user_import_item",
			)
		) {
			const outcomes = s.slice(s.indexOf("outcome IN"))
			return done(
				own(params[0]).filter((x) => x.kind == null && pending(x, outcomes)),
			)
		}
		if (
			s.startsWith(
				"SELECT row_index, tmdb_id, imdb_score, payload FROM doc.user_import_item",
			)
		) {
			const outcomes = s.slice(s.indexOf("outcome IN"))
			return done(
				own(params[0]).filter(
					(x) => x.kind === "episode_rating" && pending(x, outcomes),
				),
			)
		}
		if (
			s.startsWith(
				"SELECT apply_state, count(*) AS n FROM doc.user_import_item",
			)
		) {
			const counts = new Map<string, number>()
			for (const x of own(params[0]))
				if (x.apply_state != null)
					counts.set(
						String(x.apply_state),
						(counts.get(String(x.apply_state)) ?? 0) + 1,
					)
			return done([...counts].map(([apply_state, n]) => ({ apply_state, n })))
		}
		if (s.startsWith("UPDATE doc.user_import_item SET apply_state = ?")) {
			const written = s.includes("applied_score = imdb_score")
			const rows = list(written ? 3 : 2).map(Number)
			for (const x of own(params[written ? 2 : 1]))
				if (rows.includes(Number(x.row_index)))
					Object.assign(x, {
						apply_state: params[0],
						...(written
							? {
									prior_score: x.current_score,
									applied_score: x.imdb_score,
									applied_at: params[1],
								}
							: {}),
					})
			return done([], rows.length)
		}
		if (
			s ===
			"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?"
		) {
			for (const x of own(params[1]))
				if (Number(x.row_index) === params[2]) x.payload = params[0]
			return done([], 1)
		}
		if (
			s ===
			"UPDATE doc.user_import_item SET undo_outcome = ? WHERE import_id = ? AND row_index = ?"
		) {
			for (const x of own(params[1]))
				if (Number(x.row_index) === params[2]) x.undo_outcome = params[0]
			return done([], 1)
		}
		if (
			s.startsWith(
				"UPDATE doc.user_import_item SET undo_outcome = ? WHERE import_id = ? AND row_index IN",
			)
		) {
			const rows = list(2).map(Number)
			for (const x of own(params[1]))
				if (rows.includes(Number(x.row_index))) x.undo_outcome = params[0]
			return done([], rows.length)
		}
		if (
			s ===
			"UPDATE doc.user_import_item SET apply_state = 'undone' WHERE import_id = ? AND apply_state IN ('added', 'updated')"
		) {
			for (const x of own(params[0]))
				if (["added", "updated"].includes(String(x.apply_state)))
					x.apply_state = "undone"
			return done([], 1)
		}
		if (
			s.startsWith(
				"SELECT row_index, tmdb_id, media_type, prior_score, applied_score, undo_outcome FROM doc.user_import_item",
			)
		) {
			assert.match(s, /AND kind IS NULL/)
			return done(
				own(params[0]).filter(
					(x) =>
						x.kind == null &&
						["added", "updated"].includes(String(x.apply_state)),
				),
			)
		}
		if (
			s ===
			"SELECT row_index, tmdb_id, payload, apply_state FROM doc.user_import_item WHERE import_id = ? AND kind = 'episode_rating' AND tmdb_id IS NOT NULL LIMIT 50000"
		)
			return done(
				own(params[0]).filter(
					(x) => x.kind === "episode_rating" && x.tmdb_id != null,
				),
			)
		if (
			s.startsWith(
				"SELECT row_index, tmdb_id, payload, undo_outcome FROM doc.user_import_item",
			)
		) {
			return done(
				own(params[0]).filter(
					(x) =>
						x.kind === "episode_rating" &&
						["added", "updated"].includes(String(x.apply_state)),
				),
			)
		}
		if (s.startsWith("SELECT imdb_id, title, year, title_type")) {
			const rows = own(params[0]).sort(
				(a, b) => Number(a.row_index) - Number(b.row_index),
			)
			const filtered = s.includes("AND outcome = ?")
				? rows.filter((x) => x.outcome === params[2])
				: s.includes("AND outcome IN ('unmatched', 'unsupported', 'invalid')")
					? rows.filter((x) =>
							["unmatched", "unsupported", "invalid"].includes(
								String(x.outcome),
							),
						)
					: rows
			return done(filtered)
		}
		if (
			s.startsWith("SELECT row_index, imdb_id, title, year, outcome, reason")
		) {
			return done(
				own(params[0]).sort(
					(a, b) => Number(a.row_index) - Number(b.row_index),
				),
			)
		}

		// The catalog and IMDb's episode list.
		if (/^SELECT tmdb_id, imdb_id FROM (movie|show) WHERE imdb_id IN/.test(s))
			return done([])
		if (
			s.startsWith(
				"SELECT show_id, tmdb_id, imdb_id, season_number, episode_number, name FROM episode WHERE imdb_id IN",
			)
		)
			return done(
				this.episodes.filter((x) => x.imdb_id && list(0).includes(x.imdb_id)),
			)
		if (
			s.startsWith(
				"SELECT show_id, imdb_episode_id FROM imdb_episode WHERE imdb_episode_id IN",
			)
		)
			return done(
				this.imdbEpisodes.filter((x) => list(0).includes(x.imdb_episode_id)),
			)
		if (
			s.startsWith(
				"SELECT imdb_episode_id, season_number, episode_number, name FROM imdb_episode WHERE show_id = ?",
			)
		)
			return done(this.imdbEpisodes.filter((x) => x.show_id === params[0]))
		if (
			s.startsWith(
				"SELECT tmdb_id, imdb_id, season_number, episode_number, name FROM episode WHERE show_id = ?",
			)
		)
			return done(this.episodes.filter((x) => x.show_id === params[0]))
		const catalog = s.match(
			/^SELECT tmdb_id, title, release_year, poster_path FROM (movie|show) WHERE tmdb_id IN/,
		)
		if (catalog)
			return done(
				this.catalog.filter(
					(x) =>
						x.media_type === catalog[1] &&
						list(0).map(Number).includes(Number(x.tmdb_id)),
				),
			)

		// The member's scores.
		if (
			s.startsWith(
				"SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ?",
			)
		)
			return done(this.userScores.filter((x) => x.user_id === params[0]))
		if (
			s.startsWith(
				"SELECT tmdb_id, score_key, score, updated_at, _seq_no, _primary_term FROM user_episode_score WHERE user_id = ?",
			)
		)
			return done(this.episodeScores.filter((x) => x.user_id === params[0]))
		if (
			s ===
			"SELECT score, created_at, updated_at, _seq_no, _primary_term FROM user_episode_score WHERE user_id = ? AND tmdb_id = ? AND score_key = ?"
		)
			return done(
				this.episodeScores.filter(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2],
				),
			)
		if (s.startsWith("INSERT INTO user_episode_score (")) {
			if (
				this.episodeScores.some(
					(x) =>
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2],
				)
			)
				return done([], 0)
			this.episodeScores.push({
				user_id: params[0],
				tmdb_id: params[1],
				score_key: params[2],
				scope: params[3],
				season_number: params[4],
				episode_number: params[5],
				episode_tmdb_id: params[6],
				ranges: params[7],
				label: params[8],
				score: params[9],
				created_at: params[10],
				updated_at: params[11],
				_seq_no: ++this.version,
				_primary_term: 1,
			})
			return done([], 1)
		}
		if (s.startsWith("UPDATE user_episode_score SET score = ?")) {
			const restore = s.includes("created_at = ?")
			const at = restore ? 3 : 2
			const row = this.episodeScores.find(
				(x) =>
					x.user_id === params[at] &&
					x.tmdb_id === params[at + 1] &&
					x.score_key === params[at + 2] &&
					x._seq_no === params[at + 3] &&
					x._primary_term === params[at + 4],
			)
			if (!row) return done([], 0)
			Object.assign(row, {
				score: params[0],
				...(restore
					? { created_at: params[1], updated_at: params[2] }
					: { updated_at: params[1] }),
				_seq_no: ++this.version,
			})
			return done([], 1)
		}
		if (s.startsWith("DELETE FROM user_episode_score")) {
			const before = this.episodeScores.length
			this.episodeScores = this.episodeScores.filter(
				(x) =>
					!(
						x.user_id === params[0] &&
						x.tmdb_id === params[1] &&
						x.score_key === params[2] &&
						x._seq_no === params[3]
					),
			)
			return done([], before - this.episodeScores.length)
		}
		throw new Error(`The fake Crate doesn't know this statement: ${s}`)
	}
}

let crate: FakeCrate
const episode = (
	tmdb_id: number,
	season_number: number,
	episode_number: number,
	name: string,
	imdb_id: string | null = null,
) => ({
	show_id: SHOW,
	tmdb_id,
	season_number,
	episode_number,
	name,
	imdb_id,
	removed_at: null,
})
const earlier = new Date("2026-01-02T03:04:05.000Z")

beforeEach(() => {
	crate = new FakeCrate()
	setCrateClientForTest(crate)
	tracking = new FakeTracking()
	setScoreWatchTrackingForTest(tracking)
	crate.episodes = [
		episode(5001, 1, 1, "Winter Is Coming", "tt9000001"),
		episode(5002, 1, 2, "The Kingsroad"),
		episode(5003, 1, 3, "Lord Snow"),
	]
	crate.imdbEpisodes = [
		// Found by its stored ID alone.
		{
			show_id: SHOW,
			imdb_episode_id: "tt9000001",
			season_number: 1,
			episode_number: 1,
			name: "Winter Is Coming",
		},
		// Same unique title in the same season.
		{
			show_id: SHOW,
			imdb_episode_id: "tt9000002",
			season_number: 1,
			episode_number: 2,
			name: "The Kingsroad",
		},
		// Only the same number: IMDb's name is a placeholder, which proves nothing, and IMDb lists more episodes
		// in this season than TMDB, so numbers can't stand in for it.
		{
			show_id: SHOW,
			imdb_episode_id: "tt9000003",
			season_number: 1,
			episode_number: 3,
			name: "Episode #1.3",
		},
		{
			show_id: SHOW,
			imdb_episode_id: "tt9000007",
			season_number: 1,
			episode_number: 4,
			name: "Episode #1.4",
		},
		// Listed under two shows.
		{
			show_id: SHOW,
			imdb_episode_id: "tt9000005",
			season_number: 2,
			episode_number: 1,
			name: "Twice",
		},
		{
			show_id: 2000,
			imdb_episode_id: "tt9000005",
			season_number: 1,
			episode_number: 1,
			name: "Twice",
		},
	]
	crate.catalog = [
		{
			media_type: "show",
			tmdb_id: SHOW,
			title: "Synthetic Thrones",
			release_year: 2011,
			poster_path: "/thrones.jpg",
		},
	]
	// The member scored The Kingsroad 6 before the import.
	crate.episodeScores = [
		{
			user_id: USER,
			tmdb_id: SHOW,
			score_key: "e5002",
			scope: "episode",
			season_number: 1,
			episode_number: 2,
			episode_tmdb_id: 5002,
			ranges: null,
			label: null,
			score: 6,
			created_at: earlier,
			updated_at: earlier,
			_seq_no: 7,
			_primary_term: 1,
		},
	]
})
afterEach(() => {
	clearResultCacheForTest()
	setCrateClientForTest(null)
	setScoreWatchTrackingForTest()
})

const csv = (rows: string[]) =>
	["Const,Your Rating,Date Rated,Title,Title Type,Year", ...rows].join("\n")
const file = csv([
	"tt9000001,9,2021-01-02,Winter Is Coming,TV Episode,2011",
	"tt9000002,8,2021-01-02,The Kingsroad,TV Episode,2011",
	"tt9000003,7,2021-01-02,Lord Snow,TV Episode,2011",
	"tt9000004,6,2021-01-02,Nowhere,TV Episode,2011",
	"tt9000005,5,2021-01-02,Twice,TV Episode,2012",
	"tt0114709,7,2021-01-02,Synthetic movie,Movie,1995",
])

async function finished(id: string) {
	for (let i = 0; i < 200; i++) {
		const row = await getImportRow(USER, id)
		if (row.status !== "running") return row
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail("The import didn't finish.")
}

test("an IMDb ratings preview matches episodes by stored ID or same-season title, and not by number when the seasons differ in size", async () => {
	const preview = await createPreview(USER, "ratings.csv", file)
	assert.equal(preview.counts.rows, 6)
	assert.equal(preview.counts.episodes, 2)
	const items = (await listItems(USER, preview.id, undefined, 0, 50)).items
	assert.deepEqual(
		items.map((x) => [
			x.imdbId,
			x.outcome,
			x.tmdbId,
			x.mediaType,
			x.episode,
			x.currentScore,
		]),
		[
			["tt9000001", "new", SHOW, "show", { season: 1, number: 1 }, null],
			["tt9000002", "conflict", SHOW, "show", { season: 1, number: 2 }, 6],
			["tt9000003", "unmatched", null, null, null, null],
			["tt9000004", "unmatched", null, null, null, null],
			["tt9000005", "unmatched", null, null, null, null],
			["tt0114709", "unmatched", null, null, null, null],
		],
	)
	assert.match(items[1].reason ?? "", /You scored this episode 6 in GoodWatch/)
	assert.match(items[2].reason ?? "", /IMDb numbers or names it differently/)
	assert.match(items[3].reason ?? "", /isn't in GoodWatch's episode lists/)
	assert.match(items[4].reason ?? "", /more than one GoodWatch episode/)
	// The episodes went nowhere near the member's title ratings.
	assert.equal(crate.userScores.length, 0)
	assert.equal(crate.episodeScores.length, 1)
})

test("an IMDb ratings preview falls back to episode numbers when IMDb and TMDB list the same episodes for the season", async () => {
	const imdb = (
		imdb_episode_id: string,
		season_number: number,
		episode_number: number | null,
		name: string,
	) => ({ show_id: SHOW, imdb_episode_id, season_number, episode_number, name })
	crate.episodes.push(
		// Season 3: three episodes on both sides, numbered 1 to 3.
		episode(5301, 3, 1, "Arrival"),
		episode(5302, 3, 2, "Monster"),
		episode(5303, 3, 3, "Departure", "tt8888888"),
		// Season 4: two on both sides, but IMDb numbers them from 0.
		episode(5401, 4, 1, "Start"),
		episode(5402, 4, 2, "End"),
		// Season 5: a title match says IMDb's first episode is TMDB's second.
		episode(5501, 5, 1, "Alpha"),
		episode(5502, 5, 2, "Beta"),
		// Specials: the same count, but specials are never matched by number.
		episode(5090, 0, 1, "Behind the scenes"),
	)
	crate.imdbEpisodes.push(
		imdb("tt9000031", 3, 1, "Episode #3.1"),
		imdb("tt9000032", 3, 2, "Kaiju"),
		// TMDB stores another IMDb ID for its third episode: not this one.
		imdb("tt9000033", 3, 3, "Episode #3.3"),
		imdb("tt9000040", 4, 0, "Episode #4.0"),
		imdb("tt9000041", 4, 1, "Episode #4.1"),
		imdb("tt9000051", 5, 1, "Beta"),
		imdb("tt9000052", 5, 2, "Episode #5.2"),
		imdb("tt9000090", 0, 1, "Episode #0.1"),
	)
	const preview = await createPreview(
		USER,
		"ratings.csv",
		csv([
			"tt9000031,7,2021-01-02,Arrival,TV Episode,2013",
			"tt9000032,8,2021-01-02,Kaiju,TV Episode,2013",
			"tt9000033,6,2021-01-02,Departure,TV Episode,2013",
			"tt9000041,5,2021-01-02,Start,TV Episode,2014",
			"tt9000051,9,2021-01-02,Beta,TV Episode,2015",
			"tt9000052,4,2021-01-02,Alpha,TV Episode,2015",
			"tt9000090,3,2021-01-02,Behind the scenes,TV Episode,2015",
		]),
	)
	const items = (await listItems(USER, preview.id, undefined, 0, 50)).items
	assert.deepEqual(
		items.map((x) => [x.imdbId, x.outcome, x.episode]),
		[
			["tt9000031", "new", { season: 3, number: 1 }],
			["tt9000032", "new", { season: 3, number: 2 }],
			["tt9000033", "unmatched", null],
			["tt9000041", "unmatched", null],
			// Matched by its title, not by its number.
			["tt9000051", "new", { season: 5, number: 2 }],
			["tt9000052", "unmatched", null],
			["tt9000090", "unmatched", null],
		],
	)
	for (const row of items.filter((x) => x.outcome === "unmatched"))
		assert.match(row.reason ?? "", /IMDb numbers or names it differently/)
})

test("IMDb episode rows that still can't be matched are listed in the skipped rows file", async () => {
	const { skippedCsv } = await import("./store.server.ts")
	const preview = await createPreview(USER, "ratings.csv", file)
	await confirmImport(USER, preview.id, "imdb")
	await finished(preview.id)
	const lines = (await skippedCsv(USER, preview.id)).trim().split("\r\n")
	assert.deepEqual(
		lines.map((line) => line.split(",").slice(0, 5).join(",")),
		[
			"Const,Title,Year,Title Type,Your Rating",
			"tt9000003,Lord Snow,2011,TV Episode,7",
			"tt9000004,Nowhere,2011,TV Episode,6",
			"tt9000005,Twice,2012,TV Episode,5",
			"tt0114709,Synthetic movie,1995,Movie,7",
		],
	)
	assert.match(lines[1], /IMDb numbers or names it differently/)
	assert.match(lines[2], /isn't in GoodWatch's episode lists/)
})

test("Confirm writes episode scores, never title ratings, and Undo puts back the member's score and leaves one they changed", async () => {
	const preview = await createPreview(USER, "ratings.csv", file)
	await confirmImport(USER, preview.id, "imdb")
	const row = await finished(preview.id)
	assert.equal(row.status, "done")
	assert.deepEqual(
		[row.added, row.updated, row.kept, row.failed].map(Number),
		[1, 1, 0, 0],
	)
	assert.deepEqual(
		crate.episodeScores
			.map((x) => [
				x.score_key,
				x.scope,
				x.season_number,
				x.episode_number,
				x.episode_tmdb_id,
				x.score,
			])
			.sort(),
		[
			["e5001", "episode", 1, 1, 5001, 9],
			["e5002", "episode", 1, 2, 5002, 8],
		],
	)
	// Kept its first-given time.
	assert.equal(
		new Date(
			String(
				crate.episodeScores.find((x) => x.score_key === "e5002")?.created_at,
			),
		).toISOString(),
		earlier.toISOString(),
	)
	assert.equal(crate.userScores.length, 0)
	assert.ok(
		!crate.statements.some(
			(s) =>
				/user_score\b/.test(s) &&
				!s.startsWith("SELECT") &&
				!s.startsWith("REFRESH"),
		),
	)

	const result = await imdbImportResult(USER, preview.id)
	const added = result.sections.find((s) => s.key === "episode_ratings_added")
	assert.equal(added?.count, 2)
	assert.deepEqual(
		added?.rows.map((r) => [r.title?.title, r.title?.posterPath, r.changes]),
		[
			[
				"Synthetic Thrones",
				"/thrones.jpg",
				[
					{ type: "episode-rating-added", part: "S1 E1", score: 9, from: null },
					{ type: "episode-rating-added", part: "S1 E2", score: 8, from: 6 },
				],
			],
		],
	)
	assert.deepEqual(
		result.sections.find((s) => s.key === "skipped")?.rows[0].changes[0],
		{
			type: "skipped",
			kind: "episode_rating",
			label: "Lord Snow (2011)",
			row: 3,
			reason:
				"GoodWatch couldn't tell which episode this is: IMDb numbers or names it differently from the episode list.",
		},
	)

	// The member changes Winter Is Coming after the import.
	Object.assign(
		crate.episodeScores.find((x) => x.score_key === "e5001") ?? {},
		{
			score: 3,
			updated_at: new Date("2030-01-01T00:00:00Z"),
			_seq_no: 999,
		},
	)
	clearResultCacheForTest()
	await undoImport(USER, preview.id)
	assert.deepEqual(
		crate.episodeScores.map((x) => [x.score_key, x.score]).sort(),
		[
			["e5001", 3],
			["e5002", 6],
		],
	)
	const back = crate.episodeScores.find((x) => x.score_key === "e5002")
	assert.equal(
		new Date(String(back?.updated_at)).toISOString(),
		earlier.toISOString(),
	)
	const undone = await imdbImportResult(USER, preview.id)
	assert.equal(undone.operation, "undo")
	assert.deepEqual(
		undone.sections.map((s) => [s.key, s.rows.flatMap((r) => r.changes)]),
		[
			[
				"episode_ratings_removed",
				[
					{
						type: "episode-rating-removed",
						part: "S1 E2",
						score: 8,
						restored: 6,
					},
				],
			],
			["left", [{ type: "left", kind: "episode_rating" }]],
		],
	)
})

test("Confirm marks the episodes it scored watched where no pass has a watch, and Undo takes back only those watches", async () => {
	// The member had watched The Kingsroad.
	tracking.watched.add(5002)
	const preview = await createPreview(USER, "ratings.csv", file)
	await confirmImport(USER, preview.id, "imdb")
	assert.equal((await finished(preview.id)).status, "done")
	// One plan for the show: imported, undated, only for unwatched episodes, and Undo puts back what it cleared.
	assert.deepEqual(tracking.asked, [
		{
			userId: USER,
			importId: preview.id,
			source: "imdb",
			tmdbId: SHOW,
			mediaType: "show",
			watchDates: "unknown",
			onlyUnwatched: true,
			restoreIntentions: true,
		},
	])
	assert.deepEqual([...tracking.watched].sort(), [5001, 5002])
	// Run again, as a resumed import would: the journaled plan isn't made or applied twice.
	const { markImportedEpisodesWatched } = await import(
		"../imports/episode-score-watches.server.ts"
	)
	const rows = crate.items
		.filter((x) => x.kind === "episode_rating" && x.tmdb_id != null)
		.map((x) => ({
			...(JSON.parse(String(x.payload)) as object),
			kind: "episode_rating" as const,
			index: Number(x.row_index),
			key: `imdb:episode:${x.row_index}`,
			tmdbId: Number(x.tmdb_id),
			payload: JSON.parse(String(x.payload)) as Record<string, unknown>,
			applied: ["added", "updated"].includes(String(x.apply_state)),
		}))
	await markImportedEpisodesWatched(USER, preview.id, "imdb", rows as never)
	assert.equal(tracking.asked.length, 1)

	await undoImport(USER, preview.id)
	assert.deepEqual(tracking.undone, [`i-episode-score:${SHOW}:5001`])
	assert.deepEqual([...tracking.watched], [5002])
	assert.equal(tracking.restored, 1)
	// Undone once: a second Undo takes nothing more.
	await undoImport(USER, preview.id).catch(() => null)
	assert.deepEqual(tracking.undone, [`i-episode-score:${SHOW}:5001`])
})

test("keeping GoodWatch's ratings keeps the member's episode score, and a re-import updates only what the last import wrote", async () => {
	const first = await createPreview(USER, "ratings.csv", file)
	await confirmImport(USER, first.id, "keep")
	await finished(first.id)
	assert.deepEqual(
		crate.episodeScores.map((x) => [x.score_key, x.score]).sort(),
		[
			["e5001", 9],
			["e5002", 6],
		],
	)
	const again = await createPreview(
		USER,
		"ratings.csv",
		csv([
			"tt9000001,10,2021-01-02,Winter Is Coming,TV Episode,2011",
			"tt9000002,8,2021-01-02,The Kingsroad,TV Episode,2011",
		]),
	)
	const items = (await listItems(USER, again.id, undefined, 0, 50)).items
	assert.deepEqual(
		items.map((x) => [x.imdbId, x.outcome, x.currentScore]),
		[
			// Changed on IMDb, untouched in GoodWatch since the last import.
			["tt9000001", "update", 9],
			["tt9000002", "conflict", 6],
		],
	)
	await confirmImport(USER, again.id, "keep")
	const row = await finished(again.id)
	assert.deepEqual([row.added, row.updated, row.kept].map(Number), [0, 1, 1])
	assert.equal(
		crate.episodeScores.find((x) => x.score_key === "e5001")?.score,
		10,
	)
})

test("before the episode score table exists, episode rows wait and the rest of the file still imports", async () => {
	crate.missingEpisodeScores = true
	const preview = await createPreview(USER, "ratings.csv", file)
	const items = (await listItems(USER, preview.id, undefined, 0, 50)).items
	assert.deepEqual(
		items.slice(0, 5).map((x) => [x.outcome, x.reason]),
		Array.from({ length: 5 }, () => [
			"unsupported",
			"GoodWatch can't save season and episode scores yet. Import this file again later to bring them in.",
		]),
	)
	// No episode was looked up.
	assert.ok(
		!crate.statements.some((s) => /FROM (imdb_episode|episode) /.test(s)),
	)
	assert.equal(preview.counts.episodes, undefined)
})

test("the same episode twice keeps the first row, and twice with different ratings imports neither", async () => {
	const { classifyRows } = await import("./classify.server.ts")
	const { readRatingsFile } = await import("./file.server.ts")
	const match = { showId: SHOW, episodeTmdbId: 5001, season: 1, number: 1 }
	const classify = (ratings: number[]) =>
		classifyRows(
			readRatingsFile(
				csv(
					ratings.map(
						(r) => `tt9000001,${r},2021-01-02,Winter Is Coming,TV Episode,2011`,
					),
				),
			),
			{
				catalog: new Map(),
				scores: new Map(),
				lastApplied: new Map(),
				episodes: new Map([["tt9000001", match]]),
				episodeScores: new Map(),
				lastAppliedEpisodes: new Map(),
			},
		).map((row) => row.outcome)
	assert.deepEqual(classify([9, 9]), ["new", "invalid"])
	assert.deepEqual(classify([9, 7]), ["invalid", "invalid"])
	// A title rating for the show itself is a separate thing from its episode's score.
	const both = classifyRows(
		readRatingsFile(
			csv([
				"tt9000001,9,2021-01-02,Winter Is Coming,TV Episode,2011",
				"tt0944947,7,2021-01-02,Synthetic Thrones,TV Series,2011",
			]),
		),
		{
			catalog: new Map([["show:tt0944947", [SHOW]]]),
			scores: new Map(),
			lastApplied: new Map(),
			episodes: new Map([["tt9000001", match]]),
			episodeScores: new Map(),
			lastAppliedEpisodes: new Map(),
		},
	)
	assert.deepEqual(
		both.map((row) => [row.outcome, row.tmdbId, !!row.matchedEpisode]),
		[
			["new", SHOW, true],
			["new", SHOW, false],
		],
	)
})
