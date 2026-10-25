import assert from "node:assert/strict"
import { test } from "node:test"
import {
	trustedAccount,
	mapCorrection,
	correctionKey,
	feedbackStaff,
	type Correction,
} from "./corrections.ts"
import { feedbackSchema, type FeedbackInput } from "./schema.ts"
import { applyCorrectionRows } from "./apply-corrections.ts"
import {
	correctionsFor,
	createCorrectionReader,
} from "./apply-corrections.server.ts"
import { createCorrectionStore, type Sql } from "./correction-store.server.ts"
import { undoCorrection } from "./undo.server.ts"
import { reviewInteraction } from "./review.server.ts"
import { reviewButtons } from "./review-buttons.ts"
import { correctedAvailability } from "./availability-corrections.server.ts"
const id = "a".repeat(64)
const data = (
	area: string,
	problem: string,
	target: NonNullable<FeedbackInput["data"]>["target"] = {},
): NonNullable<FeedbackInput["data"]> => ({
	entityKind: "show",
	ids: { tmdbId: 1 },
	field: "display",
	area,
	problem,
	target,
	suggestedValue: "New",
	currentValue: "Old",
})
function correction(overrides: Partial<Correction> = {}): Correction {
	return {
		id,
		entity_kind: "show",
		tmdb_id: 1,
		target: {},
		field: "first_air_date",
		op: "set",
		value: "2025-01-02",
		old_value: "2020-01-01",
		status: "live",
		member_id: "member",
		reviewer: null,
		report_id: id,
		source_link: null,
		created_at: 1,
		updated_at: 2,
		...overrides,
	}
}
test("trust requires identity and age, kept corrections, or staff", () => {
	const now = 1000 * 86400000
	assert.equal(trustedAccount(null, { staff: true, kept: 3 }, now), false)
	assert.equal(
		trustedAccount("m", { createdAt: now - 90 * 86400000 }, now),
		true,
	)
	assert.equal(
		trustedAccount("m", { createdAt: now - 90 * 86400000 + 1, kept: 2 }, now),
		false,
	)
	assert.equal(trustedAccount("m", { kept: 3 }, now), true)
	assert.equal(trustedAccount("m", { staff: true }, now), true)
})
test("only the nine contract problems map, with required targets and full dates", () => {
	const cases: [
		string,
		string,
		NonNullable<FeedbackInput["data"]>["target"],
		string,
		string,
		boolean,
	][] = [
		["details", "date", {}, "first_air_date", "set", false],
		[
			"episodes",
			"ep-title",
			{ seasonNumber: 1, episodeNumber: 2 },
			"name",
			"set",
			false,
		],
		[
			"episodes",
			"ep-date",
			{ seasonNumber: 1, episodeNumber: 2 },
			"air_date",
			"set",
			false,
		],
		["cast", "character", { personId: 2 }, "character", "set", false],
		["cast", "not-in-it", { personId: 2 }, "character", "remove", true],
		[
			"credits",
			"role",
			{ creditTmdbId: 2, creditMediaType: "tv" },
			"role",
			"set",
			false,
		],
		[
			"credits",
			"not-theirs",
			{ creditTmdbId: 2, creditMediaType: "tv" },
			"role",
			"remove",
			true,
		],
		[
			"watch",
			"not-there",
			{ providerId: 2, offerType: "ads", country: "DE" },
			"offer",
			"remove",
			false,
		],
		[
			"watch",
			"missing",
			{ providerId: 2, offerType: "ads", country: "DE" },
			"offer",
			"add",
			true,
		],
	]
	for (const [area, problem, target, field, op, review] of cases) {
		const d = data(area, problem, target)
		if (area === "credits") d.entityKind = "person"
		if (field.endsWith("date")) d.suggestedValue = "2025-02-28"
		const mapped = mapCorrection(d)
		assert.deepEqual(
			[mapped?.field, mapped?.op, mapped?.review],
			[field, op, review],
		)
		assert.equal(mapCorrection({ ...d, problem: "other" }), null)
	}
	assert.equal(mapCorrection(data("episodes", "ep-title")), null)
	assert.equal(
		mapCorrection({ ...data("details", "date"), suggestedValue: "2025-02-30" }),
		null,
	)
	assert.equal(
		mapCorrection({ ...data("details", "date"), suggestedValue: "2025" }),
		null,
	)
	assert.equal(
		mapCorrection({ ...data("details", "date"), entityKind: "person" }),
		null,
	)
	const added = data("watch", "missing", {
		providerId: 2,
		offerType: "free",
		country: "US",
	})
	assert.equal(
		mapCorrection({ ...added, sourceLink: "https://example.com" })?.review,
		false,
	)
	assert.equal(mapCorrection(data("scores", "date")), null)
})
test("targets are strict and bounded, old data reports still validate", () => {
	const base = {
		kind: "data",
		message: "Correction",
		website: "",
		startedAt: 1,
		idempotencyKey: "6bc17f0f-6708-46b1-a080-8c7ee8862ef1",
		data: data("cast", "character", { personId: 3 }),
	}
	assert.equal(feedbackSchema.safeParse(base).success, true)
	for (const target of [
		{ personId: -1 },
		{ unexpected: 1 },
		{ country: "de" },
		{ offerType: "paid" },
		{ seasonNumber: 10001 },
	])
		assert.equal(
			feedbackSchema.safeParse({ ...base, data: { ...base.data, target } })
				.success,
			false,
		)
	assert.equal(
		feedbackSchema.safeParse({
			...base,
			data: { ...base.data, note: "x".repeat(2001) },
		}).success,
		false,
	)
	assert.equal(
		feedbackSchema.safeParse({
			...base,
			data: { entityKind: "movie", ids: { tmdbId: 1 }, field: "title" },
		}).success,
		true,
	)
})
test("field identity ignores unrelated target input and key order", () => {
	const a = mapCorrection(
		data("cast", "character", { personId: 2, country: "DE" }),
	)!
	const b = mapCorrection(data("cast", "character", { personId: 2 }))!
	assert.equal(correctionKey(a), correctionKey(b))
})
test("details overlay changes dates and exact country offer types, adds service metadata, copies input", () => {
	const source = {
		details: { first_air_date: 1, release_year: 2020 },
		streaming_availabilities: [
			{ streaming_service_id: 3, streaming_type: "ads" },
			{ streaming_service_id: 3, streaming_type: "buy" },
		],
		streaming_countries: [
			{ country_code: "DE", streaming_service_id: 3, streaming_type: "ads" },
			{ country_code: "US", streaming_service_id: 3, streaming_type: "ads" },
		],
		streaming_services: [],
	}
	const remove = correction({
		field: "offer",
		op: "remove",
		target: { providerId: 3, offerType: "ads", country: "DE" },
	})
	const add = correction({
		field: "offer",
		op: "add",
		target: { providerId: 4, offerType: "free", country: "DE" },
		provider_name: "Service",
		provider_logo: "logo",
		source_link: "https://example.com",
	})
	const result = applyCorrectionRows(
		{ kind: "show", id: 1, country: "DE" },
		source,
		[correction(), remove, add],
	)
	assert.equal(result.details.first_air_date, "2025-01-02")
	assert.equal(result.details.release_year, 2025)
	assert.deepEqual(
		result.streaming_availabilities.map((x) => [
			x.streaming_service_id,
			x.streaming_type,
		]),
		[
			[3, "buy"],
			[4, "free"],
		],
	)
	assert.equal(result.streaming_countries[0].country_code, "US")
	assert.equal((result.streaming_services[0] as any).name, "Service")
	assert.equal(source.streaming_availabilities.length, 2)
})
test("cast and person credits apply both directions and remove credit membership", () => {
	const c = correction({
		field: "character",
		target: { personId: 2 },
		value: "Correct",
	})
	assert.equal(
		applyCorrectionRows(
			{ kind: "show", id: 1 },
			[{ id: 2, character: "Old" }],
			[c],
		)[0].character,
		"Correct",
	)
	const credit = {
		tmdb_id: 1,
		media_type: "show",
		characters: ["Old"],
		jobs: [],
	}
	assert.deepEqual(
		applyCorrectionRows({ kind: "person", id: 2 }, [credit], [c])[0].characters,
		["Correct"],
	)
	assert.deepEqual(
		applyCorrectionRows(
			{ kind: "show", id: 1 },
			[{ id: 2 }],
			[{ ...c, op: "remove" }],
		),
		[],
	)
	assert.deepEqual(
		applyCorrectionRows(
			{ kind: "person", id: 2 },
			[credit],
			[{ ...c, op: "remove" }],
		),
		[],
	)
	const role = correction({
		entity_kind: "person",
		tmdb_id: 2,
		field: "role",
		target: { creditTmdbId: 1, creditMediaType: "tv" },
		value: "Producer",
		old_value: "Director",
	})
	assert.deepEqual(
		applyCorrectionRows(
			{ kind: "person", id: 2 },
			[{ ...credit, characters: [], jobs: ["Director"] }],
			[role],
		)[0].jobs,
		["Producer"],
	)
	assert.equal(
		applyCorrectionRows(
			{ kind: "show", id: 1 },
			[{ id: 2, job: "Director" }],
			[role],
		)[0].job,
		"Producer",
	)
})
test("episode list, presentation and mapped translated grid use canonical numbers", () => {
	const c = correction({
		field: "name",
		target: { seasonNumber: 2, episodeNumber: 4 },
		value: "Correct",
	})
	const date = { ...c, field: "air_date", value: "2025-01-01" }
	assert.equal(
		applyCorrectionRows(
			{ kind: "show", id: 1 },
			[{ season_number: 2, episode_number: 4, name: "Old", air_date: 1 }],
			[c, date],
		)[0].air_date,
		Date.parse("2025-01-01"),
	)
	assert.equal(
		applyCorrectionRows(
			{ kind: "show", id: 1 },
			{ episodes: [{ season: 2, number: 4, name: "Old", airDate: 1 }] },
			[c],
		).episodes[0].name,
		"Correct",
	)
	const grid = {
		seasons: [
			{
				number: 1,
				episodes: [
					{
						number: 20,
						canonicalSeason: 2,
						canonicalNumber: 4,
						name: "Translated",
					},
				],
			},
		],
	}
	assert.equal(
		applyCorrectionRows({ kind: "show", id: 1 }, grid, [c]).seasons[0]
			.episodes[0].name,
		"Correct",
	)
	assert.equal(
		applyCorrectionRows({ kind: "show", id: 1 }, grid, [
			{ ...c, status: "reverted" },
		]).seasons[0].episodes[0].name,
		"Translated",
	)
})
test("reader shares one snapshot of live corrections across pages and backs off missing tables", async () => {
	let calls = 0,
		time = 0
	const reader = createCorrectionReader(
		async () => {
			calls++
			return { rowcount: 0, json: [] }
		},
		() => time,
	)
	await Promise.all([
		reader.apply({ kind: "show", id: 1 }, []),
		reader.apply({ kind: "show", id: 1 }, {}),
	])
	assert.equal(calls, 1)
	await reader.apply({ kind: "show", id: 1 }, [])
	await reader.apply({ kind: "movie", id: 7 }, [])
	await reader.apply({ kind: "person", id: 9 }, [])
	assert.equal(calls, 1)
	time = 5001
	await reader.apply({ kind: "show", id: 1 }, [])
	assert.equal(calls, 2)
	calls = 0
	const missing = createCorrectionReader(
		async () => {
			calls++
			throw new Error("RelationUnknown")
		},
		() => time,
	)
	await missing.apply({ kind: "show", id: 1 }, [])
	await missing.apply({ kind: "show", id: 2 }, [])
	assert.equal(calls, 1)
})
test("undo rejects guests, cross origin, and another member before any transition", async () => {
	let calls = 0
	const deps = {
		memberId: async () => null as string | null,
		decide: async () => {
			calls++
			return correction({ status: "reverted" })
		},
	}
	const request = (origin = "https://goodwatch.app") =>
		new Request("https://goodwatch.app/api/feedback/corrections/x/undo", {
			method: "POST",
			headers: { origin },
		})
	assert.equal((await undoCorrection(request(), id, deps)).status, 403)
	deps.memberId = async () => "member"
	assert.equal(
		(await undoCorrection(request("https://other.app"), id, deps)).status,
		403,
	)
	assert.equal(calls, 0)
	const response = await undoCorrection(request(), id, deps)
	assert.deepEqual(await response.json(), { status: "reverted" })
	const c = correction()
	const store = createCorrectionStore(async (sql) => ({
		rowcount: 1,
		json: sql.startsWith("SELECT")
			? [
					{
						...c,
						value: JSON.stringify(c.value),
						old_value: JSON.stringify(c.old_value),
						_version: 1,
					},
				]
			: [],
	}))
	await assert.rejects(
		store.decide(id, "undo", "other", true),
		(e: any) => e.status === 403,
	)
})
test("review uses explicit staff users or roles, never Discord administrative permissions", async () => {
	const env = {
		DISCORD_FEEDBACK_STAFF_USER_IDS: "staff",
		DISCORD_FEEDBACK_STAFF_ROLE_IDS: "reviewers",
	}
	assert.equal(feedbackStaff("staff", [], env), true)
	assert.equal(feedbackStaff("u", ["reviewers"], env), true)
	assert.equal(feedbackStaff("u", [], env), false)
	let calls = 0
	const deps = {
		env,
		decide: async () => {
			calls++
			return correction({ status: "live" })
		},
	}
	const i = {
		type: 3,
		data: { custom_id: `feedback:approve:${id}` },
		member: { user: { id: "u" }, permissions: "8" },
	}
	assert.equal((await reviewInteraction(i, deps)).type, 4)
	assert.equal(calls, 0)
	assert.equal(
		(
			await reviewInteraction(
				{ ...i, member: { user: { id: "u" }, roles: ["reviewers"] } },
				deps,
			)
		).type,
		7,
	)
	assert.deepEqual(
		reviewButtons(correction()).components.map((x) => x.label),
		["Approve", "Reject", "Revert"],
	)
})
test("country index keeps another offer type after removal", async () => {
	const c = correction({
		field: "offer",
		op: "remove",
		target: { providerId: 3, offerType: "ads", country: "DE" },
	})
	const run: Sql = async (sql) => ({
		rowcount: 1,
		json: sql.includes("catalog_correction")
			? [c]
			: [
					{
						media_type: "show",
						media_tmdb_id: 1,
						streaming_service_id: 3,
						streaming_type: "ads",
					},
					{
						media_type: "show",
						media_tmdb_id: 1,
						streaming_service_id: 3,
						streaming_type: "flatrate",
					},
				],
	})
	assert.deepEqual(await correctedAvailability("DE", [["show", 1, [3]]], run), [
		["show", 1, [3]],
	])
})

function ledgerFixture() {
	const rows = new Map<string, any>(),
		events: string[] = [],
		reports = new Map<string, any>()
	let invalidations = 0,
		conflict = false
	const run: Sql = async (sql, args) => {
		if (sql.startsWith("REFRESH")) return { rowcount: 0 }
		if (sql.startsWith("INSERT INTO doc.catalog_correction_event")) {
			events.push(String(args[2]))
			return { rowcount: 1 }
		}
		if (sql.startsWith("SELECT id FROM doc.catalog_correction_event"))
			return { rowcount: 0, json: [] }
		if (sql.startsWith("INSERT INTO doc.catalog_correction (id, status)")) {
			if (rows.has(String(args[0]))) return { rowcount: 0 }
			rows.set(String(args[0]), {
				id: args[0],
				status: "withdrawn",
				created_at: args[1],
				_version: 1,
			})
			return { rowcount: 1 }
		}
		if (sql.startsWith("SELECT created_at, _version"))
			return {
				rowcount: 1,
				json: rows.has(String(args[0])) ? [rows.get(String(args[0]))] : [],
			}
		if (sql.startsWith("INSERT INTO doc.catalog_correction (")) {
			const columns = sql.match(/\(([^)]+)\)/)![1].split(",")
			const row = Object.fromEntries(columns.map((k, i) => [k, args[i]]))
			if (rows.has(String(row.id))) return { rowcount: 0 }
			rows.set(String(row.id), { ...row, _version: 1 })
			return { rowcount: 1 }
		}
		if (sql.startsWith("DELETE")) {
			rows.delete(String(args[0]))
			return { rowcount: 1 }
		}
		if (sql.startsWith("SELECT *, _version"))
			return {
				rowcount: 1,
				json: rows.has(String(args[0]))
					? [{ ...rows.get(String(args[0])) }]
					: [],
			}
		if (sql.startsWith("SELECT id, target, field"))
			return {
				rowcount: 0,
				json: [...rows.values()].filter(
					(c) =>
						c.entity_kind === args[0] &&
						c.tmdb_id === args[1] &&
						c.status === "live",
				),
			}
		if (sql.startsWith("UPDATE doc.catalog_correction SET status = 'live'")) {
			const r = rows.get(String(args[1]))
			if (r.status !== "pending") return { rowcount: 0 }
			r.status = "live"
			r._version++
			return { rowcount: 1 }
		}
		if (sql.startsWith("UPDATE doc.catalog_correction SET status = ?")) {
			const r = rows.get(String(args[3]))
			if (conflict || r._version !== args[4]) return { rowcount: 0 }
			r.status = args[0]
			r.reviewer = args[1]
			r._version++
			return { rowcount: 1 }
		}
		if (sql.startsWith("UPDATE doc.feedback_report SET correction_id")) {
			reports.set(String(args[1]), { correction_id: args[0] })
			return { rowcount: 1 }
		}
		if (sql.startsWith("UPDATE doc.feedback_report")) return { rowcount: 1 }
		if (sql.startsWith("SELECT correction_id"))
			return { rowcount: 1, json: [reports.get(String(args[0]))] }
		throw new Error(`Unhandled SQL ${sql}`)
	}
	const store = createCorrectionStore(run, async () => {
		invalidations++
	})
	const report = (
		reportId: string,
		d = data("cast", "character", { personId: 2 }),
	) => ({
		id: reportId,
		kind: "data" as const,
		message: "Correct",
		data: d,
		metadata: {},
		memberId: "member",
		createdAt: 1,
		updatedAt: null,
		handledBy: null,
		correctionId: null,
		status: "new" as const,
		dedupeKey: null,
		duplicateCount: 1,
		hasScreenshot: false,
	})
	return {
		store,
		rows,
		events,
		report,
		invalidations: () => invalidations,
		conflict: () => {
			conflict = true
		},
	}
}
test("submission serializes live fields; competing submissions stay pending; approvals use versions", async () => {
	const f = ledgerFixture()
	assert.equal((await f.store.submit(f.report(id), true))?.status, "live")
	const second = "b".repeat(64)
	assert.equal(
		(await f.store.submit(f.report(second), true))?.status,
		"pending",
	)
	await assert.rejects(
		f.store.decide(second, "approve", "staff"),
		(e: any) => e.status === 409,
	)
	assert.deepEqual(await f.store.response(id), {
		reportId: id,
		outcome: "live",
		correctionId: id,
	})
	assert.equal(
		(await f.store.decide(id, "undo", "member", true)).status,
		"reverted",
	)
	assert.equal(
		(await f.store.decide(second, "approve", "staff")).status,
		"live",
	)
	assert.equal(f.events.filter((x) => x === "submitted").length, 2)
	assert.ok(f.events.includes("undo"))
	assert.ok(f.events.includes("approve"))
	assert.equal(f.invalidations(), 3)
	assert.equal(
		[...f.rows.keys()].some((k) => k.startsWith("lock:")),
		false,
	)
	const pending = "c".repeat(64)
	await f.store.submit(
		f.report(pending, data("cast", "character", { personId: 3 })),
		false,
	)
	f.conflict()
	await assert.rejects(
		f.store.decide(pending, "approve", "staff"),
		(e: any) => e.status === 409,
	)
	assert.equal(f.rows.get(pending).status, "pending")
})
test("pending undo withdraws, Something else has no row, and additions need evidence for approval", async () => {
	const f = ledgerFixture()
	assert.equal(
		await f.store.submit(f.report(id, data("cast", "other")), true),
		null,
	)
	assert.equal(f.rows.size, 0)
	await f.store.submit(f.report(id), false)
	assert.equal(
		(await f.store.decide(id, "undo", "member", true)).status,
		"withdrawn",
	)
	const d = data("watch", "missing", {
		providerId: 2,
		offerType: "free",
		country: "DE",
	})
	const next = "b".repeat(64)
	assert.equal(
		(await f.store.submit(f.report(next, d), true))?.status,
		"pending",
	)
	await assert.rejects(
		f.store.decide(next, "approve", "staff"),
		(e: any) => e.status === 409,
	)
})

test("translated episode lists retain day strings and canonical language provenance", () => {
	const row = {
		season: 2,
		number: 4,
		name: "Translated",
		airDate: null,
		textPresentation: {
			name: { language: "ja", source: "localized", fallback: false },
		},
	}
	const c = correction({
		field: "name",
		target: { seasonNumber: 2, episodeNumber: 4 },
		value: "Correct",
	})
	const [result] = applyCorrectionRows(
		{ kind: "show", id: 1 },
		[row],
		[c, { ...c, field: "air_date", value: "2025-01-01" }],
	)
	assert.equal(result.airDate, "2025-01-01")
	assert.equal(result.textPresentation.name.source, "canonical")
})
test("a lock left by a dead process is taken over after a minute, a fresh one is not", async () => {
	const f = ledgerFixture()
	const lockId = `lock:${correctionKey(
		correction({ field: "character", target: { personId: 2 } }),
	)}`
	f.rows.set(lockId, {
		id: lockId,
		status: "withdrawn",
		created_at: Date.now() - 5000,
		_version: 1,
	})
	assert.equal((await f.store.submit(f.report(id), true))?.status, "pending")
	f.rows.delete(id)
	f.rows.get(lockId).created_at = Date.now() - 120000
	assert.equal((await f.store.submit(f.report(id), true))?.status, "live")
	assert.equal(f.rows.has(lockId), false)
})
test("cast page and trimmed details shapes take corrections without crashing", () => {
	const removal = correction({
		field: "character",
		op: "remove",
		target: { personId: 2 },
	})
	const role = correction({
		entity_kind: "person",
		tmdb_id: 3,
		field: "role",
		target: { creditTmdbId: 1, creditMediaType: "tv" },
		value: "Producer",
		old_value: "Director",
	})
	const page = applyCorrectionRows(
		{ kind: "show", id: 1 },
		{
			cast: [
				{ id: 2, name: "Gone", characters: ["X"], profile_path: "p" },
				{ id: 3, name: "Stays", characters: ["Y"], profile_path: "p" },
			],
			total: 40,
			offset: 0,
			nextOffset: 20,
		},
		[removal, role],
	)
	assert.deepEqual(
		page.cast.map((m) => [m.id, m.characters]),
		[[3, ["Producer"]]],
	)
	assert.equal(page.total, 39)
	const add = correction({
		field: "offer",
		op: "add",
		target: { providerId: 4, offerType: "free", country: "DE" },
		provider_name: "Service",
		source_link: "https://example.com/evidence",
	})
	const trimmed = applyCorrectionRows(
		{ kind: "show", id: 1, country: "DE" },
		{
			details: { tmdb_id: 1, first_air_date: "2020-01-01" },
			cast: [{ id: 2, name: "Gone", characters: ["X"], profile_path: "p" }],
			cast_total: 1,
			streaming_availabilities: [] as { stream_url: string | null }[],
			streaming_services: [] as { name: string }[],
			streaming_countries: { top: {}, count: 0 },
		},
		[removal, add],
	)
	assert.equal(trimmed.cast.length, 0)
	assert.equal(trimmed.cast_total, 0)
	assert.deepEqual(trimmed.streaming_countries, { top: {}, count: 0 })
	// The member's evidence link never becomes the watch link.
	assert.equal(trimmed.streaming_availabilities[0].stream_url, null)
	assert.equal(trimmed.streaming_services[0].name, "Service")
})
test("a correction reset matches only the named entities' pages", async () => {
	const { resetMatcher } = await import("./cache-revision.server.ts")
	const match = resetMatcher(["/movie/603", "/person/6384"])
	assert.equal(match("/movie/603"), true)
	assert.equal(match("/movie/603-the-matrix"), true)
	assert.equal(match("/movie/603/cast"), true)
	assert.equal(match("/movie/603?tab=cast"), true)
	assert.equal(match("/movie/6030"), false)
	assert.equal(match("/show/603"), false)
	assert.equal(match("/person/6384-keanu-reeves"), true)
})
test("the shared snapshot picks only the corrections that touch the page's entity", () => {
	const base = correction({ status: "live" })
	const all = [
		{ ...base, id: "a", entity_kind: "show" as const, tmdb_id: 1, target: {} },
		{ ...base, id: "b", entity_kind: "movie" as const, tmdb_id: 1, target: {} },
		{ ...base, id: "c", entity_kind: "person" as const, tmdb_id: 5, target: { creditTmdbId: 1, creditMediaType: "tv" as const } },
		{ ...base, id: "d", entity_kind: "show" as const, tmdb_id: 2, target: { personId: 5 } },
	]
	assert.deepEqual(correctionsFor({ kind: "show", id: 1 }, all).map((c) => c.id), ["a", "c"])
	assert.deepEqual(correctionsFor({ kind: "movie", id: 1 }, all).map((c) => c.id), ["b"])
	assert.deepEqual(correctionsFor({ kind: "person", id: 5 }, all).map((c) => c.id), ["c", "d"])
})
