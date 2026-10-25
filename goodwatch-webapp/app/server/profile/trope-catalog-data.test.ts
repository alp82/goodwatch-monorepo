import assert from "node:assert/strict"
import { test } from "node:test"
import {
	createTropeCatalogReader,
	catalogVersion,
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
