import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { randomUUID, createHash } from "node:crypto"
import { runInNewContext } from "node:vm"
import { test } from "node:test"
import ts from "typescript"
import * as titleKeys from "../../utils/title-key.ts"
import { toCrateSql } from "./search-filters.ts"

test(
	"exact membership and Like retrieval obey real SQL filters without using JEV",
	{ skip: !process.env.EXACT_SEARCH_TEST_CRATE_URL },
	async (t) => {
		const endpoint = new URL("/_sql", process.env.EXACT_SEARCH_TEST_CRATE_URL)
		assert.ok(
			["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname),
			"isolated loopback CrateDB only",
		)
		const schema = `exact_test_${randomUUID().replace(/-/g, "")}`
		const sql = async (statement: string, args: unknown[] = []) => {
			const stmt = statement.replace(
				/\b(FROM|INTO|TABLE) (movie|show|trope|trope_catalog_reference)\b/g,
				`$1 ${schema}.$2`,
			)
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ stmt, args }),
			})
			const data = await response.json()
			assert.equal(response.status, 200, data.error?.message)
			return data.rows.map((row: unknown[]) =>
				Object.fromEntries(
					data.cols.map((column: string, i: number) => [column, row[i]]),
				),
			)
		}
		const columns =
			"tmdb_id INTEGER PRIMARY KEY,title TEXT,original_title TEXT,release_year INTEGER,popularity DOUBLE,poster_path TEXT,genres ARRAY(TEXT),adult BOOLEAN,imdb_id TEXT,goodwatch_overall_score_normalized_percent DOUBLE,goodwatch_overall_score_voting_count INTEGER,is_anime BOOLEAN,streaming_availabilities ARRAY(TEXT)"
		for (const table of ["movie", "show"]) {
			await sql(
				`CREATE TABLE ${table} (${columns}) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=0)`,
			)
			t.after(() => sql(`DROP TABLE ${table}`))
		}
		await sql(
			"CREATE TABLE trope (media_type TEXT,media_tmdb_id INTEGER,url TEXT) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=0)",
		)
		await sql(
			"CREATE TABLE trope_catalog_reference (reference_url TEXT,canonical_url TEXT) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=0)",
		)
		t.after(() => sql("DROP TABLE trope"))
		t.after(() => sql("DROP TABLE trope_catalog_reference"))
		const url = "https://tvtropes.org/pmwiki/pmwiki.php/Main/ApocalypseAnarchy"
		const alias = "https://tvtropes.org/pmwiki/pmwiki.php/Main/OldAnarchyName"
		await sql("INSERT INTO trope_catalog_reference VALUES (?,?)", [alias, url])
		for (const [id, adult, votes, genre, year, membership] of [
			[1, false, 3000, "Drama", 2000, url],
			[2, false, 4000, "Comedy", 2010, alias],
			[3, true, 5000, "Drama", 2020, url],
			[4, false, 10, "Drama", 2000, url],
		] as const) {
			await sql(
				"INSERT INTO movie (tmdb_id,title,release_year,popularity,poster_path,genres,adult,goodwatch_overall_score_normalized_percent,goodwatch_overall_score_voting_count) VALUES (?,?,?,?,?,?,?,?,?)",
				[id, `Movie ${id}`, year, id, "/poster.jpg", [genre], adult, 80, votes],
			)
			await sql("INSERT INTO trope VALUES ('movie',?,?)", [id, membership])
		}
		for (const table of ["movie", "show", "trope", "trope_catalog_reference"])
			await sql(`REFRESH TABLE ${schema}.${table}`)
		let seeds: unknown[] = []
		function load(path: string, dependencies: (name: string) => unknown) {
			const exports: any = {}
			const code = ts.transpileModule(
				readFileSync(new URL(path, import.meta.url), "utf8"),
				{
					compilerOptions: {
						module: ts.ModuleKind.CommonJS,
						target: ts.ScriptTarget.ES2022,
					},
				},
			).outputText
			runInNewContext(code, {
				exports,
				console,
				process: { env: {} },
				require: dependencies,
			})
			return exports
		}
		const sets = load("../title-filter/id-sets.server.ts", (name) => {
			if (name === "node:crypto") return { createHash }
			if (name.includes("utils/crate")) return { query: sql }
			if (name.includes("utils/cache")) return { getRedisCluster: () => null }
			if (name.includes("utils/title-key")) return titleKeys
			if (name.includes("utils/qdrant"))
				return {
					MEDIA_COLLECTION: "fixture",
					recommend: async (input: any) => {
						seeds = input.positive
						return [1, 2, 3, 4].map((id) => ({ id: 1e12 + id }))
					},
				}
			if (name.includes("order.server")) return { MIN_VOTES: 1000 }
			return {}
		})
		const resolved = load("./resolved.server.ts", (name) => {
			if (name.includes("id-sets.server")) return sets
			if (name.includes("people-filter.server"))
				return { peopleSearchFilters: async (filters: unknown) => filters }
			if (name.includes("catalog.server")) return { searchQuery: sql }
			if (name.includes("search-filters"))
				return {
					toCrateSql,
					titlePointId: (key: string) =>
						Number(key.split(":")[1]) + (key.startsWith("show:") ? 2e12 : 1e12),
				}
			return {}
		})
		const signal = new AbortController().signal
		const entity = { kind: "trope", id: url, label: "Apocalypse Anarchy" }
		const base = { includeAdult: false, lesserKnown: false }
		const result = await resolved.resolvedSearch(entity, base, signal, 5000)
		assert.deepEqual(
			Array.from(result.searchKeys),
			[1e12 + 2, 1e12 + 1],
			"aliases resolve; adults and low-vote titles stay excluded",
		)
		const narrowed = await resolved.resolvedSearch(
			entity,
			{ ...base, filters: { genres: ["Drama"], maxYear: 2005 } },
			signal,
			5000,
		)
		assert.deepEqual(Array.from(narrowed.searchKeys), [1e12 + 1])
		const empty = await resolved.resolvedSearch(
			{ ...entity, id: url + "Missing" },
			base,
			signal,
			5000,
		)
		assert.equal(empty.searchKeys.length, 0)
		const similar = await resolved.resolvedSearch(
			{ kind: "title", id: String(1e12 + 99), label: "Seed" },
			{ ...base, filters: { onlyTitles: ["movie:1"] } },
			signal,
			5000,
		)
		assert.deepEqual(Array.from(similar.searchKeys), [1e12 + 1])
		assert.deepEqual(Array.from(seeds), [1e12 + 99])
	},
)
