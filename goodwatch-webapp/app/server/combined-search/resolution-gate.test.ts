import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { runInNewContext } from "node:vm"
import { test } from "node:test"
import ts from "typescript"
import { attributedSearch } from "../../domain/search-attribution.ts"
import type { ExactSearch } from "../../domain/exact-search.ts"

test("fully resolved searches bypass language, JEV, reservations and ranking even when the paid budget is unavailable", async () => {
	const source = readFileSync(
		new URL("./search.server.ts", import.meta.url),
		"utf8",
	)
	const code = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText
	let language = 0,
		jev = 0,
		ranking = 0
	const history: any[] = []
	let failure = false
	let entity: ExactSearch = {
		kind: "trope",
		id: "https://tvtropes.org/pmwiki/pmwiki.php/Main/ApocalypseAnarchy",
		label: "Apocalypse Anarchy",
	}
	const exports: { combinedSearch?: (...args: any[]) => Promise<any> } = {}
	runInNewContext(code, {
		exports,
		console,
		setImmediate,
		setTimeout,
		clearTimeout,
		performance,
		process: { env: {} },
		require: (name: string) => {
			if (name === "node:crypto") return { randomUUID }
			if (name.endsWith("search-attribution")) return { attributedSearch }
			if (name.endsWith("search-resolution.server"))
				return {
					startExactSearchResolution: () => {},
					resolveExactSearch: () => entity,
				}
			if (name.endsWith("resolved.server"))
				return {
					resolvedSearch: async () => {
						if (failure) throw new Error("Catalogue unavailable")
						return { rows: [], metadata: [], reading: [], searchKeys: [] }
					},
				}
			if (name.endsWith("role.server")) return { runsSearch: () => false }
			if (name.endsWith("language.server"))
				return {
					prepareLanguage: () => {
						language++
						throw new Error("Unexpected language call")
					},
				}
			if (name.endsWith("runtime.server"))
				return {
					runJevStage: () => {
						jev++
						throw new Error("Unexpected paid call")
					},
					recordSearchHistory: async (row: unknown) => {
						history.push(row)
					},
				}
			if (name.endsWith("serve.server"))
				return {
					rankForServing: () => {
						ranking++
						throw new Error("Unexpected ranking")
					},
				}
			return {}
		},
	})
	for (const kind of ["trope", "title"] as const) {
		entity =
			kind === "trope"
				? entity
				: { kind, id: "1000000329865", label: "Arrival", year: 2016 }
		const answer = await exports.combinedSearch!(
			entity.label,
			{},
			{
				accountId: Promise.resolve(null),
				networkIdentity: "test",
				attribution: {
					consumer: "web",
					surface: "start",
					trigger: "enter",
					reported_by: "client",
				},
			},
			new AbortController().signal,
		)
		assert.equal(answer.mode, "resolved")
		assert.equal(answer.chargedNano, 0)
		assert.equal(answer.resolution.kind, kind)
		assert.equal(answer.resolution.wholeQuery, true)
		await new Promise((resolve) => setImmediate(resolve))
	}
	assert.equal(history.length, 2)
	assert.equal(history[0].outcome, "resolved")
	assert.equal(history[0].rankerVersion, "exact-trope-v1")
	assert.equal(history[1].rankerVersion, "exact-title-v1")
	assert.equal(history[0].attribution.actor_kind, "guest")
	assert.notEqual(
		history[0].attribution.search_id,
		history[1].attribution.search_id,
	)
	assert.deepEqual([language, jev, ranking], [0, 0, 0])
	const before = history.length
	failure = true
	await assert.rejects(
		exports.combinedSearch!(
			"Arrival",
			{},
			{ accountId: null },
			new AbortController().signal,
		),
		/Catalogue unavailable/,
	)
	failure = false
	await exports.combinedSearch!(
		"Arrival",
		{},
		{ accountId: null },
		new AbortController().signal,
		undefined,
		{ onComplete: () => false },
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(
		history.length,
		before,
		"failed or undelivered results do not invent completed history",
	)
	assert.deepEqual(
		[language, jev, ranking],
		[0, 0, 0],
		"failure never falls through to a paid interpretation",
	)
})
