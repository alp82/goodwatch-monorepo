import assert from "node:assert/strict"
import { test } from "node:test"
import {
	catalogVersion,
	createTropeCatalogReader,
	pageDescriptions,
	withPlainOpenings,
} from "./trope-catalog-data.ts"

test("catalog reads exact names in bounded batches and retains metadata-only URLs", async () => {
	const calls: { sql: string; params: (string | number | Date)[] }[] = []
	const read = createTropeCatalogReader(
		async <T extends {}>(sql: string, params: (string | number | Date)[]) => {
			calls.push({ sql, params })
			return params.map((name) => ({
				name,
				url: `https://tvtropes.org/pmwiki/pmwiki.php/Main/${name}`,
				description: name === "Name 0" ? "A general description." : null,
			})) as unknown as T[]
		},
	)
	const names = Array.from({ length: 1001 }, (_, i) => `Name ${i}`)
	const result = await read([...names, names[0]])
	assert.equal(calls.length, 3)
	assert.ok(
		calls.every(
			(c) =>
				c.params.length <= 400 &&
				c.sql.includes("WHERE name IN (") &&
				!c.sql.includes("match("),
		),
	)
	assert.equal(Object.keys(result).length, 1001)
	assert.equal(result["Name 0"].text, "A general description.")
	assert.equal(result["Name 1"].text, null)
	assert.ok(result["Name 1"].url.endsWith("Name 1"))
	const before = calls.length
	assert.deepEqual(await read([]), {})
	assert.equal(calls.length, before)
})

test("catalog version changes for descriptions and URLs but not result ordering", () => {
	const a = {
		First: { text: "One", url: "https://tvtropes.org/first" },
		Second: { text: null, url: "https://tvtropes.org/second" },
	}
	assert.equal(
		catalogVersion(a),
		catalogVersion({ Second: a.Second, First: a.First }),
	)
	assert.notEqual(
		catalogVersion(a),
		catalogVersion({ ...a, Second: { ...a.Second, text: "New description" } }),
	)
	assert.notEqual(
		catalogVersion(a),
		catalogVersion({
			...a,
			First: { ...a.First, url: "https://tvtropes.org/renamed" },
		}),
	)
})

test("before the document column exists, the retry still cuts an opening, so the page never gets the whole text", async () => {
	const sql: string[] = []
	const long = Array.from({ length: 8 }, (_, i) => `${i}`.repeat(400)).join(
		"\n\n",
	)
	const read = withPlainOpenings(
		createTropeCatalogReader(async <T extends {}>(query: string) => {
			sql.push(query)
			if (query.includes("description_doc"))
				throw new Error("Column unknown: description_doc")
			return [
				{ name: "Long", url: "https://tvtropes.org/x", description: long },
			] as unknown as T[]
		}),
	)
	const result = await read(["Long"])
	assert.equal(sql.length, 2)
	assert.ok(!sql[1].includes("description_doc"))
	const sent = pageDescriptions(result)
	assert.equal(sent.Long.text, null)
	assert.equal(sent.Long.opening?.blocks.length, 3)
	assert.equal(sent.Long.opening?.more, 5)
	// Other failures, and callers that only want plain text, are not retried.
	await assert.rejects(
		withPlainOpenings(async () => {
			throw new Error("timeout")
		})(["Long"]),
		/timeout/,
	)
	await assert.rejects(
		withPlainOpenings(async () => {
			throw new Error("description_doc")
		})(["Long"], { openings: false }),
	)
})
