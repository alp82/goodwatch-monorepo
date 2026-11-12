import {
	chooseExactSearch,
	exactName,
	type ExactEntity,
} from "../domain/exact-search.ts"
import { tropeUrl } from "../domain/trope-filter.ts"
import { interpret } from "../domain/discover-query"
import { citedYear } from "../domain/cited-year.ts"
import { MOODS } from "../domain/moods"
import { STYLES, THEMES } from "../domain/themes-styles"
import {
	catalogEntries,
	startPaletteCatalog,
} from "./command-palette/catalog.server"
import {
	loadedSearchIndex,
	type SearchIndex,
} from "./search-ranking/search-index.server"
import { aliasName } from "./search-ranking/aliases.server"

const concepts = new Set(
	[
		...MOODS.map((m) => m.name),
		...STYLES.map((s) => s.name),
		...THEMES.map((t) => t.name),
		"Dark",
		"Comedy",
		"Drama",
		"Action",
		"Horror",
		"Romance",
		"Mystery",
		"Thriller",
		"Fantasy",
		"Musical",
		"Documentary",
		"Animation",
	].map(exactName),
)
const titleNames = new WeakMap<SearchIndex, Map<string, ExactEntity[]>>()
let previousTropes: unknown
let tropeNames = new Map<string, ExactEntity[]>()
function add(
	map: Map<string, ExactEntity[]>,
	name: string,
	entity: ExactEntity,
) {
	const key = exactName(name)
	if (!key) return
	const list = map.get(key) ?? []
	if (!list.some((e) => e.id === entity.id)) list.push(entity)
	map.set(key, list)
}

export const startExactSearchResolution = () => startPaletteCatalog()

/** Reads existing in-memory catalogues; no network, provider calls or per-query catalogue scans. */
export function resolveExactSearch(query: string) {
	if (!query.trim() || query.length > 512) return null
	const index = loadedSearchIndex()
	if (!index) return null
	startPaletteCatalog()
	// Both namespaces must be known before deciding that a match is unambiguous.
	const tropes = catalogEntries("tropes")
	if (!tropes.length) return null
	if (previousTropes !== tropes) {
		tropeNames = new Map()
		for (const e of tropes) {
			const id = tropeUrl(e.item.key.replace(/^trope-/, ""))
			if (!id) continue
			const entity: ExactEntity = {
				kind: "trope",
				id,
				label: e.item.label,
				names: e.names,
			}
			for (const name of e.names) add(tropeNames, name, entity)
		}
		previousTropes = tropes
	}
	let titles = titleNames.get(index)
	if (!titles) {
		titles = new Map()
		const t = index.titleTable
		const entities = new Map<number, ExactEntity>()
		const adult = t.flagNames.indexOf("adult")
		for (let row = 0; row < t.size; row++) {
			if (
				t.votes[row] < 1000 ||
				Number.isNaN(t.goodwatchScores[row]) ||
				(adult >= 0 && (t.flags[row] >> adult) & 1)
			)
				continue
			const id = String(t.pointIds[row])
			const entity: ExactEntity = {
				kind: "title",
				id,
				label: t.titles[row],
				year: t.years[row],
				names: [t.titles[row], t.originalTitles[row]],
			}
			entities.set(row, entity)
			for (const name of entity.names) if (name) add(titles, name, entity)
		}
		for (let i = 0; i < index.aliases.size; i++) {
			const entity = entities.get(index.aliases.rows[i])
			if (entity) add(titles, aliasName(index.aliases, i), entity)
		}
		titleNames.set(index, titles)
	}
	const exact = chooseExactSearch(
		query,
		(name) => [...(tropeNames.get(name) ?? []), ...(titles!.get(name) ?? [])],
		concepts,
	)
	if (
		exact?.kind === "title" &&
		!/^["“]|^(?:(?:movies?|shows?|series)\s+)?(?:like|similar to)\s/i.test(
			query.trim(),
		) &&
		!citedYear(query)
	) {
		const parsed = interpret(query)
		// A bare title that is also wholly understood as filters (Brazil, Black Comedy…) remains ambiguous.
		if (!parsed.residual && parsed.proposals.length) return null
	}
	return exact
}
