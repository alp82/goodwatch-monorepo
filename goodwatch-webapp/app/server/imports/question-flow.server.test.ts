import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { afterEach, test } from "node:test"
import type { ImportOptions } from "../../domain/imports.ts"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"
import type { Param } from "./store.server.ts"

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
		if (url.endsWith("/utils/auth.ts"))
			return {
				format: "module",
				shortCircuit: true,
				source: `export const getAuthFromRequest=async({request})=>({user:request.headers.get('x-fixture-member')?{id:request.headers.get('x-fixture-member')}:null,headers:new Headers()});export const getUserIdFromRequest=async()=>null;`,
			}
		return next(url, context)
	},
})
process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const { holdTasteRebuildsForTest } = await import("../taste/member.server.ts")
holdTasteRebuildsForTest()
const { setImportDbForTest, activeRuns, itemRows } = await import(
	"./store.server.ts"
)
const { setImportEffectsForTest, holdQuestions, recount } = await import(
	"./apply.server.ts"
)
const {
	confirmImport,
	decideImport,
	getImport,
	getImportItems,
	undoImport,
	getImportResult,
} = await import("./service.server.ts")
const options: ImportOptions = {
	kinds: ["rating", "favorite"],
	conflictChoice: "keep",
	watchDates: "preserve",
	ask: ["conflict"],
}
function setup(n = 1) {
	const db = new ImportDb()
	db.seed()
	const id = String(db.imports[0].id)
	const first = db.items[0]
	first.kind = "rating"
	first.outcome = "conflict"
	first.current_score = 4
	first.payload = JSON.stringify({
		...JSON.parse(String(first.payload)),
		kind: "rating",
		score: 9,
		_preview: {
			seq: 1,
			term: 1,
			score: 4,
			review: null,
			updatedAt: "2020-01-01T00:00:00.000Z",
		},
	})
	db.scores.push({
		user_id: "member",
		tmdb_id: 42,
		media_type: "movie",
		score: 4,
		review: null,
		updated_at: new Date("2020-01-01"),
		created_at: new Date("2020-01-01"),
		_seq_no: 1,
		_primary_term: 1,
	})
	for (let i = 1; i < n; i++)
		db.items.push({ ...first, row_index: i, source_key: `rating:${i}` })
	setCrateClientForTest(new FakeTrackingCrate())
	setImportDbForTest(db)
	setImportEffectsForTest(async () => {})
	return { db, id }
}
async function settled(db: ImportDb) {
	for (let i = 0; i < 200; i++) {
		if (
			!activeRuns.has(String(db.imports[0].id)) &&
			["done", "failed"].includes(String(db.imports[0].status))
		)
			return
		await new Promise((resolve) => setTimeout(resolve, 5))
	}
	assert.fail(`Import did not settle: ${db.imports[0].status}`)
}
afterEach(() => {
	setCrateClientForTest(null)
	setImportDbForTest()
	setImportEffectsForTest()
})

test("confirm holds conflicts before returning; done can have unanswered rows; recount and summary agree", async () => {
	const { db, id } = setup()
	const summary = await confirmImport("member", id, options)
	assert.equal(db.items[0].apply_state, "waiting:conflict")
	assert.equal(summary.questions?.[0].waiting, 1)
	await settled(db)
	assert.equal(db.imports[0].status, "done")
	assert.equal(db.scores[0].score, 4)
	assert.equal((await recount(id)).processed, 1)
	assert.deepEqual((await getImport("member", id)).questions, [
		{ kind: "conflict", waiting: 1, applying: 0, answer: null },
	])
})
test("hold is idempotent and batches 50,000 rows at 800", async () => {
	const { db, id } = setup(50_000)
	let batches = 0
	const original = db.run.bind(db)
	db.run = async (sql, params) => {
		if (sql.includes("SET apply_state = 'waiting:conflict'")) {
			batches++
			assert.ok(params.length <= 801)
		}
		return original(sql, params)
	}
	const start = performance.now()
	await holdQuestions("member", id, options)
	await holdQuestions("member", id, options)
	assert.equal(batches, 63)
	assert.equal(
		db.items.filter((row) => row.apply_state === "waiting:conflict").length,
		50_000,
	)
	console.info(
		`50,000-row hold and idempotent repeat: ${Math.round(performance.now() - start)}ms (fake DB)`,
	)
})
test("whole keep is stored, sets applied_at and does not write a score; repeat decides zero", async () => {
	const { db, id } = setup()
	await confirmImport("member", id, options)
	await settled(db)
	const result = await decideImport("member", id, "conflict", "keep")
	assert.equal(result.decided, 1)
	assert.equal(db.items[0].apply_state, "kept")
	assert.ok(db.items[0].applied_at)
	assert.equal(db.scores[0].score, 4)
	assert.equal(
		JSON.parse(String(db.imports[0].options)).answers.conflict,
		"keep",
	)
	assert.equal(db.imports[0].conflict_choice, "keep")
	assert.equal(
		(await decideImport("member", id, "conflict", "keep")).decided,
		0,
	)
})
test("source restarts a done run, applies the approved row, and preserves finished_at", async () => {
	const { db, id } = setup()
	await confirmImport("member", id, options)
	await settled(db)
	const finished = db.imports[0].finished_at
	await decideImport("member", id, "conflict", "source")
	await settled(db)
	assert.equal(db.scores[0].score, 9)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.imports[0].finished_at, finished)
	assert.equal(
		JSON.parse(String(db.imports[0].options)).conflictChoice,
		"source",
	)
})
test("per-row source overrides keep without answering other rows; waiting pagination is ordered and owned", async () => {
	const { db, id } = setup(3)
	await confirmImport("member", id, options)
	await settled(db)
	assert.deepEqual(
		(
			await getImportItems("member", id, undefined, 1, 1, false, "conflict")
		).items.map((row) => row.index),
		[1],
	)
	await assert.rejects(
		() => getImportItems("stranger", id, undefined, 0, 50, false, "conflict"),
		{ status: 404 },
	)
	await decideImport("member", id, "conflict", "source", [1, 1])
	await settled(db)
	assert.deepEqual(
		db.items.map((row) => row.apply_state),
		["waiting:conflict", "updated", "waiting:conflict"],
	)
	assert.equal(JSON.parse(String(db.imports[0].options)).answers, undefined)
	assert.equal((await getImport("member", id)).questions?.[0].waiting, 2)
})
test("approved rows are pending, not processed; waiting rows are absent from the result", async () => {
	const { db, id } = setup(2)
	await confirmImport("member", id, options)
	await settled(db)
	assert.deepEqual(
		(await getImportResult("member", id)).sections.flatMap(
			(section) => section.rows,
		),
		[],
	)
	db.items[0].apply_state = "approved:conflict"
	assert.equal((await recount(id)).processed, 1)
	assert.equal((await getImport("member", id)).questions?.[0].applying, 1)
	assert.deepEqual(
		(await itemRows("member", id, true)).map((row) => row.index),
		[0],
	)
})
test("resume holds NULL conflicts and copies stored ask and answers", async () => {
	const { db, id } = setup()
	db.imports[0].status = "failed"
	db.imports[0].options = JSON.stringify({
		...options,
		answers: {},
		direction: "apply",
	})
	await confirmImport("member", id, {
		...options,
		ask: undefined,
		conflictChoice: "source",
	})
	await settled(db)
	assert.equal(db.items[0].apply_state, "waiting:conflict")
	assert.deepEqual(JSON.parse(String(db.imports[0].options)).answers, {})
})
test("repeating source repairs a crash after answer storage or after row approval", async () => {
	for (const state of ["waiting:conflict", "approved:conflict", null]) {
		const { db, id } = setup()
		await confirmImport("member", id, options)
		await settled(db)
		db.imports[0].options = JSON.stringify({
			...options,
			answers: { conflict: "source" },
			conflictChoice: "source",
			direction: "apply",
		})
		db.items[0].apply_state = state
		await decideImport("member", id, "conflict", "source")
		await settled(db)
		assert.equal(db.items[0].apply_state, "updated")
	}
})
test("undo cancels waiting and approved rows without claiming they were decided", async () => {
	const { db, id } = setup(2)
	await confirmImport("member", id, options)
	await settled(db)
	db.items[1].apply_state = "approved:conflict"
	await undoImport("member", id)
	assert.deepEqual(
		db.items.map((row) => row.apply_state),
		["kept", "kept"],
	)
	assert.equal(db.imports[0].status, "undone")
	assert.equal(db.scores[0].score, 4)
	assert.ok(db.items.every((row) => !String(row.reason).includes("You chose")))
})
test("decide rejects invalid answers, rows, preview, undone, and undo in progress", async () => {
	const { db, id } = setup()
	for (const [q, a, rows] of [
		["conflict", "add", undefined],
		["rewatch", "source", undefined],
		["conflict", "keep", [-1]],
		["conflict", "keep", Array(501).fill(0)],
	] as const)
		await assert.rejects(
			() => decideImport("member", id, q, a, rows ? [...rows] : undefined),
			{ status: 400 },
		)
	await assert.rejects(() => decideImport("member", id, "conflict", "keep"), {
		status: 409,
	})
	for (const status of ["undone", "running", "failed"]) {
		db.imports[0].status = status
		db.imports[0].options = JSON.stringify({ ...options, direction: "undo" })
		await assert.rejects(() => decideImport("member", id, "conflict", "keep"), {
			status: 409,
		})
	}
})
test("legacy confirm keeps stored options and row states byte-for-byte unchanged", async () => {
	const { db, id } = setup()
	const { ask: _, ...legacy } = options
	await confirmImport("member", id, legacy)
	await settled(db)
	assert.equal(
		db.imports[0].options,
		JSON.stringify({ ...legacy, direction: "apply" }),
	)
	assert.equal(
		JSON.stringify(db.items.map((row) => row.apply_state)),
		'["kept"]',
	)
	assert.equal((await getImport("member", id)).questions, undefined)
})

test("finishing CAS retries when a decision touches the import after its version read", async () => {
	const { db, id } = setup()
	const original = db.run.bind(db)
	let raced = false
	db.run = async (sql, params) => {
		if (!raced && sql.includes("finished_at = COALESCE")) {
			raced = true
			await decideImport("member", id, "conflict", "source")
		}
		return original(sql, params)
	}
	await confirmImport("member", id, options)
	await settled(db)
	assert.ok(raced)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.scores[0].score, 9)
})
test("a decision during a pass is picked up before finishing", async () => {
	const { db, id } = setup()
	let answered = false
	setImportEffectsForTest(async () => {
		if (!answered) {
			answered = true
			await decideImport("member", id, "conflict", "source", [0])
		}
	})
	await confirmImport("member", id, options)
	await settled(db)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.imports[0].status, "done")
})
test("a decision immediately after finishing CAS starts a new local run", async () => {
	const { db, id } = setup()
	const original = db.run.bind(db)
	let raced = false
	db.run = async (sql, params) => {
		const result = await original(sql, params)
		if (
			!raced &&
			sql.includes("finished_at = COALESCE") &&
			result.rowcount === 1
		) {
			raced = true
			await decideImport("member", id, "conflict", "source")
		}
		return result
	}
	await confirmImport("member", id, options)
	for (let i = 0; i < 200 && db.items[0].apply_state !== "updated"; i++)
		await new Promise((resolve) => setTimeout(resolve, 5))
	await settled(db)
	assert.equal(db.items[0].apply_state, "updated")
})
test("answer CAS retries and competing restart claims have a single winner", async () => {
	const { db, id } = setup()
	await confirmImport("member", id, options)
	await settled(db)
	const original = db.run.bind(db)
	let attempts = 0
	let starts = 0
	db.run = async (sql, params) => {
		if (
			sql.startsWith("UPDATE doc.user_import SET options =") &&
			++attempts === 1
		)
			return { rowcount: 0 }
		const result = await original(sql, params)
		if (sql.includes("status = 'running'") && result.rowcount === 1) starts++
		return result
	}
	await Promise.all([
		decideImport("member", id, "conflict", "source"),
		decideImport("member", id, "conflict", "source"),
	])
	await settled(db)
	assert.ok(attempts >= 3)
	assert.equal(starts, 1)
	assert.equal(db.items[0].apply_state, "updated")
})

test("two pods deciding from the same stalled version start exactly one runner", async (t) => {
	const { db, id } = setup(2)
	db.imports[0].status = "running"
	db.imports[0].options = JSON.stringify({ ...options, direction: "apply" })
	db.imports[0].updated_at = new Date(0)
	for (const item of db.items) item.apply_state = "waiting:conflict"
	db.items[1].tmdb_id = 43
	db.scores.push({ ...db.scores[0], tmdb_id: 43 })
	// Separate module instances give each simulated pod its own localRuns queue.
	const podC = await import(
		new URL("./apply.server.ts?stalled-pod=c", import.meta.url).href
	)
	const bothRead = Promise.withResolvers<void>()
	const winnerStarted = Promise.withResolvers<void>()
	const finish = Promise.withResolvers<void>()
	let starts = 0
	const add = activeRuns.add.bind(activeRuns)
	// Neither pod can see the other pod's in-process activeRuns membership.
	t.mock.method(activeRuns, "has", () => false)
	t.mock.method(activeRuns, "add", (value: string) => {
		starts++
		return add(value)
	})
	const ratings = async () => {
		winnerStarted.resolve()
		await finish.promise
	}
	setImportEffectsForTest(async () => {}, ratings)
	podC.setImportEffectsForTest(async () => {}, ratings)
	const select = db.select.bind(db)
	let entries = 0
	db.select = async (sql, params) => {
		const result = await select(sql, params)
		if (sql.includes("FROM doc.user_import WHERE id = ?") && entries < 2) {
			const entry = ++entries
			if (entry === 2) bothRead.resolve()
			await bothRead.promise
			if (entry === 2) await winnerStarted.promise
		}
		return result
	}
	try {
		await Promise.all([
			decideImport("member", id, "conflict", "source", [0]),
			podC.decideImport("member", id, "conflict", "source", [1]),
		])
	} finally {
		finish.resolve()
		t.mock.restoreAll()
	}
	await settled(db)
	assert.equal(entries, 2)
	assert.equal(starts, 1)
	assert.deepEqual(
		db.items.map((item) => item.apply_state),
		["updated", "updated"],
	)
	assert.deepEqual(
		db.scores.map((score) => score.score),
		[9, 9],
	)
})

test("a stalled decide claims before writes and retries whole-answer options against a fresh version", async () => {
	const { db, id } = setup()
	db.imports[0].status = "running"
	db.imports[0].options = JSON.stringify({ ...options, direction: "apply" })
	db.imports[0].updated_at = new Date(0)
	db.imports[0].error = "Previous runner died"
	db.items[0].apply_state = "waiting:conflict"
	const run = db.run.bind(db)
	let writes = 0
	let attempts = 0
	db.run = async (sql, params) => {
		if (sql.startsWith("UPDATE")) {
			if (++writes === 1) {
				assert.ok(sql.includes("status = 'running'"))
				assert.ok(sql.includes("_seq_no = ? AND _primary_term = ?"))
			}
			if (
				sql.startsWith("UPDATE doc.user_import SET options =") &&
				++attempts === 1
			)
				return { rowcount: 0 }
		}
		return run(sql, params)
	}
	await decideImport("member", id, "conflict", "source")
	await settled(db)
	assert.equal(attempts, 2)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.scores[0].score, 9)
	assert.equal(db.imports[0].error, null)
	assert.equal(
		JSON.parse(String(db.imports[0].options)).answers.conflict,
		"source",
	)
})

test("decide on a running non-stalled import never starts a runner", async (t) => {
	const { db, id } = setup()
	db.imports[0].status = "running"
	db.imports[0].options = JSON.stringify({ ...options, direction: "apply" })
	db.imports[0].updated_at = new Date()
	db.items[0].apply_state = "waiting:conflict"
	const add = t.mock.method(activeRuns, "add")
	await decideImport("member", id, "conflict", "source")
	assert.equal(add.mock.callCount(), 0)
	assert.equal(db.imports[0].status, "running")
	assert.equal(db.items[0].apply_state, "approved:conflict")
	assert.equal(db.scores[0].score, 4)
})

test("HTTP decide, strict confirm ask, and waiting filter validate and enforce ownership", async () => {
	const { db, id } = setup(2)
	const { action: decide } = await import(
		"../../routes/api.imports.$id.decide.ts"
	)
	const { action: confirm } = await import(
		"../../routes/api.imports.$id.confirm.ts"
	)
	const { loader: items } = await import(
		"../../routes/api.imports.$id.items.ts"
	)
	const send = (
		action: typeof decide,
		body: unknown,
		member: string | null = "member",
		method = "POST",
	) =>
		action({
			request: new Request(`https://example.test/api/imports/${id}/decide`, {
				method,
				headers: member ? { "x-fixture-member": member } : {},
				...(method === "POST" ? { body: JSON.stringify(body) } : {}),
			}),
			params: { id },
			context: {},
		})
	assert.equal(
		(await send(decide, { question: "conflict", answer: "keep" }, null)).status,
		401,
	)
	assert.equal(
		(await send(decide, { question: "conflict", answer: "keep" }, "other"))
			.status,
		404,
	)
	assert.equal(
		(await send(decide, { question: "conflict", answer: "keep" })).status,
		409,
	)
	assert.equal((await send(decide, {}, "member", "GET")).status, 405)
	for (const body of [
		{ question: "undated", answer: "keep" },
		{ question: "conflict", answer: "add" },
		{ question: "conflict", answer: "source", rows: [] },
		{ question: "conflict", answer: "source", rows: Array(501).fill(0) },
		{ question: "conflict", answer: "keep", extra: true },
	])
		assert.equal((await send(decide, body)).status, 400)
	for (const body of [
		{ ...options, ask: ["bogus"] },
		{ ...options, answers: { conflict: "source" } },
	])
		assert.equal((await send(confirm, body)).status, 400)
	assert.equal(
		(
			await send(confirm, {
				...options,
				ask: ["conflict", "rewatch", "wholeShow", "undated"],
			})
		).status,
		200,
	)
	await settled(db)
	const load = (query: string, member = "member") =>
		items({
			request: new Request(
				`https://example.test/api/imports/${id}/items?${query}`,
				{ headers: { "x-fixture-member": member } },
			),
			params: { id },
			context: {},
		})
	assert.equal((await load("waiting=undated")).status, 200)
	assert.equal((await load("waiting=conflict&offset=-1")).status, 400)
	assert.equal((await load("waiting=conflict", "other")).status, 404)
	const response = await load("waiting=conflict&offset=1&limit=1")
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	const payload = await response.json()
	assert.equal(payload.total, 2)
	assert.equal(payload.items[0].index, 1)
	assert.equal(payload.items[0].payload, undefined)
	assert.equal(payload.items[0]._preview, undefined)
	const decision = await send(decide, {
		question: "conflict",
		answer: "keep",
		rows: [1],
	})
	assert.equal(decision.status, 200)
	assert.equal((await decision.json()).decided, 1)
	assert.equal(db.items[1].reason, "You chose to keep what GoodWatch has.")
})
test("stalled and failed runs can restart after a row approval; answer retry exhaustion is 409", async () => {
	for (const status of ["failed", "running"]) {
		const { db, id } = setup()
		await confirmImport("member", id, options)
		await settled(db)
		db.imports[0].status = status
		db.imports[0].updated_at = new Date(0)
		await decideImport("member", id, "conflict", "source")
		await settled(db)
		assert.equal(db.items[0].apply_state, "updated")
	}
	const { db, id } = setup()
	await confirmImport("member", id, options)
	await settled(db)
	const original = db.run.bind(db)
	db.run = (sql, params) =>
		sql.startsWith("UPDATE doc.user_import SET options =")
			? Promise.resolve({ rowcount: 0 })
			: original(sql, params)
	await assert.rejects(() => decideImport("member", id, "conflict", "source"), {
		status: 409,
	})
	assert.equal(db.items[0].apply_state, "waiting:conflict")
})
test("question and completed analytics retain deterministic UUIDs across restarted passes", async () => {
	const { db, id } = setup()
	const { setAnalyticsFetch, flushProductEvents } = await import(
		"../../telemetry/product-analytics.server.ts"
	)
	const previous = process.env.NODE_ENV
	const previousKey = process.env.POSTHOG_API_KEY
	const previousDisabled = process.env.POSTHOG_DISABLED
	const events: {
		event: string
		uuid: string
		properties: Record<string, unknown>
	}[] = []
	setAnalyticsFetch(async (_url, init) => {
		events.push(...JSON.parse(String(init?.body)).batch)
		return new Response("{}", { status: 200 })
	})
	process.env.NODE_ENV = "production"
	process.env.POSTHOG_API_KEY = "fixture"
	process.env.POSTHOG_DISABLED = "false"
	try {
		await confirmImport("member", id, options)
		await settled(db)
		// Wait for the analytics wrapper after the run's final cleanup.
		await new Promise((resolve) => setTimeout(resolve, 5))
		await decideImport("member", id, "conflict", "source")
		await settled(db)
		await decideImport("member", id, "conflict", "source")
		await new Promise((resolve) => setTimeout(resolve, 5))
		const undated = setupUndated(2)
		undated.db.items[1].kind = "want"
		undated.db.items[1].payload = JSON.stringify({ kind: "want", title: "One" })
		await confirmImport("member", undated.id, undatedOptions)
		await settled(undated.db)
		const result = await decideImport("member", undated.id, "undated", "leave")
		assert.equal(result.decided, 1)
		await settled(undated.db)
		await flushProductEvents()
		assert.equal(
			events.find(
				(event) =>
					event.event === "import question answered" &&
					event.properties.question === "undated",
			)?.properties.decided,
			1,
		)
		const legacy = setup()
		const legacyOptions = {
			...options,
			ask: undefined,
			conflictChoice: "source" as const,
		}
		for (let attempt = 0; attempt < 2; attempt++) {
			legacy.db.failScoreOnce = true
			await confirmImport("member", legacy.id, legacyOptions)
			await settled(legacy.db)
			await new Promise((resolve) => setTimeout(resolve, 1100))
		}
		await flushProductEvents()
		const failures = events.filter((event) => event.event === "import failed")
		assert.equal(failures.length, 2)
		assert.notEqual(failures[0].uuid, failures[1].uuid)
		const completed = events.filter(
			(event) => event.event === "import completed",
		)
		assert.ok(completed.length >= 2)
		assert.equal(new Set(completed.map((event) => event.uuid)).size, 1)
		const answered = events.filter(
			(event) =>
				event.event === "import question answered" &&
				event.properties.question === "conflict",
		)
		assert.equal(answered.length, 2)
		assert.equal(answered[0].uuid, answered[1].uuid)
		assert.equal(answered[0].properties.question, "conflict")
		assert.equal(answered[0].properties.answer, "source")
	} finally {
		setAnalyticsFetch(null)
		if (previous === undefined) Reflect.deleteProperty(process.env, "NODE_ENV")
		else process.env.NODE_ENV = previous
		if (previousKey === undefined)
			Reflect.deleteProperty(process.env, "POSTHOG_API_KEY")
		else process.env.POSTHOG_API_KEY = previousKey
		if (previousDisabled === undefined)
			Reflect.deleteProperty(process.env, "POSTHOG_DISABLED")
		else process.env.POSTHOG_DISABLED = previousDisabled
	}
})

test("a whole answer racing confirm's bulk hold is repaired before applying", async () => {
	const { db, id } = setup()
	const original = db.run.bind(db)
	let raced = false
	db.run = async (sql, params) => {
		if (!raced && sql.includes("SET apply_state = 'waiting:conflict'")) {
			raced = true
			await decideImport("member", id, "conflict", "source")
		}
		return original(sql, params)
	}
	await confirmImport("member", id, options)
	await settled(db)
	assert.ok(raced)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(
		(await confirmImport("member", id, options)).questions?.[0].answer,
		"source",
	)
})

test("legacy resume clears the previous finish and moves finished_at on success", async () => {
	const { db, id } = setup()
	const legacy = {
		...options,
		ask: undefined,
		conflictChoice: "source" as const,
	}
	db.failScoreOnce = true
	await confirmImport("member", id, legacy)
	await settled(db)
	assert.equal(db.imports[0].status, "failed")
	const firstFinish = db.imports[0].finished_at
	await new Promise((resolve) => setTimeout(resolve, 5))
	await confirmImport("member", id, legacy)
	await settled(db)
	assert.equal(db.imports[0].status, "done")
	assert.ok(Number(db.imports[0].finished_at) > Number(firstFinish))
})

test("per-row source survives failScoreOnce and resumes without answering other rows", async () => {
	const { db, id } = setup(2)
	await confirmImport("member", id, options)
	await settled(db)
	db.failScoreOnce = true
	await decideImport("member", id, "conflict", "source", [0])
	await settled(db)
	assert.equal(db.imports[0].status, "failed")
	assert.equal(db.items[0].apply_state, "failed")
	assert.deepEqual(JSON.parse(String(db.items[0].payload))._answer, {
		conflict: "source",
	})
	await confirmImport("member", id, options)
	await settled(db)
	assert.equal(db.items[0].apply_state, "updated")
	assert.equal(db.items[1].apply_state, "waiting:conflict")
	assert.equal(db.scores[0].score, 9)
	assert.equal(JSON.parse(String(db.imports[0].options)).answers, undefined)
})

test("a pass holds missed rows once, using only untouched conflict candidates", async () => {
	const { db, id } = setup(20)
	db.items[19].outcome = "unchanged"
	const originalRun = db.run.bind(db)
	const originalSelect = db.select.bind(db)
	let holds = 0
	let reads = 0
	db.run = async (sql, params) => {
		if (sql.includes("SET apply_state = 'waiting:conflict'") && ++holds === 1)
			return { rowcount: 0 } // Simulate a hold missed during confirm.
		return originalRun(sql, params)
	}
	db.select = async <T extends {}>(sql: string, params: Param[]) => {
		const result = await originalSelect<T>(sql, params)
		if (sql.includes("AND outcome = 'conflict' AND apply_state IS NULL")) {
			reads++
			assert.deepEqual(params, [id, "member"])
			assert.equal(result.length, 19)
		}
		return result
	}
	await confirmImport("member", id, options)
	await settled(db)
	assert.equal(holds, 2)
	assert.equal(reads, 2)
	assert.equal(db.items[19].apply_state, "kept")
})

test("decide publishes rows before touching the finishing version; finishing refreshes after its version read", async () => {
	const { db, id } = setup()
	await confirmImport("member", id, options)
	await settled(db)
	const original = db.run.bind(db)
	let transitioned = false
	let refreshed = false
	let touched = false
	db.run = async (sql, params) => {
		if (sql.includes("AND apply_state = 'waiting:conflict'"))
			transitioned = true
		if (transitioned && sql === "REFRESH TABLE doc.user_import_item")
			refreshed = true
		if (
			transitioned &&
			sql ===
				"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
		) {
			assert.ok(refreshed)
			touched = true
		}
		return original(sql, params)
	}
	await decideImport("member", id, "conflict", "source", [0])
	await settled(db)
	assert.ok(touched)
	const calls: string[] = []
	const select = db.select.bind(db)
	db.select = async (sql, params) => {
		calls.push(sql)
		return select(sql, params)
	}
	db.run = async (sql, params) => {
		calls.push(sql)
		return original(sql, params)
	}
	// A legacy retry gives us a full finishing pass without another decider.
	db.imports[0].status = "failed"
	await confirmImport("member", id, options)
	await settled(db)
	const finish = calls.findIndex((sql) =>
		sql.includes("finished_at = COALESCE"),
	)
	const pending = calls
		.slice(0, finish)
		.reduce(
			(last, sql, index) =>
				sql.includes("SELECT row_index") &&
				sql.includes("OR apply_state = 'failed'")
					? index
					: last,
			-1,
		)
	assert.equal(calls[pending - 2], "REFRESH TABLE doc.user_import_item")
})

test("finishing drains an in-flight heartbeat without another pass", async (t) => {
	const { db, id } = setup()
	t.mock.timers.enable({ apis: ["setInterval"] })
	const original = db.run.bind(db)
	let release!: () => void
	const heartbeat = new Promise<void>((resolve) => {
		release = resolve
	})
	let started = false
	let passes = 0
	db.run = async (sql, params) => {
		if (
			sql ===
			"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
		) {
			started = true
			await heartbeat
		}
		return original(sql, params)
	}
	setImportEffectsForTest(
		async () => {},
		async () => {
			passes++
			t.mock.timers.tick(10_000)
		},
	)
	await confirmImport("member", id, options)
	await new Promise((resolve) => setTimeout(resolve, 10))
	assert.ok(started)
	assert.equal(db.imports[0].status, "running")
	release()
	await settled(db)
	assert.equal(passes, 1)
})

test("undo cancels an approval racing its first cancellation", async () => {
	const { db, id } = setup()
	await confirmImport("member", id, options)
	await settled(db)
	const original = db.run.bind(db)
	let cancels = 0
	db.run = async (sql, params) => {
		const result = await original(sql, params)
		if (sql.includes("SET apply_state = 'kept'") && ++cancels === 1)
			db.items[0].apply_state = "approved:conflict"
		return result
	}
	await undoImport("member", id)
	assert.equal(cancels, 2)
	assert.equal(db.items[0].apply_state, "kept")
	assert.equal(db.imports[0].status, "undone")
	await assert.rejects(
		() => decideImport("member", id, "conflict", "source", []),
		{ status: 400 },
	)
})

function setupRewatch(n = 1, evidence?: string) {
	const { db, id } = setup(n)
	db.scores = []
	for (const item of db.items) {
		item.kind = "want"
		item.payload = JSON.stringify({
			kind: "want",
			title: "Seen title",
			wishlistRewatchChoice: true,
			...(evidence
				? {
						wishlistEvidence: {
							source: evidence,
							completeness: "complete",
							mediaType: "movie",
						},
					}
				: {}),
		})
	}
	db.watches.push({
		user_id: "member",
		tmdb_id: 42,
		media_type: "movie",
		watch_id: "existing",
	})
	return { db, id }
}
const rewatchOptions: ImportOptions = {
	kinds: ["want"],
	conflictChoice: "keep",
	watchDates: "preserve",
	ask: ["rewatch"],
}

test("rewatch add and leave work for all rows and per row, independently of conflict choice", async () => {
	for (const answer of ["add", "leave"] as const)
		for (const perRow of [false, true]) {
			const { db, id } = setupRewatch(2)
			await confirmImport("member", id, rewatchOptions)
			await settled(db)
			assert.deepEqual(
				db.items.map((row) => row.apply_state),
				["waiting:rewatch", "waiting:rewatch"],
			)
			const result = await decideImport(
				"member",
				id,
				"rewatch",
				answer,
				perRow ? [0] : undefined,
			)
			assert.equal(result.decided, perRow ? 1 : 2)
			await settled(db)
			assert.equal(db.items[0].apply_state, answer === "add" ? "added" : "kept")
			assert.equal(db.wishlist.length, answer === "add" ? 1 : 0)
			if (perRow) assert.equal(db.items[1].apply_state, "waiting:rewatch")
			assert.equal(db.imports[0].conflict_choice, "keep")
			assert.equal(
				JSON.parse(String(db.items[0].payload))._answer.rewatch,
				answer,
			)
			if (answer === "leave") {
				const result = await getImportResult("member", id)
				assert.ok(
					JSON.stringify(result).includes("Left as Seen, as you chose."),
				)
			}
		}
})

test("whole-show add re-gates the row to rewatch atomically, and both per-row consents survive failure", async () => {
	const { db, id } = setupRewatch()
	const payload = JSON.parse(String(db.items[0].payload))
	db.items[0].payload = JSON.stringify({ ...payload, wishlistShowChoice: true })
	const opts: ImportOptions = {
		...rewatchOptions,
		ask: ["rewatch", "wholeShow"],
	}
	await confirmImport("member", id, opts)
	await settled(db)
	assert.equal(db.items[0].apply_state, "waiting:wholeShow")
	assert.equal(
		(await decideImport("member", id, "wholeShow", "add", [0])).decided,
		1,
	)
	assert.equal(db.items[0].apply_state, "waiting:rewatch")
	assert.equal(db.wishlist.length, 0)
	const original = db.run.bind(db)
	let fail = true
	db.run = async (sql, params) => {
		if (fail && sql.startsWith("INSERT INTO user_wishlist")) {
			fail = false
			throw new Error("injected")
		}
		return original(sql, params)
	}
	await decideImport("member", id, "rewatch", "add", [0])
	await settled(db)
	assert.equal(db.items[0].apply_state, "failed")
	assert.deepEqual(JSON.parse(String(db.items[0].payload))._answer, {
		wholeShow: "add",
		rewatch: "add",
	})
	await confirmImport("member", id, opts)
	await settled(db)
	assert.equal(db.items[0].apply_state, "added")
})

test("whole-show leave keeps an honest reason for all rows and per row", async () => {
	for (const perRow of [false, true]) {
		const { db, id } = setupRewatch(2)
		for (const row of db.items)
			row.payload = JSON.stringify({
				...JSON.parse(String(row.payload)),
				wishlistShowChoice: true,
			})
		await confirmImport("member", id, {
			...rewatchOptions,
			ask: ["wholeShow", "rewatch"],
		})
		await settled(db)
		await decideImport(
			"member",
			id,
			"wholeShow",
			"leave",
			perRow ? [0] : undefined,
		)
		assert.equal(db.items[0].apply_state, "kept")
		assert.equal(
			db.items[0].reason,
			"Left off Want to See for the whole show, as you chose.",
		)
		assert.equal(db.wishlist.length, 0)
		if (perRow) assert.equal(db.items[1].apply_state, "waiting:wholeShow")
	}
})

test("legacy confirm preserves serialized options and coupling with and without evidence", async () => {
	for (const evidence of [undefined, "tvtime", "watcharr"])
		for (const conflictChoice of ["source", "keep"] as const) {
			const { db, id } = setupRewatch(1, evidence)
			db.imports[0].source = evidence === "tvtime" ? "tvtime" : "trakt"
			const legacy: ImportOptions = {
				kinds: ["want"],
				conflictChoice,
				watchDates: "preserve",
			}
			await confirmImport("member", id, legacy)
			await settled(db)
			assert.equal(
				db.imports[0].options,
				JSON.stringify({ ...legacy, direction: "apply" }),
			)
			assert.equal(
				db.items[0].apply_state,
				evidence === "tvtime" && conflictChoice === "source" ? "added" : "kept",
			)
			assert.equal(JSON.parse(String(db.items[0].payload))._answer, undefined)
		}
})

test("explicit rewatch answer controls every source even when conflict choice disagrees", async () => {
	for (const evidence of [undefined, "tvtime", "watcharr"])
		for (const add of [true, false]) {
			const { db, id } = setupRewatch(1, evidence)
			await confirmImport("member", id, {
				kinds: ["want"],
				watchDates: "preserve",
				conflictChoice: add ? "keep" : "source",
				wishlistRewatch: add,
			})
			await settled(db)
			assert.equal(db.items[0].apply_state, add ? "added" : "kept")
		}
})

test("an all-row rewatch leave answered before whole-show add keeps the correct reason", async () => {
	const { db, id } = setupRewatch()
	db.items[0].payload = JSON.stringify({
		...JSON.parse(String(db.items[0].payload)),
		wishlistShowChoice: true,
	})
	await confirmImport("member", id, {
		...rewatchOptions,
		ask: ["wholeShow", "rewatch"],
	})
	await settled(db)
	await decideImport("member", id, "rewatch", "leave")
	await decideImport("member", id, "wholeShow", "add", [0])
	assert.equal(db.items[0].apply_state, "kept")
	assert.equal(db.items[0].reason, "Left as Seen, as you chose.")
	assert.equal(db.wishlist.length, 0)
})

test("all-row answers repair interrupted transitions and NULL holds", async () => {
	for (const answer of ["add", "leave"] as const)
		for (const state of [null, "waiting:rewatch", "approved:rewatch"]) {
			const { db, id } = setupRewatch()
			await confirmImport("member", id, rewatchOptions)
			await settled(db)
			db.imports[0].options = JSON.stringify({
				...rewatchOptions,
				answers: { rewatch: answer },
				direction: "apply",
			})
			// A no-write transition cannot have produced an approval.
			if (answer === "leave" && state === "approved:rewatch") continue
			db.items[0].apply_state = state
			await decideImport("member", id, "rewatch", answer)
			await settled(db)
			assert.equal(db.items[0].apply_state, answer === "add" ? "added" : "kept")
			if (answer === "leave")
				assert.equal(db.items[0].reason, "Left as Seen, as you chose.")
		}
})

test("new no-evidence show rewatch consent still checks the member's show status", async () => {
	for (const state of ["seen", "watching", "on_hold", "dropped"]) {
		const { db, id } = setupRewatch()
		db.items[0].media_type = "show"
		const tracking = new FakeTrackingCrate()
		tracking.seed("user_watch_state", [
			{ user_id: "member", tmdb_id: 42, media_type: "show", state, pass: 1 },
		])
		setCrateClientForTest(tracking)
		await confirmImport("member", id, {
			kinds: ["want"],
			conflictChoice: "keep",
			watchDates: "preserve",
			wishlistRewatch: true,
		})
		await settled(db)
		assert.equal(db.items[0].apply_state, state === "seen" ? "added" : "kept")
	}
})

test("pre-deploy unchanged Seen wants stay unchanged even with new consent", async () => {
	const { db, id } = setupRewatch()
	db.items[0].outcome = "unchanged"
	await confirmImport("member", id, {
		...rewatchOptions,
		wishlistRewatch: true,
	})
	await settled(db)
	assert.equal(db.items[0].outcome, "unchanged")
	assert.equal(db.items[0].apply_state, "kept")
	assert.equal(db.wishlist.length, 0)
})

test("stage 1 explicit leave replaces preview prompts with the chosen kept reason on Done", async () => {
	for (const question of ["rewatch", "wholeShow"] as const) {
		const { db, id } = setup(2)
		db.items[0].kind = "want"
		db.watches.push({
			user_id: "member",
			tmdb_id: 42,
			media_type: "movie",
			watch_id: "existing",
		})
		db.imports[0].source = "letterboxd"
		const prompt =
			question === "rewatch"
				? "Seen in GoodWatch. Choose whether to add it as Want to rewatch."
				: "This file lists a season or episode. Choose Want to See the show to add the whole show."
		const reason =
			question === "rewatch"
				? "Left as Seen, as you chose."
				: "Left off Want to See for the whole show, as you chose."
		db.items[0].reason = prompt
		db.items[0].payload = JSON.stringify({
			...JSON.parse(String(db.items[0].payload)),
			kind: "want",
			wishlistRewatchChoice: question === "rewatch",
			wishlistShowChoice: question === "wholeShow",
		})
		await confirmImport("member", id, {
			kinds: ["rating", "want"],
			conflictChoice: "source",
			watchDates: "preserve",
			...(question === "rewatch"
				? { wishlistRewatch: false }
				: { wishlistShows: false }),
		})
		await settled(db)
		assert.equal(db.items[0].apply_state, "kept")
		assert.equal(db.items[0].reason, reason)
		assert.equal(db.wishlist.length, 0)
		assert.equal(db.items[1].apply_state, "updated")
		assert.equal(db.scores[0].score, 9)
		const result = JSON.stringify(await getImportResult("member", id))
		assert.ok(result.includes(reason))
		assert.ok(!result.includes(prompt))
	}
})

const undatedOptions: ImportOptions = {
	kinds: ["watch", "want", "show_status"],
	conflictChoice: "keep",
	watchDates: "preserve",
	ask: ["undated"],
}
function setupUndated(n = 1) {
	const { db, id } = setup(n)
	db.imports[0].total = n
	const tracking = new FakeTrackingCrate()
	setCrateClientForTest(tracking)
	for (const [index, row] of db.items.entries()) {
		row.kind = "watch"
		row.outcome = "new"
		row.source_key = `watch:${index}`
		row.payload = JSON.stringify({
			kind: "watch",
			title: "One",
			precision: "unknown",
			watchedAt: null,
		})
	}
	return { db, id, tracking }
}

test("undated watches hold before confirm returns; add/leave all or per row have honest results", async () => {
	for (const answer of ["add", "leave"] as const)
		for (const perRow of [false, true]) {
			const { db, id, tracking } = setupUndated(2)
			const summary = await confirmImport("member", id, undatedOptions)
			assert.equal(summary.questions?.[0].waiting, 2)
			assert.deepEqual(
				db.items.map((row) => row.apply_state),
				["waiting:undated", "waiting:undated"],
			)
			await settled(db)
			assert.equal(tracking.log("member").length, 0)
			const result = await decideImport(
				"member",
				id,
				"undated",
				answer,
				perRow ? [0] : undefined,
			)
			assert.equal(result.decided, perRow ? 1 : 2)
			await settled(db)
			assert.equal(db.items[0].apply_state, answer === "add" ? "added" : "kept")
			assert.equal(
				tracking.log("member").length,
				answer === "add" ? (perRow ? 1 : 2) : 0,
			)
			if (perRow) assert.equal(db.items[1].apply_state, "waiting:undated")
			if (answer === "leave")
				assert.match(
					JSON.stringify(await getImportResult("member", id)),
					/Left out: no watch date/,
				)
		}
})

test("dated and later undated passes have separate plans, merge by title, and undo newest first", async () => {
	const { db, id, tracking } = setupUndated(2)
	db.items[0].payload = JSON.stringify({
		kind: "watch",
		title: "One",
		precision: "day",
		watchedAt: "2020-01-01",
	})
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	assert.equal(tracking.log("member").length, 1)
	await decideImport("member", id, "undated", "add", [1])
	await settled(db)
	const plans = db.items.filter((row) => row.kind === "state")
	assert.deepEqual(
		plans.map((row) => row.source_key),
		["state:movie:42", "state:movie:42#2"],
	)
	assert.deepEqual(
		db.items.slice(0, 2).map((row) => row.apply_state),
		["added", "kept"],
	)
	// An undated viewing matches the already imported dated viewing; keep that duplicate.
	assert.equal(tracking.log("member").length, 1)
	await undoImport("member", id)
	assert.equal(db.imports[0].status, "undone")
	assert.equal(tracking.log("member").length, 0)
	assert.equal(tracking.table("user_watch_state").length, 0)
})

test("dependent wants wait on undated before wholeShow/rewatch, including per-row leave", async () => {
	const { db, id } = setupUndated(3)
	db.items[2].kind = "want"
	db.items[2].outcome = "conflict"
	db.items[2].payload = JSON.stringify({
		kind: "want",
		title: "One",
		wishlistShowChoice: true,
		wishlistRewatchChoice: true,
	})
	await confirmImport("member", id, {
		...undatedOptions,
		ask: ["rewatch", "wholeShow", "undated"],
	})
	await settled(db)
	assert.equal(db.items[2].apply_state, "waiting:undated")
	assert.equal(
		(await getImport("member", id)).questions?.find((q) => q.kind === "undated")
			?.waiting,
		2,
	)
	const held = await getImportItems(
		"member",
		id,
		undefined,
		1,
		1,
		false,
		"undated",
	)
	assert.equal(held.total, 2)
	assert.deepEqual(
		held.items.map((item) => item.index),
		[1],
	)
	const allHeld = await getImportItems(
		"member",
		id,
		undefined,
		0,
		50,
		false,
		"undated",
	)
	assert.deepEqual(
		allHeld.items.map((item) => item.kind),
		["watch", "watch"],
	)
	assert.equal((await recount(id)).processed, 3)
	assert.equal(
		(await decideImport("member", id, "undated", "leave", [0])).decided,
		1,
	)
	assert.equal(db.items[2].apply_state, "waiting:undated")
	await decideImport("member", id, "undated", "leave", [1])
	assert.equal(db.items[2].apply_state, "waiting:wholeShow")
	// Two pods can each have read the other watch as waiting. A repeated per-row
	// answer repairs the stranded dependency without deciding any other watches.
	db.items[2].apply_state = "waiting:undated"
	await decideImport("member", id, "undated", "leave", [0])
	assert.equal(db.items[2].apply_state, "waiting:wholeShow")
})

function showFixture(
	db: ImportDb,
	tracking: FakeTrackingCrate,
	showId: number,
) {
	for (const [index, row] of db.items.entries()) {
		row.media_type = "show"
		row.tmdb_id = showId
		row.payload = JSON.stringify({
			kind: "watch",
			title: "TV Time show",
			precision: index === 0 ? "day" : "unknown",
			watchedAt: index === 0 ? "2020-01-01" : null,
			episodeTmdbId: showId + index + 1,
			season: 1,
			episode: index + 1,
		})
	}
	tracking.seed(
		"episode",
		[1, 2, 3].map((number) => ({
			show_id: showId,
			tmdb_id: showId + number,
			season_number: 1,
			episode_number: number,
			name: `Episode ${number}`,
			air_date: Date.UTC(2020, 0, 1),
			runtime: 45,
			still_path: null,
			episode_type: "standard",
			overview: null,
			removed_at: null,
		})),
	)
}

test("two episode passes both write; results merge watches by title and Undo restores original pass/state", async () => {
	const { db, id, tracking } = setupUndated(2)
	showFixture(db, tracking, 9100)
	tracking.seed("user_watch_state", [
		{
			user_id: "member",
			tmdb_id: 9100,
			media_type: "show",
			state: "watching",
			pass: 3,
			state_changed_at: 1,
			created_at: 1,
			updated_at: 1,
			rate_prompt_dismissed_at: null,
			seen_question: "answered",
			seen_group_id: null,
			seen_from_state: null,
			seen_from_state_changed_at: null,
		},
	])
	tracking.seed("user_watch_log", [
		{
			user_id: "member",
			watch_id: "before-import",
			tmdb_id: 9100,
			media_type: "show",
			episode_tmdb_id: 9103,
			season_number: 1,
			episode_number: 3,
			watched_at: null,
			watched_at_precision: "unknown",
			origin: "single",
			import_id: null,
			group_id: null,
			pass: 3,
			created_at: 1,
			updated_at: 1,
		},
	])
	const original = structuredClone(tracking.state("member", "show", 9100))
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	assert.equal(tracking.log("member").length, 2)
	await decideImport("member", id, "undated", "add")
	await settled(db)
	assert.deepEqual(
		db.items.slice(0, 2).map((row) => row.apply_state),
		["added", "added"],
	)
	assert.deepEqual(
		db.items.filter((row) => row.kind === "state").map((row) => row.source_key),
		["state:show:9100", "state:show:9100#2"],
	)
	const result = await getImportResult("member", id)
	assert.equal(
		result.sections.find((section) => section.key === "watches_added")?.total,
		1,
	)
	assert.equal(
		result.sections.find((section) => section.key === "watches_added")?.count,
		2,
	)
	await undoImport("member", id)
	assert.equal(tracking.log("member").length, 1)
	const restored = tracking.state("member", "show", 9100)
	assert.equal(restored?.state, original?.state)
	assert.equal(restored?.pass, original?.pass)
	assert.ok(
		db.items
			.filter((row) => row.kind === "state")
			.every((row) => row.undo_outcome === "reverted"),
	)
})

test("TV Time completion waits for undated episodes, then fills gaps without swallowing approved watches", async () => {
	const { db, id, tracking } = setupUndated(3)
	db.imports[0].source = "tvtime"
	showFixture(db, tracking, 9200)
	db.items[2].kind = "show_status"
	db.items[2].payload = JSON.stringify({
		kind: "show_status",
		title: "TV Time show",
		showStatus: "completed",
		completionScope: "show",
		_previewStatus: null,
	})
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	assert.equal(db.items[2].apply_state, "waiting:undated")
	assert.equal(tracking.log("member").length, 1)
	await decideImport("member", id, "undated", "add")
	await settled(db)
	assert.equal(db.items[1].apply_state, "added")
	assert.equal(db.items[2].apply_state, "added")
	assert.equal(tracking.log("member").length, 3)
	assert.equal(
		tracking.log("member").filter((row) => row.episode_tmdb_id === 9202).length,
		1,
	)
	await undoImport("member", id)
	assert.equal(tracking.log("member").length, 0)
	assert.equal(tracking.state("member", "show", 9200), null)
})

test("per-row undated consent survives a failed watch write and resumes the same journal", async () => {
	const { db, id, tracking } = setupUndated(2)
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	tracking.before = (statement) => {
		if (statement.sql.startsWith("INSERT INTO user_watch_log"))
			throw Error("fixture watch failure")
	}
	await decideImport("member", id, "undated", "add", [0])
	await settled(db)
	assert.equal(db.imports[0].status, "failed")
	assert.equal(JSON.parse(String(db.items[0].payload))._answer.undated, "add")
	assert.equal(db.items[1].apply_state, "waiting:undated")
	tracking.before = undefined
	await decideImport("member", id, "undated", "add", [0])
	await settled(db)
	assert.equal(db.items[0].apply_state, "added")
	assert.equal(db.items[1].apply_state, "waiting:undated")
	assert.equal(db.items.filter((row) => row.kind === "state").length, 1)
})

test("legacy watch dates, journal key and Undo are unchanged without ask", async () => {
	for (const watchDates of ["preserve", "unknown"] as const) {
		const { db, id, tracking } = setupUndated(2)
		db.items[0].payload = JSON.stringify({
			kind: "watch",
			title: "One",
			precision: "day",
			watchedAt: "2020-01-01",
		})
		const legacy = {
			kinds: ["watch"] as ["watch"],
			conflictChoice: "keep" as const,
			watchDates,
		}
		await confirmImport("member", id, legacy)
		await settled(db)
		assert.equal(JSON.parse(String(db.imports[0].options)).ask, undefined)
		assert.deepEqual(
			db.items
				.filter((row) => row.kind === "state")
				.map((row) => row.source_key),
			["state:movie:42"],
		)
		assert.equal(
			tracking.log("member")[0].watched_at_precision,
			watchDates === "preserve" ? "day" : "unknown",
		)
		assert.equal(tracking.log("member")[1].watched_at_precision, "unknown")
		await undoImport("member", id)
		assert.equal(tracking.log("member").length, 0)
	}
})

test("episode-score journals coexist with numbered watch plans for the same show", async () => {
	const { db, id, tracking } = setupUndated(3)
	showFixture(db, tracking, 9300)
	db.items[2].kind = "episode_rating"
	db.items[2].source_key = "score:9303"
	db.items[2].payload = JSON.stringify({
		kind: "episode_rating",
		title: "Scored show",
		scoreScope: "episode",
		score: 8,
		season: 1,
		episode: 3,
		episodeTmdbId: 9303,
	})
	await confirmImport("member", id, {
		...undatedOptions,
		kinds: ["watch", "episode_rating"],
	})
	await settled(db)
	assert.ok(JSON.parse(String(db.items[2].payload)).scoreWatch?.applied)
	assert.equal(tracking.log("member").length, 2)
	await decideImport("member", id, "undated", "add")
	await settled(db)
	assert.equal(tracking.log("member").length, 3)
	assert.deepEqual(
		db.items.filter((row) => row.kind === "state").map((row) => row.source_key),
		["state:show:9300", "state:show:9300#2"],
	)
	await undoImport("member", id)
	assert.equal(tracking.log("member").length, 0)
	assert.equal(tracking.state("member", "show", 9300), null)
})

test("a deferred completion preserves a member edit after the dated pass", async () => {
	const { db, id, tracking } = setupUndated(3)
	showFixture(db, tracking, 9400)
	db.items[2].kind = "show_status"
	db.items[2].payload = JSON.stringify({
		kind: "show_status",
		title: "Edited show",
		showStatus: "completed",
		completionScope: "show",
		_previewStatus: null,
	})
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	const state = tracking.table("user_watch_state")[0]
	state.state = "on_hold"
	state.updated_at = Number(state.updated_at) + 1
	state._seq_no = Number(state._seq_no) + 1
	await decideImport("member", id, "undated", "add")
	await settled(db)
	assert.equal(db.items[2].apply_state, "kept")
	assert.equal(tracking.state("member", "show", 9400)?.state, "on_hold")
	assert.equal(tracking.log("member").length, 2)
})

test("resume finishes an applied plan's observations before journaling newly approved watches", async () => {
	const { db, id, tracking } = setupUndated(2)
	showFixture(db, tracking, 9500)
	const original = db.run.bind(db)
	let fail = true
	db.run = async (sql, params) => {
		if (fail && sql.includes("SET apply_state = ?, watch_id = ?")) {
			fail = false
			throw Error("fixture observation interruption")
		}
		return original(sql, params)
	}
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	assert.equal(db.imports[0].status, "failed")
	assert.equal(
		db.items.find((row) => row.kind === "state")?.apply_state,
		"added",
	)
	await decideImport("member", id, "undated", "add", [1])
	await settled(db)
	assert.equal(db.imports[0].status, "done")
	assert.deepEqual(
		db.items.slice(0, 2).map((row) => row.apply_state),
		["added", "added"],
	)
	assert.equal(tracking.log("member").length, 2)
	assert.deepEqual(
		db.items.filter((row) => row.kind === "state").map((row) => row.source_key),
		["state:show:9500", "state:show:9500#2"],
	)
})

for (const mode of ["duplicate first", "leave all", "episode score"] as const) {
	test(`deferred completion follows prior plans with no state write: ${mode}`, async () => {
		const { db, id, tracking } = setupUndated(4)
		db.imports[0].source = "tvtime"
		showFixture(db, tracking, 9600)
		const status = 3
		db.items[status].kind = "show_status"
		db.items[status].payload = JSON.stringify({
			kind: "show_status",
			title: "TV Time show",
			showStatus: "completed",
			completionScope: "show",
			_previewStatus: null,
		})
		if (mode === "duplicate first") {
			const duplicate = JSON.parse(String(db.items[1].payload))
			db.items[1].payload = JSON.stringify({
				...duplicate,
				episodeTmdbId: 9601,
				episode: 1,
			})
			const second = JSON.parse(String(db.items[2].payload))
			db.items[2].payload = JSON.stringify({
				...second,
				episodeTmdbId: 9602,
				episode: 2,
			})
		}
		if (mode === "episode score") {
			db.items[2].kind = "episode_rating"
			db.items[2].payload = JSON.stringify({
				kind: "episode_rating",
				title: "TV Time show",
				scoreScope: "episode",
				score: 8,
				season: 1,
				episode: 1,
				episodeTmdbId: 9601,
			})
		}
		await confirmImport("member", id, {
			...undatedOptions,
			kinds: [...undatedOptions.kinds, "episode_rating"],
		})
		await settled(db)
		if (mode === "duplicate first") {
			await decideImport("member", id, "undated", "add", [1])
			await settled(db)
			assert.equal(db.items[1].apply_state, "kept")
			const noWrite = JSON.parse(
				String(
					db.items.find((r) => r.source_key === "state:show:9600#2")?.payload,
				),
			)
			assert.equal(noWrite.watches.length, 0)
			assert.equal(
				tracking.state("member", "show", 9600)?.updated_at,
				noWrite.beforeState.updated_at,
			)
			await decideImport("member", id, "undated", "add", [2])
		} else {
			if (mode === "episode score") {
				// A resumed episode-score journal can have no remaining writes after deduplication.
				const writer = await import("./tracking.server.ts")
				const dated = (await itemRows("member", id))[0]
				const plan = await writer.prepareImportTrackingPlan({
					userId: "member",
					importId: id,
					source: "tvtime",
					tmdbId: 9600,
					mediaType: "show",
					items: [
						{
							...dated,
							key: "episode-score:9600:9601",
							precision: "unknown",
							watchedAt: null,
						},
					],
					watchDates: "unknown",
					onlyUnwatched: true,
					now: Number(tracking.state("member", "show", 9600)?.updated_at) + 1,
				})
				await writer.applyImportTrackingPlan("member", plan)
				const journal = { plan, applied: true }
				db.items[2].payload = JSON.stringify({
					...JSON.parse(String(db.items[2].payload)),
					scoreWatch: journal,
				})
				assert.equal(plan.watches.length, 0)
				assert.ok(journal?.applied)
				assert.deepEqual(
					journal.plan.afterState,
					Object.fromEntries(
						Object.keys(journal.plan.afterState).map((key) => [
							key,
							journal.plan.beforeState[key],
						]),
					),
				)
				assert.equal(
					journal.plan.beforeState.updated_at,
					tracking.state("member", "show", 9600)?.updated_at,
				)
			}
			const decision = await decideImport(
				"member",
				id,
				"undated",
				mode === "leave all" ? "leave" : "add",
			)
			assert.equal(decision.decided, mode === "leave all" ? 2 : 1)
		}
		await settled(db)
		assert.equal(db.imports[0].status, "done")
		assert.equal(db.items[status].apply_state, "added")
		assert.equal(tracking.state("member", "show", 9600)?.state, "seen")
		assert.equal(tracking.log("member").length, 3)
		if (mode === "leave all") {
			assert.ok(db.items.find((r) => r.source_key === "state:show:9600#2"))
			assert.equal(db.items[1].apply_state, "kept")
		}
	})
}

test("an approved dependent that still hits a hold gate is kept and the run finishes", async () => {
	const { db, id } = setupUndated(2)
	db.items[1].kind = "want"
	db.items[1].payload = JSON.stringify({ kind: "want", title: "One" })
	await confirmImport("member", id, undatedOptions)
	await settled(db)
	// Simulate an inconsistent approval while its sibling is unanswered.
	db.items[1].apply_state = "approved:undated"
	await decideImport("member", id, "undated", "add", [1])
	await settled(db)
	assert.equal(db.imports[0].status, "done")
	assert.equal(db.items[0].apply_state, "waiting:undated")
	assert.equal(db.items[1].apply_state, "kept")
	assert.match(
		String(db.items[1].reason),
		/another import question is still waiting/,
	)
})
