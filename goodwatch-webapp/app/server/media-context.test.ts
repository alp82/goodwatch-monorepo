import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import ts from "typescript"
import "@remix-run/node"
import "react"
import "@tanstack/react-query"
import "./title-filter/test-alias.ts"
import {
	parseLocalizationCookie,
	serializeLocalizationCookie,
	type LocalizationRecord,
} from "../utils/media-language.ts"

// The same Node loader hooks used by neighbouring tests; no service credentials or live backend.
const db = {
	rows: new Map<string, string>(),
	writes: [] as { key: string; value: string }[],
	fail: false,
	preferenceReads: 0,
	failRefresh: false,
	failWriteAfterLanding: false,
}
const crateMock = {
	query: async (_sql: string, params: (string | number)[]) => {
		if (params.length === 2) {
			db.preferenceReads++
			const value = db.rows.get(String(params[1]))
			return value === undefined
				? []
				: [{ value, seq_no: db.writes.length, primary_term: 1 }]
		}
		return [...db.rows].map(([key, value]) => ({ key, value }))
	},
	upsert: async ({
		data,
		ignoreUpdate,
	}: { data: { key: string; value: string }[]; ignoreUpdate?: boolean }) => {
		if (db.fail) throw new Error("refused")
		for (const row of data) {
			if (ignoreUpdate && db.rows.has(row.key)) continue
			db.rows.set(row.key, row.value)
			db.writes.push(row)
		}
		return { rowcount: data.length }
	},
	execute: async (sql: string, params: (string | number)[] = []) => {
		if (sql.startsWith("REFRESH")) {
			if (db.failRefresh) throw new Error("refresh unavailable")
			return { rowcount: 0 }
		}
		if (db.fail) throw new Error("refused")
		const [value, , key, seqNo, primaryTerm] = params
		if (Number(seqNo) !== db.writes.length || Number(primaryTerm) !== 1)
			return { rowcount: 0 }
		db.rows.set(String(key), String(value))
		db.writes.push({ key: String(key), value: String(value) })
		if (db.failWriteAfterLanding) throw new Error("timeout after landing")
		return { rowcount: 1 }
	},
}
Object.defineProperty(globalThis, "__mediaPreferencesTestCrate", {
	value: crateMock,
})
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
		let source: string | undefined
		if (url.endsWith("/utils/crate.ts"))
			source = `
			export const query = (...args) => globalThis.__mediaPreferencesTestCrate.query(...args);
			export const upsert = (...args) => globalThis.__mediaPreferencesTestCrate.upsert(...args);
			export const execute = (...args) => globalThis.__mediaPreferencesTestCrate.execute(...args);`
		else if (url.endsWith("/utils/cache.ts"))
			source = `
			export const cached = ({target, params}) => target(params);
			export const declareResettableCache = () => {};
			export const resetCache = async () => 1;`
		else if (url.endsWith("/server/utils/prefetch.ts"))
			source = "export const prefetchQuery = async () => {}"
		else if (url.endsWith("/utils/auth.ts"))
			source =
				'export const getUserIdFromRequest = async ({request}) => request.headers.get("X-Test-User"); export const useUser = () => ({user: null})'
		else if (url.endsWith("/routes/api.streaming-providers.tsx"))
			source =
				'export const queryKeyStreamingProviders = ["streaming-providers"]'
		else if (url.endsWith("/routes/api.user-settings.get.tsx")) {
			const original = readFileSync(new URL(url), "utf8")
			source =
				original.slice(
					original.indexOf("// type definitions"),
					original.indexOf("// API endpoint"),
				) +
				original.slice(
					original.indexOf("export const queryKeyUserSettings"),
					original.indexOf("export const useUserSettings"),
				)
		} else if (url.endsWith(".tsx")) source = readFileSync(new URL(url), "utf8")
		if (source !== undefined)
			return {
				format: "module",
				shortCircuit: true,
				source: ts.transpileModule(source, {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
						jsx: ts.JsxEmit.ReactJSX,
					},
				}).outputText,
			}
		return next(url, context)
	},
})
const {
	resolveMediaContext,
	saveMediaPreferences,
	adoptMediaPreferencesAtSignIn,
} = await import("./media-context.server.ts")
const {
	MEDIA_PREFERENCES_KEY,
	MediaPreferencesConflict,
	writeMediaPreferences,
	invalidateMediaPreferencesRead,
} = await import("./media-preferences-store.server.ts")
const { getUserSettings, setUserSettings } = await import(
	"./user-settings.server.ts"
)
const { resetMediaSaveOrderForTest } = await import(
	"./media-save-order.server.ts"
)
const { loader: preferencesLoader } = await import(
	"../routes/api.media-preferences.ts"
)
const { action } = await import("../routes/api.user-settings.set.tsx")

const saved = (
	language: LocalizationRecord["language"] = "de",
): LocalizationRecord => ({
	country: "DE",
	language,
	schemaVersion: 1,
	version: "previous",
	sourceUserId: null,
})
const request = (
	cookie?: LocalizationRecord,
	headers: Record<string, string> = {},
) =>
	new Request("https://goodwatch.test/movie/603", {
		headers: {
			"Accept-Language": "ja-JP,en;q=0.5",
			...(cookie ? { Cookie: serializeLocalizationCookie(cookie) } : {}),
			...headers,
		},
	})
beforeEach(() => {
	invalidateMediaPreferencesRead("member")
	invalidateMediaPreferencesRead("other")
	resetMediaSaveOrderForTest()
	db.preferenceReads = 0
	db.rows.clear()
	db.writes = []
	db.fail = false
	db.failRefresh = false
	db.failWriteAfterLanding = false
})

describe("server resolution and atomic storage", () => {
	it("resolves guest cookie on first paint without writes", async () => {
		assertSubset(
			(await resolveMediaContext(request(saved()))).effectiveContext,
			{
				country: "DE",
				language: "de",
				languageProvenance: "explicit",
			},
		)
		assert.equal(db.writes.length, 0)
	})
	it("records an explicitly supplied US browser region as inferred, not default", async () => {
		const context = await resolveMediaContext(
			request(undefined, { "Accept-Language": "en-US" }),
		)
		assertSubset(context.effectiveContext, {
			country: "US",
			countryProvenance: "browser",
			languageProvenance: "browser",
		})
	})
	it("adopts guest pair in one account row on sign-in, ahead of legacy country", async () => {
		db.rows.set("country_default", "US")
		const req = request(saved())
		await adoptMediaPreferencesAtSignIn(req, "member")
		const context = await resolveMediaContext(req, "member")
		assertSubset(context.effectiveContext, {
			country: "DE",
			countryProvenance: "account",
			language: "de",
		})
		assert.equal(db.writes.length, 1)
		assert.equal(db.writes[0].key, MEDIA_PREFERENCES_KEY)
		assert.equal(db.rows.get("country_default"), "US")
		assertSubset(parseLocalizationCookie(context.setCookie), {
			...context.record,
			sourceUserId: "member",
		})
		assertSubset(await getUserSettings({ userId: "member" }), {
			country_default: "DE",
		})
	})
	it("account wins and rewrites device cookie without a second account write", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved("fr")))
		const context = await resolveMediaContext(request(saved("de")), "member")
		assert.equal(context.effectiveContext.language, "fr")
		assert.equal(parseLocalizationCookie(context.setCookie)?.language, "fr")
		assert.equal(db.writes.length, 0)
	})
	it("never saves an inferred browser language just because a member arrives", async () => {
		db.rows.set("country_default", "US")
		assertSubset(
			(await resolveMediaContext(request(), "member")).effectiveContext,
			{
				country: "US",
				language: "ja",
				languageSetting: "browser",
			},
		)
		assert.equal(db.writes.length, 0)
	})
	it("legacy country updates preserve an account's explicit language", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved("fr")))
		await setUserSettings({
			user_id: "member",
			settings: { country_default: "JP" },
		})
		assertSubset(JSON.parse(db.rows.get(MEDIA_PREFERENCES_KEY)!), {
			country: "JP",
			language: "fr",
		})
		assert.equal(db.writes.length, 1)
		assertSubset(await getUserSettings({ userId: "member" }), {
			country_default: "JP",
		})
	})
	it("deduplicates parallel root/title GET resolution without an adoption write", async () => {
		const req = request(saved())
		const [root, title] = await Promise.all([
			resolveMediaContext(req, "member"),
			resolveMediaContext(req, "member"),
		])
		assert.equal(root, title)
		assert.equal(db.writes.length, 0)
	})
	it("two concurrent saves from one revision cannot both publish", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved()))
		const outcomes = await Promise.allSettled([
			writeMediaPreferences(
				"member",
				{ country: "JP", language: "ja" },
				{ expectedVersion: "previous" },
			),
			writeMediaPreferences(
				"member",
				{ country: "US", language: "en" },
				{ expectedVersion: "previous" },
			),
		])
		assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [
			"fulfilled",
			"rejected",
		])
		assert.equal(db.writes.length, 1)
	})
	it("a concurrent first save cannot replace the winner", async () => {
		const outcomes = await Promise.allSettled([
			writeMediaPreferences(
				"member",
				{ country: "JP", language: "ja" },
				{ expectedVersion: null },
			),
			writeMediaPreferences(
				"member",
				{ country: "US", language: "en" },
				{ expectedVersion: null },
			),
		])
		assert.deepEqual(outcomes.map((outcome) => outcome.status).sort(), [
			"fulfilled",
			"rejected",
		])
		assert.equal(db.writes.length, 1)
	})
	it("country-only ignoreUpdate does not overwrite a kept account pair", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved("fr")))
		await setUserSettings({
			user_id: "member",
			settings: { country_default: "US" },
			options: { ignoreUpdate: true },
		})
		assert.equal(db.writes.length, 0)
	})
	it("adoption does not replace a pair saved by another device", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved("fr")))
		assert.deepEqual(
			await writeMediaPreferences(
				"member",
				{ country: "JP", language: "ja" },
				{ adoptOnly: true },
			),
			saved("fr"),
		)
		assert.equal(db.writes.length, 0)
	})
	it("rejects an outdated expectedVersion without writes", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved()))
		await assert.rejects(
			writeMediaPreferences(
				"member",
				{ country: "JP", language: "ja" },
				{ expectedVersion: "older" },
			),
			MediaPreferencesConflict,
		)
		assert.equal(db.writes.length, 0)
	})
	it("confirms a conditional write that timed out after landing", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved()))
		db.failWriteAfterLanding = true
		assertSubset(
			await writeMediaPreferences(
				"member",
				{ country: "JP", language: "ja" },
				{ expectedVersion: "previous" },
			),
			{ country: "JP", language: "ja" },
		)
	})
	it("uses the identical boundary for whole-pair Undo and browser reset", async () => {
		const kept = await saveMediaPreferences(request(), "member", {
			clientId: "test-client-id",
			pair: { country: "JP", language: "ja" },
			sequence: 1,
			expectedVersion: null,
		})
		const undone = await saveMediaPreferences(request(), "member", {
			clientId: "test-client-id",
			pair: { country: "DE", language: "browser" },
			sequence: 2,
			expectedVersion: kept.response.version,
		})
		assertSubset(undone.response, {
			pair: { country: "DE", language: "browser" },
			sequence: 2,
			effectiveContext: {
				country: "DE",
				language: "ja",
				languageSetting: "browser",
			},
		})
		assert.equal(db.writes.length, 2)
		assert.equal(
			db.writes.every((row) => row.key === MEDIA_PREFERENCES_KEY),
			true,
		)
	})
})

describe("action API", () => {
	const call = (body: unknown, member = false) =>
		action({
			request: new Request("https://goodwatch.test/api/user-settings/set", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Accept-Language": "fr",
					...(member ? { "X-Test-User": "member" } : {}),
				},
				body: JSON.stringify({
					clientId: "test-client-id",
					...(body as Record<string, unknown>),
				}),
			}),
			params: {},
			context: {},
		}) as Promise<Response>
	it("saves guests only to one cookie and echoes pair, revision and sequence", async () => {
		const response = await call({
			pair: { country: "de", language: "browser" },
			sequence: 3,
		})
		assert.equal(response.status, 200)
		assertSubset(await response.json(), {
			pair: { country: "DE", language: "browser" },
			sequence: 3,
			destination: "device",
			effectiveContext: { language: "fr" },
		})
		assert.equal(
			parseLocalizationCookie(response.headers.get("Set-Cookie"))?.country,
			"DE",
		)
		assert.equal(response.headers.get("Cache-Control"), "no-store")
		assert.equal(db.writes.length, 0)
	})
	it("saves members in exactly one row plus the response cookie", async () => {
		const response = await call(
			{
				pair: { country: "US", language: "de" },
				sequence: 1,
				expectedVersion: null,
			},
			true,
		)
		assert.equal(response.status, 200)
		assert.equal(db.writes.length, 1)
		assertSubset(parseLocalizationCookie(response.headers.get("Set-Cookie")), {
			country: "US",
			language: "de",
		})
	})
	it("a refused write never half-writes the pair or sends a new cookie", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved()))
		db.fail = true
		const response = await call(
			{
				pair: { country: "JP", language: "ja" },
				sequence: 3,
				expectedVersion: "previous",
			},
			true,
		)
		assert.equal(response.status, 503)
		assert.equal(response.headers.has("Set-Cookie"), false)
		assert.equal(db.rows.get(MEDIA_PREFERENCES_KEY), JSON.stringify(saved()))
	})
	it("returns 409 for a stale member revision without a cookie", async () => {
		db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(saved()))
		const response = await call(
			{
				pair: { country: "JP", language: "ja" },
				sequence: 3,
				expectedVersion: "old",
			},
			true,
		)
		assert.equal(response.status, 409)
		assert.equal(response.headers.has("Set-Cookie"), false)
		assertSubset(await response.json(), {
			sequence: 3,
			current: {
				pair: { country: "DE", language: "de" },
				version: "previous",
				sequence: 0,
			},
		})
	})
	for (const fixture of [
		{ pair: { country: "DE" }, sequence: 1 },
		{ pair: { country: "DE", language: "de" }, sequence: -1 },
		{
			pair: { country: "DE", language: "de" },
			sequence: 1,
			expectedVersion: [],
		},
	])
		it("rejects malformed pair requests %j" +
			" " +
			JSON.stringify(fixture).slice(0, 120), async () => {
			const body = fixture
			const response = await call(body)
			assert.equal(response.status, 400)
			assert.equal(db.writes.length, 0)
		})
})

function assertSubset(
	actual: unknown,
	expected: Record<string, unknown>,
): void {
	assert.ok(actual && typeof actual === "object")
	for (const [key, value] of Object.entries(expected)) {
		const observed: unknown = (actual as Record<string, unknown>)[key]
		if (value && typeof value === "object" && !Array.isArray(value))
			assertSubset(observed, value as Record<string, unknown>)
		else assert.deepEqual(observed, value)
	}
}

describe("private preferences and save ordering", () => {
	it("returns saved revision/provenance only from the no-store endpoint", async () => {
		const response = await preferencesLoader({
			request: request(saved()),
			params: {},
			context: {},
		})
		assert.equal(response.headers.get("Cache-Control"), "private, no-store")
		assertSubset(await response.json(), {
			mediaPreferences: saved(),
			effectiveContext: {
				countryProvenance: "cookie",
				languageProvenance: "explicit",
			},
		})
	})
	it("a lower guest sequence gets 409 with the current saved record and no cookie", async () => {
		const invoke = async (sequence: number, language: string) =>
			action({
				request: new Request("https://goodwatch.test/api/user-settings/set", {
					method: "POST",
					body: JSON.stringify({
						clientId: "guest-test-client",
						sequence,
						pair: { country: "DE", language },
					}),
				}),
				params: {},
				context: {},
			}) as Promise<Response>
		const kept = await invoke(10, "de")
		const success = await kept.json()
		const stale = await invoke(9, "fr")
		assert.equal(stale.status, 409)
		assert.equal(stale.headers.has("Set-Cookie"), false)
		assertSubset(await stale.json(), {
			sequence: 9,
			current: {
				pair: { country: "DE", language: "de" },
				version: success.version,
				sequence: 10,
			},
		})
	})
	it("member ordering survives losing the process high-water state", async () => {
		const kept = await saveMediaPreferences(request(), "member", {
			clientId: "member-test-client",
			sequence: 10,
			pair: { country: "DE", language: "de" },
			expectedVersion: null,
		})
		resetMediaSaveOrderForTest()
		await assert.rejects(
			saveMediaPreferences(request(), "member", {
				clientId: "member-test-client",
				sequence: 9,
				pair: { country: "FR", language: "fr" },
				expectedVersion: kept.response.version,
			}),
			MediaPreferencesConflict,
		)
		assert.equal(db.writes.length, 1)
	})
	it("idempotent retries keep the same revision and reject an equal sequence for a different pair", async () => {
		const input = {
			clientId: "member-test-client",
			sequence: 1,
			pair: { country: "DE", language: "de" as const },
			expectedVersion: null,
		}
		const kept = await saveMediaPreferences(request(), "member", input)
		const retry = await saveMediaPreferences(request(), "member", input)
		assert.equal(kept.response.version, retry.response.version)
		assert.equal(db.writes.length, 1)
		await assert.rejects(
			saveMediaPreferences(request(), "member", {
				...input,
				pair: { country: "FR", language: "fr" },
			}),
			MediaPreferencesConflict,
		)
	})
	it("a newer in-flight request suppresses the older cookie, then saves the newer pair", async () => {
		// Stall the older write until the server has admitted the newer intent.
		const original = crateMock.upsert
		let release!: () => void
		let entered!: () => void
		const waiting = new Promise<void>((resolve) => {
			release = resolve
		})
		const started = new Promise<void>((resolve) => {
			entered = resolve
		})
		crateMock.upsert = async (input) => {
			entered()
			await waiting
			return original(input)
		}
		try {
			const older = saveMediaPreferences(request(), "member", {
				clientId: "concurrent-client",
				sequence: 1,
				pair: { country: "DE", language: "de" },
				expectedVersion: null,
			})
			const rejected = assert.rejects(older, MediaPreferencesConflict)
			await started
			const newer = saveMediaPreferences(request(), "member", {
				clientId: "concurrent-client",
				sequence: 2,
				pair: { country: "JP", language: "ja" },
				expectedVersion: null,
			})
			release()
			await rejected
			const result = await newer
			assert.deepEqual(result.response.pair, { country: "JP", language: "ja" })
			assert.equal(
				parseLocalizationCookie(result.setCookie)?.writer?.sequence,
				2,
			)
		} finally {
			crateMock.upsert = original
			release()
		}
	})
})

it("a guest's persisted writer sequence rejects stale intent after process state resets", async () => {
	const record = {
		...saved(),
		writer: { clientId: "guest-test-client", sequence: 42 },
	}
	const response = (await action({
		request: new Request("https://goodwatch.test/api/user-settings/set", {
			method: "POST",
			headers: { Cookie: serializeLocalizationCookie(record) },
			body: JSON.stringify({
				clientId: "guest-test-client",
				sequence: 41,
				pair: { country: "FR", language: "fr" },
			}),
		}),
		params: {},
		context: {},
	})) as Response
	assert.equal(response.status, 409)
	assert.equal(response.headers.has("Set-Cookie"), false)
	assertSubset(await response.json(), {
		current: {
			pair: { country: "DE", language: "de" },
			version: "previous",
			sequence: 42,
		},
	})
})

it("a guest version conflict returns its current cookie record for retry", async () => {
	const response = (await action({
		request: new Request("https://goodwatch.test/api/user-settings/set", {
			method: "POST",
			headers: { Cookie: serializeLocalizationCookie(saved()) },
			body: JSON.stringify({
				clientId: "guest-test-client",
				sequence: 12,
				expectedVersion: "old",
				pair: { country: "FR", language: "fr" },
			}),
		}),
		params: {},
		context: {},
	})) as Response
	assert.equal(response.status, 409)
	assert.equal(response.headers.has("Set-Cookie"), false)
	assertSubset(await response.json(), {
		sequence: 12,
		current: {
			pair: { country: "DE", language: "de" },
			version: "previous",
			sequence: 0,
		},
	})
})

it("another instance's superseding member save is checked before Set-Cookie", async () => {
	const execute = crateMock.execute
	let release!: () => void
	let entered!: () => void
	const waiting = new Promise<void>((resolve) => {
		release = resolve
	})
	const started = new Promise<void>((resolve) => {
		entered = resolve
	})
	crateMock.execute = async (sql, params) => {
		if (sql.startsWith("REFRESH")) {
			entered()
			await waiting
		}
		return execute(sql, params)
	}
	try {
		const older = saveMediaPreferences(request(), "member", {
			clientId: "first-instance-client",
			sequence: 1,
			expectedVersion: null,
			pair: { country: "DE", language: "de" },
		})
		const rejected = assert.rejects(older, MediaPreferencesConflict)
		await started
		const current = await writeMediaPreferences(
			"member",
			{ country: "JP", language: "ja" },
			{
				expectedVersion: JSON.parse(db.rows.get(MEDIA_PREFERENCES_KEY)!)
					.version,
				writer: { clientId: "second-instance-client", sequence: 1 },
			},
		)
		release()
		await rejected
		assert.equal(
			JSON.parse(db.rows.get(MEDIA_PREFERENCES_KEY)!).version,
			current.version,
		)
	} finally {
		crateMock.execute = execute
		release()
	}
})

it("configured public origin and Secure cookies work behind the HTTP proxy", async () => {
	const original = process.env.APP_ORIGIN
	process.env.APP_ORIGIN = "https://goodwatch.test"
	try {
		const response = (await action({
			request: new Request("http://goodwatch.test/api/user-settings/set", {
				method: "POST",
				headers: { Origin: "https://goodwatch.test" },
				body: JSON.stringify({
					clientId: "proxy-test-client",
					sequence: 1,
					pair: { country: "DE", language: "de" },
				}),
			}),
			params: {},
			context: {},
		})) as Response
		assert.equal(response.status, 200)
		assert.equal(response.headers.get("Set-Cookie")?.includes("; Secure"), true)
	} finally {
		if (original === undefined) delete process.env.APP_ORIGIN
		else process.env.APP_ORIGIN = original
	}
})

it("member root GETs share a short per-user read and never adopt/persist a guest cookie", async () => {
	db.rows.set("country_default", "US")
	const cookie = saved("fr")
	await resolveMediaContext(request(cookie), "member")
	await resolveMediaContext(request(cookie), "member")
	assert.equal(db.preferenceReads, 1)
	assert.equal(db.writes.length, 0)
	await adoptMediaPreferencesAtSignIn(request(cookie), "member")
	assert.equal(db.writes.length, 1)
	assert.equal(
		(await resolveMediaContext(request(cookie), "member")).record?.language,
		"fr",
	)
})
it("session adoption rejects another member's cookie and an unproved legacy cookie", async () => {
	const foreign = { ...saved("fr"), sourceUserId: "other" }
	const legacy = {
		country: "DE",
		language: "de" as const,
		schemaVersion: 1 as const,
		version: "old",
	}
	for (const cookie of [foreign, legacy]) {
		assert.deepEqual(
			await adoptMediaPreferencesAtSignIn(request(cookie), "member"),
			{ changed: false, setCookie: null },
		)
		assert.equal(db.writes.length, 0)
	}
	db.rows.set("country_default", "US")
	assert.equal(
		(await resolveMediaContext(request(foreign), "member")).effectiveContext
			.country,
		"US",
	)
	assert.equal(
		(await resolveMediaContext(request(foreign), "member")).effectiveContext
			.language,
		"ja",
	)
})
it("an explicit guest Keep confirms the whole pair; session establishment reports changes only once", async () => {
	db.rows.set("country_default", "US")
	const first = await adoptMediaPreferencesAtSignIn(
		request(saved("fr")),
		"member",
	)
	assert.equal(first.changed, true)
	assert.equal(parseLocalizationCookie(first.setCookie)?.country, "DE")
	assert.equal(db.rows.get("country_default"), "US")
	const repeated = await adoptMediaPreferencesAtSignIn(
		request(parseLocalizationCookie(first.setCookie)!),
		"member",
	)
	assert.deepEqual(repeated, { changed: false, setCookie: null })
	assert.equal(db.writes.length, 1)
})

it("a newer owned cookie refreshes the short account memo instead of rewriting it from stale GET data", async () => {
	const first = saved("de")
	db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(first))
	await resolveMediaContext(request(), "member")
	const changed = {
		...saved("fr"),
		version: "other-instance",
		sourceUserId: "member",
	}
	db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(changed))
	const fresh = await resolveMediaContext(request(changed), "member")
	assert.equal(fresh.effectiveContext.language, "fr")
	assert.equal(fresh.setCookie, null)
	assert.equal(db.writes.length, 0)
})

const { action: sessionAction } = await import(
	"../routes/api.media-preferences_.session.ts"
)
it("session endpoint rejects foreign Origin before authentication or preferences reads", async () => {
	const before = db.preferenceReads
	const response = await sessionAction({
		request: new Request(
			"https://goodwatch.test/api/media-preferences/session",
			{
				method: "POST",
				headers: { Origin: "https://other.test", "X-Test-User": "member" },
			},
		),
		params: {},
		context: {},
	})
	assert.equal(response.status, 403)
	assert.equal(db.preferenceReads, before)
	assert.equal(db.writes.length, 0)
})
it("unchanged session endpoint emits changed:false and no Set-Cookie", async () => {
	const stored = { ...saved(), sourceUserId: "member" }
	db.rows.set(MEDIA_PREFERENCES_KEY, JSON.stringify(stored))
	const response = await sessionAction({
		request: new Request(
			"https://goodwatch.test/api/media-preferences/session",
			{
				method: "POST",
				headers: {
					Origin: "https://goodwatch.test",
					"X-Test-User": "member",
					Cookie: serializeLocalizationCookie(stored),
				},
			},
		),
		params: {},
		context: {},
	})
	assert.deepEqual(await response.json(), { changed: false })
	assert.equal(response.headers.get("Set-Cookie"), null)
	assert.equal(db.writes.length, 0)
})
