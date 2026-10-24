// Two webapp instances share one import row. Each `?process=` import below is a separate copy of the import's
// modules, with its own in-process state, over the same fake Crate.
import "./loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, beforeEach, mock, test } from "node:test"
import { setCrateClientForTest } from "../../utils/crate.ts"

type Apply = typeof import("./apply.server.ts")
type Store = typeof import("./store.server.ts")
const loadProcess = async (name: string) => ({
	...((await import(`./apply.server.ts?process=${name}`)) as Apply),
	...((await import(`./store.server.ts?process=${name}`)) as Store),
})
const a = await loadProcess("a")
const b = await loadProcess("b")

const USER = "member-1"
const IMPORT = "5b0c8f0e-7d0a-4c53-9f6b-0d1f1f6a2a10"

/**
 * Enough of Crate for one import with one new rating. Its clock is the test's clock.
 *
 * The import's row is kept twice, as CrateDB 5.10.9 was seen to behave (issue 313): `row` is the live row, which a
 * read or a write by the key alone works on, and `searchable` is the row as of the last REFRESH, which is all that a
 * filter on another column sees. An update with such a filter is matched against `searchable` and then written to
 * `row`, whatever `row` holds by then. Every write that lands gives the row the next `_seq_no`, and a write that
 * names `_seq_no` and `_primary_term` lands only while the live row still has them.
 * Not modelled: Crate also refreshes by itself about once a second. Here only REFRESH does.
 */
class FakeCrate {
	row: Record<string, unknown> = {}
	searchable: Record<string, unknown> = {}
	/** How often the import was set to running, which is how often an apply was started. */
	starts = 0
	itemState: string | null = null
	score: { score: number; updated_at: Date } | null = null
	scoreWrites = 0
	/** Set to hold the write to user_score, which is what makes a batch slow. */
	slowWrite: Promise<void> | null = null

	async execute(
		sql: string,
		params: unknown[] = [],
	): Promise<{ json: unknown[]; rowcount?: number }> {
		const statement = sql.trim().replace(/\s+/g, " ")
		if (statement === "REFRESH TABLE doc.user_import") this.refresh()
		if (statement.startsWith("REFRESH")) return { json: [] }
		if (/^SELECT .* FROM doc\.user_import WHERE id = \?$/.test(statement))
			return {
				json:
					this.row.id === params[0]
						? [{ ...this.row, read_at: Date.now() }]
						: [],
			}
		if (/^SELECT .* FROM doc\.user_import WHERE user_id = \?/.test(statement))
			return {
				json:
					this.searchable.status === params[1]
						? [{ ...this.searchable, read_at: Date.now() }]
						: [],
			}
		if (statement.startsWith("UPDATE doc.user_import SET "))
			return this.updateImport(statement, [...params])

		// The file has no episode rows (#759).
		if (
			statement.startsWith("SELECT row_index") &&
			statement.includes("kind = 'episode_rating'")
		)
			return { json: [] }
		if (statement.startsWith("SELECT row_index")) {
			const pending = this.itemState === null || this.itemState === "failed"
			return {
				json: pending
					? [
							{
								row_index: 0,
								tmdb_id: 603,
								media_type: "movie",
								imdb_score: 9,
								current_score: null,
							},
						]
					: [],
			}
		}
		if (statement.startsWith("SELECT apply_state"))
			return {
				json:
					this.itemState === null
						? []
						: [{ apply_state: this.itemState, n: 1 }],
			}
		if (
			statement.startsWith("UPDATE doc.user_import_item SET apply_state = ?")
		) {
			this.itemState = params[0] as string
			return { json: [], rowcount: 1 }
		}
		if (statement.startsWith("UPDATE doc.user_import_item"))
			return { json: [], rowcount: 0 }

		if (statement.startsWith("INSERT INTO user_score")) {
			this.scoreWrites++
			await this.slowWrite
			this.score ??= {
				score: params[3] as number,
				updated_at: params[5] as Date,
			}
			return { json: [], rowcount: 1 }
		}
		if (
			statement.startsWith("SELECT tmdb_id, score, updated_at FROM user_score")
		)
			return { json: this.score ? [{ tmdb_id: 603, ...this.score }] : [] }
		throw new Error(`The fake Crate doesn't know this statement: ${statement}`)
	}

	refresh() {
		this.searchable = { ...this.row }
	}

	/** `SET column = ?|CURRENT_TIMESTAMP|NULL|'text', ... WHERE column = ? AND ...`, with every condition on the one row. */
	private updateImport(statement: string, params: unknown[]) {
		const [, set, where] =
			statement.match(/^UPDATE doc\.user_import SET (.*) WHERE (.*)$/) ?? []
		const value = (text: string) => {
			if (text === "?") return params.shift()
			if (text === "CURRENT_TIMESTAMP") return Date.now()
			return text === "NULL" ? null : text.replace(/^'|'$/g, "")
		}
		const changes = set.split(", ").map((part) => part.split(" = "))
		const next = Object.fromEntries(
			changes.map(([column, text]) => [column, value(text)]),
		)
		const same = (stored: unknown, wanted: unknown) =>
			stored instanceof Date || wanted instanceof Date
				? new Date(stored as Date).getTime() ===
					new Date(wanted as Date).getTime()
				: stored === wanted
		const conditions = where.split(" AND ").map((part) => part.split(" = "))
		const columns = conditions.map(([column]) => column).join(" ")
		const versioned = /_seq_no|_primary_term/.test(columns)
		if (versioned && columns !== "id _seq_no _primary_term")
			throw new Error(
				'VersioningValidationException["_seq_no" and "_primary_term" columns can only be used together in the WHERE clause with equals comparisons and if there are also equals comparisons on primary key columns]',
			)
		const byKey = versioned || columns === "id"
		const seen = byKey ? this.row : this.searchable
		const matches = conditions.every(([column, text]) =>
			same(seen[column], value(text)),
		)
		if (!matches) return { json: [], rowcount: 0 }
		if (next.status === "running") this.starts++
		Object.assign(this.row, next, { _seq_no: Number(this.row._seq_no) + 1 })
		return { json: [], rowcount: 1 }
	}
}

let crate: FakeCrate

function seed(status: "preview" | "running" | "failed") {
	const now = new Date()
	crate.row = {
		id: IMPORT,
		user_id: USER,
		status,
		file_name: "ratings.csv",
		conflict_choice: status === "preview" ? null : "keep",
		counts: JSON.stringify({
			rows: 1,
			new: 1,
			update: 0,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		}),
		processed: 0,
		total: status === "preview" ? 0 : 1,
		added: 0,
		updated: 0,
		kept: 0,
		failed: 0,
		without_fingerprint: null,
		error:
			status === "failed" ? "The import stopped before it finished." : null,
		created_at: now,
		updated_at: now,
		confirmed_at: status === "preview" ? null : now,
		finished_at: null,
		_seq_no: 7,
		_primary_term: 1,
	}
	crate.refresh()
}

/** Lets the background apply run until `done` holds. The apply only waits on the fake, so a few turns are enough. */
async function until(done: () => boolean) {
	for (let turn = 0; turn < 1000 && !done(); turn++)
		await new Promise((resolve) => setImmediate(resolve))
	assert.ok(done(), "the import didn't get there")
}

/** Moves the clock forward in steps, letting the writes of each step land before the next. */
async function pass(ms: number) {
	for (let passed = 0; passed < ms; passed += 1000) {
		mock.timers.tick(1000)
		for (let turn = 0; turn < 10; turn++)
			await new Promise((resolve) => setImmediate(resolve))
	}
}

beforeEach(() => {
	mock.timers.enable({
		apis: ["Date", "setInterval", "setTimeout"],
		now: new Date("2026-10-06T12:00:00Z"),
	})
	crate = new FakeCrate()
	setCrateClientForTest(crate)
	mock.method(console, "log", () => {})
})
afterEach(() => {
	setCrateClientForTest(null)
	mock.restoreAll()
	mock.timers.reset()
})

test("the other process doesn't offer a resume while a batch runs longer than the stall time", async () => {
	seed("preview")
	let finishWrite = () => {}
	crate.slowWrite = new Promise((resolve) => {
		finishWrite = resolve
	})

	assert.equal((await a.confirmImport(USER, IMPORT, "keep")).status, "running")
	await until(() => crate.scoreWrites === 1)
	await pass(a.STALL_MS + 5000)

	const seenByOther = b.summarize(await b.getImportRow(USER, IMPORT))
	assert.equal(seenByOther.status, "running")
	assert.equal(
		seenByOther.stalled,
		false,
		"the other process takes the live run for a stalled one",
	)

	// Confirming is what the Resume button does. Neither process may start a second apply next to the live one.
	assert.equal((await b.confirmImport(USER, IMPORT, "keep")).stalled, false)
	assert.equal((await a.confirmImport(USER, IMPORT, "keep")).stalled, false)
	await pass(1000)
	assert.equal(
		crate.scoreWrites,
		1,
		"a second apply started next to the live one",
	)

	finishWrite()
	await until(() => crate.row.status !== "running")
	assert.equal(crate.row.status, "done")
	assert.equal(crate.row.added, 1)
	assert.equal(crate.scoreWrites, 1)
})

test("an import whose process died can be resumed by the other process once the stall time has passed", async () => {
	// What a killed process leaves behind: a running import that nothing reports on any more.
	seed("running")

	await pass(b.STALL_MS - 5000)
	assert.equal(b.summarize(await b.getImportRow(USER, IMPORT)).stalled, false)

	await pass(10_000)
	assert.equal(b.summarize(await b.getImportRow(USER, IMPORT)).stalled, true)

	const resumed = await b.confirmImport(USER, IMPORT, "keep")
	assert.equal(resumed.status, "running")
	assert.equal(resumed.stalled, false)
	await until(() => crate.row.status !== "running")
	assert.equal(crate.row.status, "done")
	assert.equal(crate.row.added, 1)
})

test("a finished import stops reporting, so a late look doesn't find it running", async () => {
	seed("preview")
	await a.confirmImport(USER, IMPORT, "keep")
	await until(() => crate.row.status === "done")
	const finishedAt = crate.row.updated_at

	await pass(a.STALL_MS)
	assert.equal(crate.row.status, "done")
	assert.deepEqual(crate.row.updated_at, finishedAt)
})

// On CrateDB 5.10.9 two claims that filtered on the status both reported one row, 40 times out of 40, as long as no
// refresh came between them (issue 313). The claim goes by the row's version instead.
for (const [situation, status] of [
	["a preview", "preview"],
	["a failed import", "failed"],
	["an import whose process died", "running"],
] as const)
	test(`both processes confirm ${situation} at once and one apply starts`, async () => {
		seed(status)
		let finishWrite = () => {}
		crate.slowWrite = new Promise((resolve) => {
			finishWrite = resolve
		})
		if (status === "running") await pass(a.STALL_MS + 5000)

		const answers = await Promise.all([
			a.confirmImport(USER, IMPORT, "keep"),
			b.confirmImport(USER, IMPORT, "keep"),
		])
		assert.deepEqual(
			answers.map((answer) => [answer.status, answer.stalled]),
			[
				["running", false],
				["running", false],
			],
			"both members' requests see the import running",
		)
		await until(() => crate.scoreWrites >= 1)
		await pass(1000)
		assert.equal(crate.starts, 1, "both requests won the claim")
		assert.equal(crate.scoreWrites, 1, "two applies run side by side")

		finishWrite()
		await until(() => crate.row.status !== "running")
		assert.equal(crate.row.status, "done")
		assert.equal(crate.row.added, 1)
		assert.equal(crate.scoreWrites, 1)
	})

test("a claim loses to a write that reached the import after it was read, and the next one wins", async () => {
	seed("failed")
	const read = await a.getImportRow(USER, IMPORT)
	// A heartbeat that timed out and landed late, which is the only write a failed import can still get.
	await crate.execute(
		"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		[IMPORT],
	)
	assert.equal(await a.claimImport(read, "status = 'running'", []), false)
	assert.equal(crate.row.status, "failed")

	const resumed = await b.confirmImport(USER, IMPORT, "keep")
	assert.equal(resumed.status, "running")
	await until(() => crate.row.status !== "running")
	assert.equal(crate.row.status, "done")
})

/** Conflict fixtures retain every row so per-title decisions can leave their neighbours waiting. */
class QuestionCrate extends FakeCrate {
	items: Record<string, unknown>[] = []
	failWrites = false
	otherRunning = false
	onFinish: (() => Promise<void>) | null = null
	async execute(
		sql: string,
		params: unknown[] = [],
	): Promise<{ json: unknown[]; rowcount?: number }> {
		const s = sql.trim().replace(/\s+/g, " ")
		if (
			s.startsWith("UPDATE doc.user_import SET status = ?, error = ?") &&
			this.onFinish
		) {
			const hook = this.onFinish
			this.onFinish = null
			await hook()
		}
		if (s.includes("FROM doc.user_import WHERE user_id") && this.otherRunning)
			return {
				json: [
					{
						...this.row,
						id: "other",
						status: "running",
						updated_at: Date.now(),
						read_at: Date.now(),
					},
				],
			}
		if (s.includes("doc.user_import_item")) {
			if (s.startsWith("REFRESH")) return { json: [] }
			if (s.startsWith("SELECT apply_state")) {
				const tally = new Map<string, number>()
				for (const item of this.items)
					if (item.apply_state)
						tally.set(
							String(item.apply_state),
							(tally.get(String(item.apply_state)) ?? 0) + 1,
						)
				return {
					json: [...tally].map(([apply_state, n]) => ({ apply_state, n })),
				}
			}
			if (s.startsWith("SELECT count(*)"))
				return {
					json: [
						{
							n: this.items.filter(
								(i) =>
									i.outcome === "conflict" &&
									[
										"waiting:conflict",
										"approved:conflict",
										"added",
										"updated",
										"kept",
										"failed",
									].includes(String(i.apply_state)),
							).length,
						},
					],
				}

			if (s.startsWith("SELECT row_index, imdb_id"))
				return {
					json: this.items
						.filter((i) => i.apply_state === "waiting:conflict")
						.sort((a, b) => Number(a.row_index) - Number(b.row_index))
						.slice(Number(params[3]), Number(params[3]) + Number(params[2])),
				}
			if (s.startsWith("SELECT row_index FROM"))
				return {
					json: this.items
						.filter(
							(i) =>
								["new", "update", "conflict"].includes(String(i.outcome)) &&
								(i.apply_state === "approved:conflict" ||
									i.apply_state === null),
						)
						.slice(0, 1),
				}
			if (
				s.startsWith("SELECT row_index") &&
				s.includes("kind = 'episode_rating'")
			)
				return { json: [] }
			if (s.startsWith("SELECT row_index")) {
				if (s.includes("prior_score"))
					return {
						json: this.items.filter(
							(i) =>
								i.kind == null &&
								["added", "updated"].includes(String(i.apply_state)),
						),
					}
				const conflict = s.includes("'conflict'")
				return {
					json: this.items
						.filter(
							(i) =>
								i.kind == null &&
								(["new", "update"].includes(String(i.outcome)) ||
									(i.outcome === "conflict" && conflict)) &&
								(i.apply_state === null ||
									i.apply_state === "failed" ||
									(s.includes("approved:conflict") &&
										i.apply_state === "approved:conflict")),
						)
						.map((i) => ({ ...i })),
				}
			}
			if (s.startsWith("UPDATE doc.user_import_item SET payload")) {
				const cases = (s.match(/WHEN \? THEN \?/g) ?? []).length
				for (let index = 0; index < cases; index++) {
					const item = this.items.find((i) => i.row_index === params[index * 2])
					if (item) item.payload = params[index * 2 + 1]
				}
				return { json: [], rowcount: cases }
			}

			if (s.startsWith("UPDATE doc.user_import_item SET apply_state")) {
				const transition = s.includes("AND apply_state = 'waiting:conflict'")
				const hold = s.includes("outcome = 'conflict'")
				const cancel = s.includes(
					"IN ('waiting:conflict', 'approved:conflict')",
				)
				const undo = s.includes("SET apply_state = 'undone'")
				const reason = s.includes("reason = ?")
				const state = s.includes("SET apply_state = ?")
					? params[0]
					: undo
						? "undone"
						: hold && s.includes("waiting:conflict")
							? "waiting:conflict"
							: "kept"
				const indexes = transition
					? params.slice(reason ? 3 : 2)
					: params.slice(["added", "updated"].includes(String(state)) ? 3 : 2)
				let n = 0
				for (const i of this.items) {
					if (
						transition
							? i.apply_state !== "waiting:conflict" ||
								(indexes.length > 0 && !indexes.includes(i.row_index))
							: hold
								? i.outcome !== "conflict" || i.apply_state !== null
								: cancel
									? !["waiting:conflict", "approved:conflict"].includes(
											String(i.apply_state),
										)
									: undo
										? !["added", "updated"].includes(String(i.apply_state))
										: !indexes.includes(i.row_index)
					)
						continue
					i.apply_state = state
					if (reason) i.reason = params[1]
					if (["added", "updated"].includes(String(state))) {
						i.prior_score = i.current_score
						i.applied_score = i.imdb_score
					}
					n++
				}
				return { json: [], rowcount: n }
			}
		}
		if (s.startsWith("UPDATE user_score SET score")) {
			this.scoreWrites++
			await this.slowWrite
			if (!this.failWrites && this.score?.score === params[4])
				this.score = { score: Number(params[0]), updated_at: params[1] as Date }
			return { json: [], rowcount: this.failWrites ? 0 : 1 }
		}
		return super.execute(sql, params)
	}
}

function conflicts(n = 1) {
	const db = new QuestionCrate()
	crate = db
	setCrateClientForTest(db)
	seed("preview")
	db.row.counts = JSON.stringify({
		rows: n,
		new: 0,
		update: 0,
		conflict: n,
		unchanged: 0,
		invalid: 0,
		unmatched: 0,
		unsupported: 0,
	})
	db.items = Array.from({ length: n }, (_, row_index) => ({
		row_index,
		tmdb_id: 603,
		media_type: "movie",
		imdb_score: 9,
		current_score: 4,
		outcome: "conflict",
		apply_state: null,
		payload: null,
		reason: "The scores differ.",
	}))
	db.score = { score: 4, updated_at: new Date("2020-01-01") }
	db.refresh()
	return db
}
async function settled() {
	await until(
		() =>
			["done", "failed", "undone"].includes(String(crate.row.status)) &&
			!a.activeRuns.has(IMPORT) &&
			!b.activeRuns.has(IMPORT),
	)
}

test("legacy keep/imdb preserve ratings, totals, and omit questions and question options", async () => {
	for (const choice of ["keep", "imdb"] as const) {
		const db = conflicts()
		await a.confirmImport(USER, IMPORT, choice)
		await settled()
		assert.equal(
			db.items[0].apply_state,
			choice === "keep" ? "kept" : "updated",
		)
		assert.equal(db.score?.score, choice === "keep" ? 4 : 9)
		assert.equal(db.row.total, choice === "keep" ? 0 : 1)
		assert.equal(db.row.options, undefined)
		assert.equal(
			a.summarize(await a.getImportRow(USER, IMPORT)).questions,
			undefined,
		)
	}
})

test("ask holds before confirm returns; waiting counts in processed and total but not applied", async () => {
	const db = conflicts(3)
	const summary = await a.confirmImport(USER, IMPORT, "ask")
	assert.ok(db.items.every((i) => i.apply_state === "waiting:conflict"))
	assert.equal(summary.questions?.[0].waiting, 3)
	assert.equal(summary.processed, 3)
	await settled()
	assert.equal(db.scoreWrites, 0)
	assert.equal(db.row.total, 3)
	assert.equal(db.row.processed, 3)
	assert.equal(db.row.kept, 0)
})

for (const answer of ["keep", "imdb"] as const)
	for (const rows of [undefined, [1, 1]])
		test(`decide ${rows ? "rows" : "all"} ${answer} is durable and leaves other rows waiting`, async () => {
			const db = conflicts(3)
			await a.confirmImport(USER, IMPORT, "ask")
			await settled()
			const finish = db.row.finished_at
			const response = await b.decideImport(USER, IMPORT, answer, rows)
			assert.equal(response.decided, rows ? 1 : 3)
			await settled()
			assert.equal(
				db.items[1].apply_state,
				answer === "keep" ? "kept" : "updated",
			)
			assert.equal(
				db.items[0].apply_state,
				rows ? "waiting:conflict" : answer === "keep" ? "kept" : "updated",
			)
			if (answer === "keep")
				assert.equal(
					db.items[1].reason,
					"You chose to keep what GoodWatch has.",
				)
			assert.equal(db.score?.score, answer === "keep" ? 4 : 9)
			assert.equal(
				new Date(db.row.finished_at as Date).getTime(),
				new Date(finish as Date).getTime(),
			)
			assert.equal(
				JSON.parse(String(db.row.options)).answer,
				rows ? undefined : answer,
			)
			assert.equal(db.row.conflict_choice, rows ? "ask" : answer)
			assert.equal(
				(await b.decideImport(USER, IMPORT, answer, rows)).decided,
				0,
			)
		})

test("a decision racing finishing invalidates the CAS and is applied on the next pass", async () => {
	const db = conflicts()
	db.onFinish = async () => {
		await b.decideImport(USER, IMPORT, "imdb", [0])
	}
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	assert.equal(db.score?.score, 9)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.starts, 1)
	assert.equal(db.row.total, 1)
})

test("decide honors the other-running-import lock before changing anything", async () => {
	const db = conflicts()
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	db.otherRunning = true
	const before = structuredClone({ row: db.row, items: db.items })
	await assert.rejects(() => b.decideImport(USER, IMPORT, "imdb"), {
		status: 409,
		message:
			"Another import is still running. Wait for it to finish, then try again.",
	})
	assert.deepEqual({ row: db.row, items: db.items }, before)
	assert.equal(db.score?.score, 4)
	db.otherRunning = false
	await b.decideImport(USER, IMPORT, "imdb")
	await settled()
	assert.equal(db.score?.score, 9)
})

test("failed approved row keeps its per-row consent through resume", async () => {
	const db = conflicts(2)
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	db.failWrites = true
	await b.decideImport(USER, IMPORT, "imdb", [0])
	await settled()
	assert.equal(db.row.status, "failed")
	assert.equal(db.items[0].apply_state, "failed")
	assert.deepEqual(JSON.parse(String(db.items[0].payload))._answer, {
		conflict: "imdb",
	})
	db.failWrites = false
	await a.confirmImport(USER, IMPORT, "keep")
	await settled()
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.items[1].apply_state, "waiting:conflict")
	assert.equal(db.row.conflict_choice, "ask")
})

test("undo cancels waiting and approved rows and refuses later decisions", async () => {
	const db = conflicts(2)
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	db.items[1].apply_state = "approved:conflict"
	await a.undoImport(USER, IMPORT)
	assert.deepEqual(
		db.items.map((i) => i.apply_state),
		["kept", "kept"],
	)
	assert.equal(db.row.status, "undone")
	assert.equal(db.score?.score, 4)
	await assert.rejects(() => b.decideImport(USER, IMPORT, "imdb"), {
		status: 409,
	})
})

test("legacy resume gives a fresh finished_at", async () => {
	const db = conflicts()
	db.failWrites = true
	await a.confirmImport(USER, IMPORT, "imdb")
	await settled()
	assert.equal(db.row.status, "failed")
	db.row.finished_at = new Date(0)
	await pass(5000)
	db.failWrites = false
	await b.confirmImport(USER, IMPORT, "keep")
	await settled()
	assert.equal(db.row.status, "done")
	assert.ok(new Date(db.row.finished_at as Date).getTime() > 0)
})

test("decide validates rows and refuses preview, another owner, legacy imports and undo in progress", async () => {
	const db = conflicts()
	await assert.rejects(() => a.decideImport(USER, IMPORT, "keep"), {
		status: 409,
	})
	await assert.rejects(() => a.decideImport("stranger", IMPORT, "keep"), {
		status: 404,
	})
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	for (const rows of [[], [-1], [0.5], Array(501).fill(0)])
		await assert.rejects(() => a.decideImport(USER, IMPORT, "keep", rows), {
			status: 400,
		})
	db.row.options = JSON.stringify({ ask: true, direction: "undo" })
	await assert.rejects(() => b.decideImport(USER, IMPORT, "keep"), {
		status: 409,
	})
	db.row.options = null
	await assert.rejects(() => b.decideImport(USER, IMPORT, "keep"), {
		status: 400,
	})
})

test("stalled and failed question imports restart after approval", async () => {
	for (const status of ["running", "failed"]) {
		const db = conflicts()
		await a.confirmImport(USER, IMPORT, "ask")
		await settled()
		db.row.status = status
		db.row.updated_at = new Date(0)
		await b.decideImport(USER, IMPORT, "imdb", [0])
		await settled()
		assert.equal(db.items[0].apply_state, "updated")
	}
})

test("whole answer racing confirm hold is repaired", async () => {
	const db = conflicts()
	const execute = db.execute.bind(db)
	let raced = false
	db.execute = async (sql, params) => {
		if (!raced && sql.includes("SET apply_state = 'waiting:conflict'")) {
			raced = true
			await b.decideImport(USER, IMPORT, "imdb")
		}
		return execute(sql, params)
	}
	setCrateClientForTest(db)
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(
		(await a.getImportRow(USER, IMPORT)).questions?.[0].answer,
		"imdb",
	)
})

test("finishing drains an outstanding heartbeat before reading the finishing version", async () => {
	const db = conflicts()
	const execute = db.execute.bind(db)
	let release!: () => void
	const heartbeat = new Promise<void>((resolve) => {
		release = resolve
	})
	let started = false
	let ticked = false
	db.execute = async (sql, params) => {
		if (
			sql ===
			"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
		) {
			started = true
			await heartbeat
		}
		if (
			!ticked &&
			a.activeRuns.has(IMPORT) &&
			sql.startsWith("SELECT apply_state")
		) {
			ticked = true
			mock.timers.tick(a.HEARTBEAT_MS)
		}
		return execute(sql, params)
	}
	setCrateClientForTest(db)
	await a.confirmImport(USER, IMPORT, "ask")
	await until(() => started)
	assert.equal(db.row.status, "running")
	release()
	await settled()
	assert.equal(db.row.status, "done")
})

test("HTTP decide is strict, authenticated and owned; waiting items are ordered, paged and private", async () => {
	const db = conflicts(3)
	const { action } = await import("../../routes/api.imdb-import.$id.decide.ts")
	const { loader } = await import("../../routes/api.imdb-import.$id.items.ts")
	const send = (body: unknown, member: string | null = USER, method = "POST") =>
		action({
			request: new Request(
				`https://example.test/api/imdb-import/${IMPORT}/decide`,
				{
					method,
					headers: member ? { "x-fixture-member": member } : {},
					...(method === "POST" ? { body: JSON.stringify(body) } : {}),
				},
			),
			params: { id: IMPORT },
			context: {},
		})
	assert.equal((await send({ answer: "keep" }, null)).status, 401)
	assert.equal((await send({ answer: "keep" }, "stranger")).status, 404)
	assert.equal((await send({ answer: "keep" })).status, 409)
	assert.equal((await send({}, USER, "GET")).status, 405)
	for (const body of [
		{ answer: "source" },
		{ answer: "imdb", rows: [] },
		{ answer: "keep", extra: true },
		{ answer: "keep", rows: Array(501).fill(0) },
	])
		assert.equal((await send(body)).status, 400)
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	const response = await loader({
		request: new Request(
			`https://example.test/api/imdb-import/${IMPORT}/items?waiting=conflict&offset=1&limit=1`,
			{ headers: { "x-fixture-member": USER } },
		),
		params: { id: IMPORT },
		context: {},
	})
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const body = await response.json()
	assert.equal(body.total, 3)
	assert.deepEqual(
		body.items.map((i: { index: number }) => i.index),
		[1],
	)
	assert.equal(body.items[0].payload, undefined)
	const decision = await send({ answer: "keep", rows: [1] })
	assert.equal(decision.status, 200)
	assert.equal((await decision.json()).decided, 1)
	assert.equal(db.items[1].apply_state, "kept")
})

test("answer CAS retries; concurrent restart claims start one runner", async () => {
	const db = conflicts()
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	const execute = db.execute.bind(db)
	let attempts = 0
	db.execute = async (sql, params) => {
		if (
			sql.startsWith("UPDATE doc.user_import SET options =") &&
			++attempts === 1
		)
			return { json: [], rowcount: 0 }
		return execute(sql, params)
	}
	setCrateClientForTest(db)
	await Promise.all([
		a.decideImport(USER, IMPORT, "imdb"),
		b.decideImport(USER, IMPORT, "imdb"),
	])
	await settled()
	assert.ok(attempts >= 3)
	assert.equal(db.starts, 2) // Confirm and one restart.
	assert.equal(db.scoreWrites, 1)
})

test("undo cancels an approval that races its first cancellation", async () => {
	const db = conflicts()
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	const execute = db.execute.bind(db)
	let cancels = 0
	db.execute = async (sql, params) => {
		const result = await execute(sql, params)
		if (
			sql.includes(
				"apply_state IN ('waiting:conflict', 'approved:conflict')",
			) &&
			++cancels === 1
		)
			db.items[0].apply_state = "approved:conflict"
		return result
	}
	setCrateClientForTest(db)
	await a.undoImport(USER, IMPORT)
	assert.equal(cancels, 2)
	assert.equal(db.items[0].apply_state, "kept")
})

test("question answers and completion have deterministic analytics UUIDs across restarts", async () => {
	const db = conflicts()
	const { setAnalyticsFetch, flushProductEvents } = await import(
		"../../telemetry/product-analytics.server.ts"
	)
	const saved = {
		NODE_ENV: process.env.NODE_ENV,
		POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
		POSTHOG_DISABLED: process.env.POSTHOG_DISABLED,
	}
	const events: { event: string; uuid: string }[] = []
	setAnalyticsFetch(async (_url, init) => {
		events.push(...JSON.parse(String(init?.body)).batch)
		return new Response("{}", { status: 200 })
	})
	process.env.NODE_ENV = "production"
	process.env.POSTHOG_API_KEY = "fixture"
	process.env.POSTHOG_DISABLED = "false"
	try {
		await a.confirmImport(USER, IMPORT, "ask")
		await settled()
		await pass(5000)
		await b.decideImport(USER, IMPORT, "imdb", [0])
		await settled()
		await b.decideImport(USER, IMPORT, "imdb", [0])
		await flushProductEvents()
		const answers = events.filter((e) => e.event === "import question answered")
		assert.equal(answers.length, 2)
		assert.equal(answers[0].uuid, answers[1].uuid)
		const completions = events.filter((e) => e.event === "import completed")
		assert.equal(completions.length, 2)
		assert.equal(completions[0].uuid, completions[1].uuid)
		assert.equal(db.score?.score, 9)
	} finally {
		setAnalyticsFetch(null)
		for (const [key, value] of Object.entries(saved)) {
			if (value === undefined) Reflect.deleteProperty(process.env, key)
			else process.env[key] = value
		}
	}
})

for (const answer of [undefined, "keep", "imdb"] as const)
	test(`mixed new/conflict progress stays bounded and completes with ${answer ?? "waiting rows"}`, async () => {
		const db = conflicts(2)
		db.items.push({
			...db.items[0],
			row_index: 2,
			outcome: "new",
			current_score: null,
			imdb_score: 4,
		})
		db.row.counts = JSON.stringify({
			...JSON.parse(String(db.row.counts)),
			rows: 3,
			new: 1,
		})
		const execute = db.execute.bind(db)
		let reports = 0
		db.execute = async (sql, params) => {
			const result = await execute(sql, params)
			if (
				sql.startsWith("UPDATE doc.user_import SET") &&
				sql.includes("processed =")
			) {
				reports++
				assert.ok(
					Number(db.row.processed) <= Number(db.row.total),
					`${db.row.processed}/${db.row.total}`,
				)
				if (db.row.status === "done")
					assert.equal(db.row.processed, db.row.total)
			}
			return result
		}
		setCrateClientForTest(db)
		await a.confirmImport(USER, IMPORT, "ask")
		await settled()
		assert.equal(db.row.total, 3)
		assert.equal(db.row.processed, 3)
		if (answer) {
			await b.decideImport(USER, IMPORT, answer)
			await settled()
		}
		assert.ok(reports >= 3)
		assert.equal(db.row.status, "done")
		assert.equal(db.row.processed, db.row.total)
		assert.equal(
			db.items.filter((i) => i.apply_state === "waiting:conflict").length,
			answer ? 0 : 2,
		)
	})

test("two decisions read a stalled import; the late decision cannot reclaim the fresh runner", async () => {
	const db = conflicts(2)
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	db.row.status = "running"
	db.row.updated_at = new Date(0)
	const execute = db.execute.bind(db)
	let releaseRead!: () => void
	let readStalled = false
	const heldRead = new Promise<void>((resolve) => {
		releaseRead = resolve
	})
	db.execute = async (sql, params) => {
		const result = await execute(sql, params)
		if (!readStalled && sql.includes("FROM doc.user_import WHERE id = ?")) {
			readStalled = true
			await heldRead
		}
		return result
	}
	setCrateClientForTest(db)
	let releaseWrite!: () => void
	db.slowWrite = new Promise<void>((resolve) => {
		releaseWrite = resolve
	})
	const late = b.decideImport(USER, IMPORT, "imdb", [1])
	await until(() => readStalled)
	await a.decideImport(USER, IMPORT, "imdb", [0])
	await until(() => db.scoreWrites > 0)
	releaseRead()
	await late
	assert.equal(db.starts, 2) // Confirm and exactly one stalled restart.
	releaseWrite()
	await settled()
	assert.ok(db.items.every((i) => i.apply_state === "updated"))
})

test("failed ask undo exposes retry while a failed apply does not", async () => {
	const db = conflicts()
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	const execute = db.execute.bind(db)
	let failUndo = true
	db.execute = async (sql, params) => {
		if (failUndo && sql.includes("SET apply_state = 'kept' WHERE"))
			throw new Error("undo fixture failure")
		return execute(sql, params)
	}
	setCrateClientForTest(db)
	await assert.rejects(() => a.undoImport(USER, IMPORT), /undo fixture failure/)
	const summary = a.summarize(await a.getImportRow(USER, IMPORT))
	assert.equal(summary.status, "failed")
	assert.equal(summary.canUndo, true)
	await assert.rejects(() => a.confirmImport(USER, IMPORT, "keep"), {
		status: 409,
	})
	failUndo = false
	assert.equal((await b.undoImport(USER, IMPORT)).status, "undone")
	db.row.status = "failed"
	db.row.options = JSON.stringify({ ask: true })
	assert.equal(a.summarize(await a.getImportRow(USER, IMPORT)).canUndo, false)
})

test("consent uses one bulk update only for failed approved rows and preserves payloads", async () => {
	const db = conflicts(3)
	db.items[0].payload = JSON.stringify({ fixture: "first" })
	db.items[1].payload = JSON.stringify({ fixture: "second" })
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	const execute = db.execute.bind(db)
	let consentWrites = 0
	db.execute = async (sql, params) => {
		if (sql.startsWith("UPDATE doc.user_import_item SET payload")) {
			consentWrites++
			assert.ok(sql.includes("row_index IN (?,?)"))
		}
		return execute(sql, params)
	}
	setCrateClientForTest(db)
	db.failWrites = true
	await b.decideImport(USER, IMPORT, "imdb", [0, 1])
	await settled()
	assert.equal(consentWrites, 1)
	assert.deepEqual(
		db.items.slice(0, 2).map((i) => JSON.parse(String(i.payload))),
		[
			{ fixture: "first", _answer: { conflict: "imdb" } },
			{ fixture: "second", _answer: { conflict: "imdb" } },
		],
	)
	db.failWrites = false
	await a.confirmImport(USER, IMPORT, "keep")
	await settled()
	assert.equal(consentWrites, 1)
	assert.equal(db.items[2].payload, null)
})

test("per-row keep survives a later whole IMDb answer without persisting consent on success", async () => {
	const db = conflicts(2)
	await a.confirmImport(USER, IMPORT, "ask")
	await settled()
	await b.decideImport(USER, IMPORT, "keep", [0])
	await b.decideImport(USER, IMPORT, "imdb")
	await settled()
	assert.deepEqual(
		db.items.map((i) => i.apply_state),
		["kept", "updated"],
	)
	assert.ok(db.items.every((i) => i.payload === null))
	assert.equal(db.row.processed, db.row.total)
})
