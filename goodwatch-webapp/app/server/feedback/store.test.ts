import assert from "node:assert/strict"
import { test } from "node:test"
import type { Report } from "./handler.server.ts"
import { readScreenshot } from "./handler.server.ts"
import { createFeedbackStore } from "./store.server.ts"

const report: Report = {
	id: "a".repeat(64),
	kind: "data",
	message: "Wrong title",
	metadata: {},
	memberId: null,
	createdAt: 1800000000000,
	updatedAt: null,
	handledBy: null,
	correctionId: null,
	status: "new",
	dedupeKey: "b".repeat(64),
	duplicateCount: 1,
	hasScreenshot: false,
}
const candidate = (status = "new") => ({
	id: "c".repeat(64),
	status,
	duplicate_count: 2,
	discord_thread_id: "456",
	metadata: { url: "/movie/1" },
	_version: 7,
})

test("dedupe miss inserts the new model without screenshot bytes or a correction write", async () => {
	const calls: { sql: string; params: unknown[] }[] = []
	const store = createFeedbackStore(async (sql, params) => {
		calls.push({ sql, params })
		return { rowcount: sql.startsWith("INSERT") ? 1 : 0, json: [] }
	})
	assert.deepEqual(await store.insert(report), {
		kind: "new",
		reportId: report.id,
	})
	assert.equal(calls[0].sql, "REFRESH TABLE doc.feedback_report")
	const insert = calls.at(-1)!
	assert.match(
		insert.sql,
		/dedupe_key, duplicate_count, updated_at, handled_by/,
	)
	assert.match(insert.sql, /has_screenshot/)
	assert.doesNotMatch(insert.sql, /correction_id|\bscreenshot\b/)
	assert.deepEqual(insert.params.slice(-4), [report.dedupeKey, 1, null, null])
})

test("only open statuses merge and the version guards count and triage changes", async () => {
	for (const status of [
		"new",
		"in_progress",
		"done",
		"wont_fix",
		"duplicate",
	]) {
		const calls: { sql: string; params: unknown[] }[] = []
		const row = candidate(status)
		const store = createFeedbackStore(async (sql, params) => {
			calls.push({ sql, params })
			return {
				rowcount: 1,
				json: sql.startsWith("SELECT id, status") ? [row] : [],
			}
		})
		const result = await store.insert(report)
		const open = status === "new" || status === "in_progress"
		assert.equal(result.kind, open ? "duplicate" : "new")
		const updates = calls.filter((call) => call.sql.startsWith("UPDATE"))
		assert.equal(updates.length, open ? 1 : 0)
		if (open) {
			assert.deepEqual(result, {
				kind: "duplicate",
				reportId: row.id,
				count: 3,
				threadId: "456",
				retry: false,
			})
			assert.match(updates[0].sql, /duplicate_count = duplicate_count \+ 1/)
			assert.match(updates[0].sql, /WHERE id = \? AND _version = \?/)
			assert.deepEqual(updates[0].params, [
				report.createdAt,
				{ url: "/movie/1", feedbackSubmissionIds: [report.id] },
				row.id,
				7,
			])
			assert.ok(!calls.some((call) => call.sql.startsWith("INSERT")))
		}
	}
})

test("a version conflict refreshes and retries with the latest count", async () => {
	let updates = 0
	const store = createFeedbackStore(async (sql) => {
		if (sql.startsWith("UPDATE")) return { rowcount: ++updates === 1 ? 0 : 1 }
		return {
			rowcount: 0,
			json: sql.startsWith("SELECT id, status")
				? [
						{
							...candidate(),
							duplicate_count: 2 + updates,
							_version: 7 + updates,
						},
					]
				: [],
		}
	})
	assert.deepEqual(await store.insert(report), {
		kind: "duplicate",
		reportId: candidate().id,
		count: 4,
		threadId: "456",
		retry: false,
	})
	assert.equal(updates, 2)
})

test("both original and merged retries skip writes even after triage closes the report", async () => {
	for (const original of [true, false]) {
		const store = createFeedbackStore(async (sql) => {
			assert.ok(!sql.startsWith("INSERT") && !sql.startsWith("UPDATE"))
			return {
				rowcount: 0,
				json: original
					? sql === "SELECT id FROM doc.feedback_report WHERE id = ?"
						? [{ id: report.id }]
						: []
					: sql.startsWith("SELECT id, status")
						? [
								{
									...candidate("done"),
									metadata: { feedbackSubmissionIds: [report.id] },
								},
							]
						: [],
			}
		})
		const result = await store.insert(report)
		assert.equal(result.kind, original ? "retry" : "duplicate")
		if (result.kind === "duplicate") assert.equal(result.retry, true)
	}
})

test("non-data insertion stores a null key without a dedupe search; invalid statuses fail validation", async () => {
	const calls: string[] = []
	const store = createFeedbackStore(async (sql, params) => {
		calls.push(sql)
		assert.equal(params.at(-4), null)
		return { rowcount: 1 }
	})
	await store.insert({ ...report, kind: "bug", dedupeKey: null })
	assert.equal(calls.length, 1)
	await assert.rejects(
		store.insert({
			...report,
			dedupeKey: null,
			status: "closed" as Report["status"],
		}),
	)
})

test("screenshot writes its table then marks the report; route reads the separate table", async () => {
	const calls: { sql: string; params: unknown[] }[] = []
	const screenshot = {
		data: Buffer.from("webp bytes").toString("base64"),
		contentType: "image/webp",
		bytes: 10,
		createdAt: report.createdAt,
	}
	const store = createFeedbackStore(async (sql, params) => {
		calls.push({ sql, params })
		return {
			rowcount: 1,
			json: sql.startsWith("SELECT")
				? [
						{
							data: screenshot.data,
							content_type: screenshot.contentType,
							bytes: 10,
							created_at: report.createdAt,
						},
					]
				: [],
		}
	})
	await store.storeScreenshot(report.id, screenshot)
	assert.match(calls[0].sql, /^INSERT INTO doc.feedback_screenshot/)
	assert.deepEqual(calls[0].params, [
		report.id,
		screenshot.data,
		"image/webp",
		10,
		report.createdAt,
	])
	assert.match(calls[1].sql, /SET has_screenshot = true/)
	const response = await readScreenshot(report.id, true, store)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("content-type"), "image/webp")
	assert.equal(await response.text(), "webp bytes")
	assert.match(
		calls[2].sql,
		/FROM doc.feedback_screenshot WHERE report_id = \?/,
	)
})

test("failed screenshot insert leaves has_screenshot false", async () => {
	let calls = 0
	const store = createFeedbackStore(async (sql) => {
		calls++
		assert.match(sql, /^INSERT INTO doc.feedback_screenshot/)
		throw new Error("RelationUnknown doc.feedback_screenshot")
	})
	await assert.rejects(
		store.storeScreenshot(report.id, {
			data: "",
			contentType: "image/webp",
			bytes: 0,
			createdAt: report.createdAt,
		}),
	)
	assert.equal(calls, 1)
})
