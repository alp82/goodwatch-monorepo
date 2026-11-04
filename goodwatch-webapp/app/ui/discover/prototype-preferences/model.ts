// PROTOTYPE - throwaway (discover search preferences, see README.md). How one V7 answer reads on Discover: which words
// became preferences, which stay strict, which manual picks are pinned, the result tiers, and the URL changes behind
// Require, Back to a preference, Remove word and Reset. Pure, no React.
import { MOODS } from "~/domain/moods"
import { STYLES, THEMES } from "~/domain/themes-styles"

/** The V7 preview service's answer (POST /api/search on 127.0.0.1:5219). */
export interface Proposal {
	parameter: string
	value: string
	phrase: string
	reason: string
	source: string
	status: string
}
export interface PolicyOrders {
	policy: string
	params: string
	error: string | null
	total: number
	relevance: { keys: number[]; total: number }
	bestRated: { keys: number[]; total: number }
}
export interface V7Answer {
	query: string
	semanticQuery: string
	existing: string
	branch: "title-guard" | "negative-baseline" | "positive" | "budget-baseline"
	baseline: PolicyOrders
	v7: PolicyOrders
	prefs: Proposal[]
	retainedHard: Proposal[]
	recognized: number[]
	negativeClauses: string[]
	params: { baseline: string; v7: string }
	identityRepairs: unknown[]
	transportAction: string
	catalogue: boolean
	/** Display only: every applied interpretation with its phrase, and the reading as Discover's search shows it. */
	proposals?: Proposal[]
	/** Display only: each hard filter read from the words, and how many titles it keeps out (see the README). */
	hardHides?: { phrase: string; params: [string, string][]; hides: number; universe: "search" | "catalog" }[]
	readingChips?: import("~/server/combined-search/reading-retrieval.server").ReadingChip[]
	timing: Record<string, unknown>
	source: Record<string, unknown>
}

export const GROUPS = ["genres", "themes", "moods", "styles"] as const
export type Group = (typeof GROUPS)[number]
const isGroup = (key: string): key is Group =>
	(GROUPS as readonly string[]).includes(key)

/** Discover's tab and field for each group, as the bar names them. */
export const GROUP_FIELD: Record<Group, { field: string; tab: string }> = {
	genres: { field: "Genre", tab: "Mood" },
	themes: { field: "About", tab: "Mood" },
	moods: { field: "Mood", tab: "Mood" },
	styles: { field: "Style", tab: "Mood" },
}

export function valueLabel(group: string, value: string): string {
	if (group === "themes") return THEMES.find((t) => t.id === value)?.name ?? value
	if (group === "styles") return STYLES.find((t) => t.id === value)?.name ?? value
	if (group === "moods") return MOODS.find((m) => m.key === value)?.name ?? value
	return value
}

/** One word of the query, or one manual pick, as the readout shows it. */
export interface Word {
	group: Group | null
	/** URL parameter(s) and value. */
	param: string
	value: string
	label: string
	/** The query's words it came from, when it came from the query. */
	phrase?: string
	why?: string
}

export interface Readout {
	query: string
	branch: V7Answer["branch"]
	/** Soft: they lift titles under Relevance; they never remove one. */
	prefs: Word[]
	/** Strict because of the words: kept form/provenance, an exclusion, the too-broad fallback, years/type/etc. */
	searchStrict: Word[]
	/** Manual picks (URL) in the four groups. `phrase` set when the query also says it: it was "pinned from your words". */
	pinned: Word[]
	/** Query words a manual pick overrides: "Action" while Genre: Comedy is pinned. */
	setAside: { phrase: string; by: Word }[]
	negative: string[]
	recognized: number[]
	/** Every query word went into filters: Discover's catalogue order over those filters. */
	catalogue: boolean
	total: number
	/** The original (pre-preference) search's count, and how many of its titles are in this list. */
	originalTotal: number
	originalInList: number
	original: ReadonlySet<number>
	/** One plain sentence for how this list is built. */
	how: string
}

const DEFAULTS: Record<string, string> = { services: "all", unseen: "0" }
const STRUCTURAL_LABEL = (key: string, value: string, all: URLSearchParams): string | null => {
	if (key === "type") return value === "movie" ? "Movies" : value === "show" ? "Shows" : null
	if (key === "anime") return value === "only" ? "Anime" : value === "none" ? "No anime" : null
	if (key === "minYear") {
		const max = all.get("maxYear")
		return max ? `Released ${value}–${max}` : `Released ${value} or later`
	}
	if (key === "maxYear") return all.get("minYear") ? null : `Released until ${value}`
	if (key === "maxRuntime") return `Up to ${value} min`
	if (key === "minRuntime") return `At least ${value} min`
	if (key === "minScore") return `GW score ${value}+`
	if (key === "services") return value === "mine" ? "On my services" : `Services ${value}`
	if (key === "productionCountries") return `Origin ${value}`
	return `${key} ${value}`
}

const list = (value: string | null) => (value ?? "").split(",").filter(Boolean)
const norm = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
/** The query mentions this word (or the start of it: "historical" for History). */
export function mentions(query: string, label: string, phrase?: string): boolean {
	const q = ` ${norm(query)} `
	if (phrase && q.includes(` ${norm(phrase)} `)) return true
	const l = norm(label)
	if (q.includes(` ${l} `)) return true
	const stem = l.slice(0, Math.max(4, l.length - 2))
	return l.length >= 5 && q.split(" ").some((w) => w.length >= 4 && w.startsWith(stem))
}

function retainedWhy(p: Proposal): string {
	if (p.parameter === "themes" && p.value === "true")
		return "Stays a filter, read from title data: it's about where the story comes from, not how it feels."
	if (p.parameter === "styles")
		return `Stays a filter, read from title data: ${valueLabel(p.parameter, p.value)} is the form of a title.`
	return "Stays a filter."
}

/** Which matched group a leftover query word would mean (for set-aside words). */
function groupOfWord(word: string): { group: Group; value: string } | null {
	const w = norm(word)
	if (w.length < 4) return null
	for (const t of THEMES) if (mentions(w, t.name)) return { group: "themes", value: t.id }
	for (const t of STYLES) if (mentions(w, t.name)) return { group: "styles", value: t.id }
	for (const m of MOODS) if (mentions(w, m.name)) return { group: "moods", value: m.key }
	return null
}
const GENRES = [
	"Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama", "Family", "Fantasy", "History",
	"Horror", "Music", "Mystery", "Romance", "Science Fiction", "Thriller", "War", "Western",
]

export function readout(answer: V7Answer, url: URLSearchParams): Readout {
	const manual = new URLSearchParams(answer.existing)
	const v7 = new URLSearchParams(answer.params.v7)
	const query = answer.query
	const pinned: Word[] = []
	for (const group of GROUPS)
		for (const value of list(url.get(group))) {
			const label = valueLabel(group, value)
			pinned.push({
				group,
				param: group,
				value,
				label,
				phrase: mentions(query, label) ? label : undefined,
			})
		}
	const prefs: Word[] = answer.prefs.map((p) => ({
		group: isGroup(p.parameter) ? p.parameter : null,
		param: p.parameter,
		value: p.value,
		label: valueLabel(p.parameter, p.value),
		phrase: p.phrase,
		why: "Lifts titles that fit; doesn't remove any.",
	}))
	const retained = new Set(answer.retainedHard.map((p) => `${p.parameter}=${p.value}`))
	const searchStrict: Word[] = answer.retainedHard.map((p) => ({
		group: isGroup(p.parameter) ? p.parameter : null,
		param: p.parameter,
		value: p.value,
		label: valueLabel(p.parameter, p.value),
		phrase: p.phrase,
		why: retainedWhy(p),
	}))
	const branchWhy =
		answer.branch === "negative-baseline"
			? `Your search leaves something out (“${answer.negativeClauses.join("”, “")}”), so it works as before: filters read from your words stay filters.`
			: answer.branch === "budget-baseline"
				? "This search matched too much to rank this way, so it works as before: filters read from your words stay filters."
				: "Years, type, runtime, country, services and scores read from your words are always filters."
	for (const [key, value] of v7) {
		if (DEFAULTS[key] === value && !manual.has(key)) continue
		if (manual.get(key) === value) continue
		if (isGroup(key)) {
			const have = new Set(list(manual.get(key)))
			for (const v of list(value))
				if (!have.has(v) && !retained.has(`${key}=${v}`))
					searchStrict.push({ group: key, param: key, value: v, label: valueLabel(key, v), why: branchWhy })
			continue
		}
		const label = STRUCTURAL_LABEL(key, value, v7)
		if (label) searchStrict.push({ group: null, param: key, value, label, why: branchWhy })
	}
	// Words of the query that neither stayed in the search text nor became a preference or strict filter, and that a
	// manual pick in the same group decides instead.
	const used = norm(
		[answer.semanticQuery, ...answer.prefs.map((p) => p.phrase), ...answer.retainedHard.map((p) => p.phrase)].join(" "),
	).split(" ")
	const setAside: Readout["setAside"] = []
	if (answer.branch === "positive" && !answer.catalogue)
		for (const word of norm(query).split(" ")) {
			if (!word || used.includes(word)) continue
			const genre = GENRES.find((g) => norm(g) === word)
			const meant = genre ? { group: "genres" as Group, value: genre } : groupOfWord(word)
			if (!meant) continue
			const values = list(manual.get(meant.group))
			if (values.length && !values.includes(meant.value)) {
				const by = pinned.find((p) => p.group === meant.group)
				if (by) setAside.push({ phrase: word, by })
			}
		}
	const original = new Set(answer.baseline.relevance.keys)
	const keys = answer.v7.relevance.keys
	const originalInList = keys.filter((k) => original.has(k)).length
	const how = answer.catalogue
		? "Your words all became filters, so this is Discover's list for those filters (by popularity under Relevance), not a search ranking."
		: answer.branch === "title-guard"
			? "You named a title, so it comes first. The rest are other results for your words, not necessarily like it."
			: answer.branch === "negative-baseline"
				? "Your search leaves something out, so it works as before. Leaving out relies on title data, so it isn't guaranteed."
				: answer.branch === "budget-baseline"
					? "This search matched too much to rank this way, so it works as before."
					: prefs.length
						? `${prefs.map((p) => p.label).join(" and ")} ${prefs.length > 1 ? "lift" : "lifts"} titles that fit. Titles without ${prefs.length > 1 ? "them" : "it"} can still appear.`
						: "Ranked by how well titles fit your words."
	return {
		query,
		branch: answer.branch,
		prefs,
		searchStrict,
		pinned,
		setAside,
		negative: answer.negativeClauses,
		recognized: answer.recognized,
		catalogue: answer.catalogue,
		total: answer.v7.total,
		originalTotal: answer.baseline.total,
		originalInList,
		original,
		how,
	}
}

/** The manual filters the V7 service gets as `existing`: the URL without search, view and prototype keys. */
const NOT_FILTERS = ["q", "asked", "page", "allTitles", "sort", "layout", "side", "mode", "variant", "open", "inspect", "strict", "foryou", "off"]
export function manualExisting(params: URLSearchParams): string {
	const out = new URLSearchParams(params)
	for (const key of NOT_FILTERS) out.delete(key)
	return out.toString()
}
