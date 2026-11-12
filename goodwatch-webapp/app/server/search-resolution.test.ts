import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { test } from "node:test"
import ts from "typescript"
import { chooseExactSearch, exactName } from "../domain/exact-search.ts"
import { tropeUrl } from "../domain/trope-filter.ts"

test("the shared resolver uses canonical tropes and title aliases, with no tag namespace or fuzzy matches", () => {
	const url = "https://tvtropes.org/pmwiki/pmwiki.php/Main/ApocalypseAnarchy"
	const titles = ["Arrival", "Dune", "Dune", "Dark", "Unscored", "Adult"]
	let index: any = {
		titleTable: {
			size: titles.length,
			titles,
			originalTitles: [...titles],
			votes: [3000, 3000, 3000, 3000, 3000, 3000],
			goodwatchScores: [80, 80, 80, 80, NaN, 80],
			flagNames: ["adult"],
			flags: [0, 0, 0, 0, 0, 1],
			years: [2016, 1984, 2021, 2017, 2000, 2000],
			pointIds: titles.map((_, i) => 1e12 + i + 1),
		},
		aliases: { size: 1, rows: [0] },
	}
	const exports: any = {}
	const code = ts.transpileModule(
		readFileSync(
			new URL("./search-resolution.server.ts", import.meta.url),
			"utf8",
		),
		{
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
		},
	).outputText
	runInNewContext(code, {
		exports,
		require: (name: string) => {
			if (name.includes("discover-query"))
				return {
					interpret: (query: string) => ({ residual: query, proposals: [] }),
				}
			if (name.includes("cited-year")) return { citedYear: () => null }
			if (name.includes("exact-search")) return { chooseExactSearch, exactName }
			if (name.includes("trope-filter")) return { tropeUrl }
			if (name.includes("domain/moods")) return { MOODS: [] }
			if (name.includes("domain/themes-styles"))
				return { THEMES: [], STYLES: [] }
			if (name.includes("catalog.server"))
				return {
					startPaletteCatalog: () => {},
					catalogEntries: (key: string) => {
						assert.equal(key, "tropes")
						return [
							{
								item: { key: `trope-${url}`, label: "Apocalypse Anarchy" },
								names: ["Apocalypse Anarchy", "Apocalypse Anarchy"],
							},
						]
					},
				}
			if (name.includes("search-index.server"))
				return { loadedSearchIndex: () => index }
			if (name.includes("aliases.server"))
				return { aliasName: () => "Premier Contact" }
			throw new Error(`Unexpected dependency: ${name}`)
		},
	})
	assert.equal(exports.resolveExactSearch("Apocalypse Anarchy").id, url)
	assert.equal(
		exports.resolveExactSearch("like premier contact").id,
		String(1e12 + 1),
	)
	assert.equal(exports.resolveExactSearch("like Dune (2021)").id, String(1e12 + 3))
	for (const query of [
		"Arrival",
		"premier contact",
		"Dune (2021)",
		'"Arrival"',
		"Dune",
		"Dark",
		"Unscored",
		"Adult",
		"Compelling Leads",
		"Arrival with a happy ending",
	])
		assert.equal(exports.resolveExactSearch(query), null, query)
	index = null
	assert.equal(
		exports.resolveExactSearch("Arrival"),
		null,
		"a cold catalogue never invents a match",
	)
})
