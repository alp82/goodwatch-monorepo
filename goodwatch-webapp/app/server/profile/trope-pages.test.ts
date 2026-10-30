import assert from "node:assert/strict"
import { test } from "node:test"
import type { TropeOpening } from "../../utils/trope-opening.ts"
import {
	catalogVersion,
	pageDescriptions,
	withTropeDescriptions,
} from "./trope-catalog-data.ts"
import {
	createTropePageReader,
	createTropeReferenceReader,
	mainTropeUrl,
	tropePageUrl,
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

test("approved general canonical namespaces stay distinct from strict Main source references", () => {
	const namespaces = [
		"Main",
		"DuelingWorks",
		"Headscratchers",
		"Mohs",
		"MediaNotes",
		"Administrivia",
		"NamesToKnowInAnime",
		"ReferencedBy",
		"ShoutOut",
		"Analysis",
		"UsefulNotes",
		"HistoricalFiction",
	]
	for (const ns of namespaces) {
		const canonical = `https://tvtropes.org/pmwiki/pmwiki.php/${ns}/ObservedPage`
		assert.equal(tropePageUrl(canonical), canonical)
		assert.equal(mainTropeUrl(canonical), ns === "Main" ? canonical : null)
	}
	for (const invalid of [
		"Creator",
		"Film",
		"Literature",
		"VideoGame",
		"WesternAnimation",
		"Anime",
		"mohs",
		"Unknown",
	]) {
		assert.equal(
			tropePageUrl(
				`https://tvtropes.org/pmwiki/pmwiki.php/${invalid}/ObservedPage`,
			),
			null,
		)
	}
	assert.equal(
		tropePageUrl("https://evil.test/pmwiki/pmwiki.php/Mohs/OneBigLie"),
		null,
	)
	assert.equal(
		tropePageUrl(
			"https://tvtropes.org/pmwiki/pmwiki.php/Mohs/OneBigLie?from=Main.X",
		),
		null,
	)
})

test("Main references resolve to actual Mohs pages; only known general self-identities resolve as originals", async () => {
	const main = url("OneBigLie")
	const mohs = "https://tvtropes.org/pmwiki/pmwiki.php/Mohs/OneBigLie"
	const wrongOriginal =
		"https://tvtropes.org/pmwiki/pmwiki.php/Analysis/UnprovenOriginal"
	const creator = "https://tvtropes.org/pmwiki/pmwiki.php/Creator/Someone"
	const metadata = createTropeReferenceReader(
		async <T extends {}>(sql: string, params: (string | number | Date)[]) => {
			if (sql.includes("trope_catalog_reference"))
				return [
					{ reference_url: main, canonical_url: mohs },
					{ reference_url: mohs, canonical_url: mohs },
					{ reference_url: wrongOriginal, canonical_url: mohs },
					{ reference_url: url("Unsafe"), canonical_url: creator },
				] as unknown as T[]
			return [{ url: mohs, title: "One Big Lie" }] as unknown as T[]
		},
	)
	const resolved = await metadata([
		main,
		mohs,
		wrongOriginal,
		url("Unsafe"),
		creator,
	])
	assert.deepEqual(resolved[main], { url: mohs, title: "One Big Lie" })
	assert.deepEqual(resolved[mohs], { url: mohs, title: "One Big Lie" })
	assert.equal(resolved[wrongOriginal], undefined)
	assert.equal(resolved[url("Unsafe")], undefined)
	const descriptions = createTropePageReader(
		async <T extends {}>(_sql: string, params: (string | number | Date)[]) => {
			assert.deepEqual(params, [mohs])
			return [
				{
					url: mohs,
					title: "One Big Lie",
					description: "The actual general-page introduction.",
				},
			] as unknown as T[]
		},
	)
	assert.deepEqual(await descriptions([mohs, creator], { openings: false }), {
		[mohs]: {
			url: mohs,
			title: "One Big Lie",
			text: "The actual general-page introduction.",
		},
	})
})

test("page reads bring the description document and cut the opening; an invalid one falls back to the text", async () => {
	const page = url("Jerkass")
	const sql: string[] = []
	const docs: Record<string, string | null> = {
		[page]: JSON.stringify({
			v: 1,
			source: "archive",
			blocks: [
				{
					kind: "p",
					text: "Enjoys schadenfreude.",
					links: [[7, 20, url("ComedicSociopathy")]],
				},
			],
		}),
		[url("Broken")]:
			'{"v":1,"source":"archive","blocks":[{"kind":"p","text":"x","links":[[0,1,"https://evil.test/"]]}]}',
	}
	const read = createTropePageReader(
		async <T extends {}>(query: string, params: (string | number | Date)[]) => {
			sql.push(query)
			return params.map((u) => ({
				url: u,
				title: null,
				description: "Plain one.\n\nPlain two.",
				description_doc: docs[String(u)] ?? null,
			})) as unknown as T[]
		},
	)
	const result = await read([page, url("Broken"), url("Missing")])
	assert.ok(sql.every((q) => q.includes("description_doc")))
	assert.deepEqual(result[page].opening, {
		blocks: [
			{
				kind: "p",
				text: "Enjoys schadenfreude.",
				links: [[7, 20, "Main/ComedicSociopathy"]],
			},
		],
		more: 0,
	})
	const plain: TropeOpening = {
		blocks: [
			{ kind: "p", text: "Plain one." },
			{ kind: "p", text: "Plain two." },
		],
		more: 0,
	}
	assert.deepEqual(result[url("Broken")].opening, plain)
	assert.deepEqual(result[url("Missing")].opening, plain)
	// Only the opening crosses to the page.
	const sent = pageDescriptions(result)
	assert.equal(sent[page].text, null)
	assert.deepEqual(sent[page].opening, result[page].opening)
	assert.notEqual(
		catalogVersion(sent),
		catalogVersion(
			pageDescriptions({
				...result,
				[page]: { ...result[page], opening: plain },
			}),
		),
	)
	await read([page], { openings: false })
	assert.ok(!sql.at(-1)?.includes("description_doc"))
})
