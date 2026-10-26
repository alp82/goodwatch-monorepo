import assert from "node:assert/strict"
import { test } from "node:test"
import { catalogVersion, withTropeDescriptions } from "./trope-catalog-data.ts"
import {
	createTropePageReader,
	createTropeReferenceReader,
	mainTropeUrl,
} from "./trope-pages.ts"
const url = (slug: string) =>
	`https://tvtropes.org/pmwiki/pmwiki.php/Main/${slug}`

test("reference lookup batches identities and actual titles without reading description blobs", async () => {
	const calls: { sql: string; params: (string | number | Date)[] }[] = []
	const read = createTropeReferenceReader(
		async <T extends {}>(sql: string, params: (string | number | Date)[]) => {
			calls.push({ sql, params })
			return params.map((v) =>
				sql.includes("trope_catalog_reference")
					? {
							reference_url: v,
							canonical_url: String(v).replace("Old", "Target"),
						}
					: { url: v, title: "Actual page title" },
			) as unknown as T[]
		},
	)
	const refs = Array.from({ length: 1001 }, (_, i) => url(`Old${i}`))
	const result = await read([
		...refs,
		refs[0],
		"https://evil.test/pmwiki/pmwiki.php/Main/X",
	])
	assert.equal(Object.keys(result).length, 1001)
	assert.equal(result[refs[0]].url, url("Target0"))
	assert.equal(result[refs[0]].title, "Actual page title")
	assert.equal(
		calls.filter((c) => c.sql.includes("trope_catalog_reference")).length,
		3,
	)
	assert.equal(
		calls.filter((c) => c.sql.includes("trope_catalog_page")).length,
		6,
	)
	assert.ok(
		calls.every(
			(c) => c.params.length <= 400 && !c.sql.includes("description"),
		),
	)
	const count = calls.length
	assert.deepEqual(await read([]), {})
	assert.equal(calls.length, count)
})

test("visible page descriptions and titles refresh independently of the same warmed pool", async () => {
	let title = "Actual first title"
	let text = "First general definition"
	const calls: { sql: string; params: (string | number | Date)[] }[] = []
	const read = createTropePageReader(
		async <T extends {}>(sql: string, params: (string | number | Date)[]) => {
			calls.push({ sql, params })
			return params.map((u) => ({
				url: u,
				title,
				description: text,
			})) as unknown as T[]
		},
	)
	const input = Array.from({ length: 30 }, (_, i) => url(`Page${i}`))
	const pool = {
		urls: {},
		descriptions: { legacy: "Wrong old scoped text" },
		names: { [input[0]]: "Context label" },
	}
	const first = await read(input)
	title = "Corrected actual title"
	text = "New complete general definition"
	const second = await read(input)
	assert.equal(calls.length, 2)
	assert.ok(calls.every((c) => c.params.length === 30))
	assert.notEqual(catalogVersion(first), catalogVersion(second))
	const overlaid = withTropeDescriptions(pool, second)
	assert.equal(overlaid.names[input[0]], title)
	assert.equal(overlaid.descriptions[input[0]], text)
	assert.ok(!("legacy" in overlaid.descriptions))
	assert.equal(pool.names[input[0]], "Context label")
	const count = calls.length
	assert.deepEqual(await read(["Context label", "label:unresolved"]), {})
	assert.equal(calls.length, count)
})

test("Main route normalization preserves slug case, rejects query tricks and other namespaces", () => {
	assert.equal(
		mainTropeUrl("http://www.tvtropes.org/pmwiki/pmwiki.php/Main/Time_Slip"),
		url("Time_Slip"),
	)
	for (const u of [
		`${url("X")}?from=Main.Y`,
		`${url("X")}#x`,
		url("%58"),
		url("X").replace("Main/", "Film/"),
		url("X").replace("tvtropes.org", "evil.test"),
		url("X").replace("Main/", "main/"),
	])
		assert.equal(mainTropeUrl(u), null)
})

test("only the evidenced exact duplicated TV Tropes origin is repaired", () => {
	const duplicate = `https://tvtropes.org${url("KnownPage")}`
	assert.equal(mainTropeUrl(duplicate), url("KnownPage"))
	for (const invalid of [
		`https://tvtropes.org${duplicate}`,
		"https://tvtropes.orghttps://evil.test/pmwiki/pmwiki.php/Main/KnownPage",
		"https://evil.testhttps://tvtropes.org/pmwiki/pmwiki.php/Main/KnownPage",
		"https://tvtropes.orghttps://tvtropes.org.evil.test/pmwiki/pmwiki.php/Main/KnownPage",
		`${duplicate}?from=Main.Other`,
		`${duplicate}#section`,
		duplicate.replace("Main/", "Film/"),
	])
		assert.equal(mainTropeUrl(invalid), null)
})
