import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { afterEach, test } from "node:test"
import type { ImportOptions } from "../../domain/imports.ts"
import { FakeTrackingCrate } from "../tracking-fake-crate.ts"
import { ImportDb } from "./import-db.test-support.ts"

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
		{ question: "conflict", answer: "source", rows: Array(501).fill(0) },
		{ question: "conflict", answer: "keep", extra: true },
	])
		assert.equal((await send(decide, body)).status, 400)
	for (const body of [
		{ ...options, ask: ["rewatch"] },
		{ ...options, answers: { conflict: "source" } },
	])
		assert.equal((await send(confirm, body)).status, 400)
	assert.equal((await send(confirm, options)).status, 200)
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
	assert.equal((await load("waiting=undated")).status, 400)
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
		await flushProductEvents()
		const completed = events.filter(
			(event) => event.event === "import completed",
		)
		assert.ok(completed.length >= 2)
		assert.equal(new Set(completed.map((event) => event.uuid)).size, 1)
		const answered = events.filter(
			(event) => event.event === "import question answered",
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
