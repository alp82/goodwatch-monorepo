// What Discover's search read from the words, as items the person can switch off and on (the read strip and the
// Matches popout), and the filter state the controls show: the person's own filters plus the read items that are on.
// The URL keeps the two apart: the person's own filters as Discover's parameters, switched-off items as `off=<phrase>`.
// The words stay in `q`; a switched-off phrase is left out of what the search reads (readText).
//
// A change made through the controls goes back the same way (readFilterChange), so a read item never turns into one
// of the person's own filters by opening a panel or switching modes:
// - an item the change removes is switched off;
// - a switched-off item the change brings back is switched on again;
// - anything else the change adds is the person's own choice, as on Discover before.
//
// Pure, so the rules are tested without React (read-items.test.ts). The rules for what a reading becomes live in
// domain/search-preferences.ts.
import {
	type FilterDefaults,
	type FilterName,
	type FilterState,
	filterQuery,
	filterStateFromParams,
	filterStateToParams,
} from "~/domain/filter-state"
import {
	PREFERENCE_GROUPS,
	type ReadPlan,
	type ReadProposal,
} from "~/domain/search-preferences"
import { activeChips } from "~/ui/filter-bar/labels"

const GROUPS = new Set<string>(PREFERENCE_GROUPS)
const list = (value: string | null) => (value ?? "").split(",").filter(Boolean)
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** The interpreter's answer (/api/discover/interpret), as the read strip needs it. */
export interface Reading {
	/** The words as read. */
	query: string
	/** Discover's parameters: the person's own filters, the read ones, and `q` for the words searched as they are. */
	params: string
	proposals: readonly (Omit<ReadProposal, "status"> & { status: string })[]
	/** The clauses the words leave out ("without warfare"). */
	negated: readonly string[]
}

export interface ReadItem {
	/** The words it was read from, as they appear in the query; the key of `off`. */
	phrase: string
	params: [string, string][]
	/** A preference: titles that fit rank higher, none are hidden. Otherwise a filter. */
	soft: boolean
	/** Words the search reads as they are (text and fingerprint ranking), with no filter or preference of their own. */
	words?: boolean
	/** The person's own choice in the same group takes over: not read, not switchable. Names that choice's field. */
	aside?: string
	on: boolean
	/** Discover's filter group and the words for it, as the bar and Matches name them. */
	group: FilterName | null
	field: string
	label: string
	/** The keys of the bar chips that show it, to tell them from the person's own filters' chips. */
	chipKeys: string[]
}

const isOff = (off: readonly string[], phrase: string) => off.some((o) => same(o, phrase))

/** The words the search reads: the query without the switched-off phrases. Null when fewer than two letters are left. */
export function readText(q: string | null, off: readonly string[]): string | null {
	if (q === null) return null
	let text = q
	for (const phrase of off) {
		const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		text = text.replace(new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu"), "$1 ")
	}
	text = text.replace(/\s+/g, " ").trim()
	return text.length >= 2 ? text : null
}

const toParams = (state: FilterState, defaults: FilterDefaults) =>
	filterStateToParams(state, defaults, new URLSearchParams())

export function applyItem(
	state: FilterState,
	item: Pick<ReadItem, "params">,
	defaults: FilterDefaults,
): FilterState {
	const params = toParams(state, defaults)
	for (const [key, value] of item.params) {
		if (GROUPS.has(key)) {
			params.set(key, [...new Set([...list(params.get(key)), value])].join(","))
			continue
		}
		if (key === "minYear" || key === "maxYear") {
			params.delete("years")
			params.delete("released")
		}
		if (key === "minRuntime" || key === "maxRuntime") params.delete("runtime")
		params.set(key, value)
	}
	return filterStateFromParams(params, defaults)
}

/** Whether the state already holds the item. */
export function hasItem(state: FilterState, item: Pick<ReadItem, "params">, defaults: FilterDefaults): boolean {
	// Group values by membership: adding a fourth mood to three changes nothing (Discover keeps three), which a
	// compare-after-adding test would misread as "already there".
	const groups = item.params.filter(([key]) => GROUPS.has(key))
	const values = state as unknown as Record<string, string[] | undefined>
	if (groups.some(([key, value]) => !(values[key] ?? []).includes(value))) return false
	const rest = item.params.filter(([key]) => !GROUPS.has(key))
	if (!rest.length) return true
	return (
		filterQuery(applyItem(state, { params: rest }, defaults), "popular", defaults) ===
		filterQuery(state, "popular", defaults)
	)
}

export function stripItem(state: FilterState, item: Pick<ReadItem, "params">, defaults: FilterDefaults): FilterState {
	const params = toParams(state, defaults)
	for (const [key, value] of item.params) {
		if (GROUPS.has(key)) {
			const kept = list(params.get(key)).filter((v) => v !== value)
			if (kept.length) params.set(key, kept.join(","))
			else params.delete(key)
		} else if (key === "minYear" || key === "maxYear") {
			for (const k of ["years", "minYear", "maxYear", "released"]) params.delete(k)
		} else if (key === "minRuntime" || key === "maxRuntime") {
			for (const k of ["runtime", "minRuntime", "maxRuntime"]) params.delete(k)
		} else params.delete(key)
	}
	return filterStateFromParams(params, defaults)
}

const FIELDS: Record<string, string> = {
	moods: "Mood",
	themes: "About",
	styles: "Style",
	genres: "Genre",
	years: "Released",
	released: "Released",
	type: "Format",
	anime: "Anime",
	runtime: "Runtime",
	minScore: "GW score",
	productionCountries: "Origin",
	services: "Service",
}

/**
 * The items of the whole query's reading that its plan applies: the preferences and the filters, then the words your
 * own choice sets aside, then each run of words searched as they are. A named title is one run of words.
 */
export function readItems({
	reading,
	existing,
	plan,
	off,
	defaults,
}: {
	reading: Reading
	/** The person's own filters, as the interpreter got them. */
	existing: string
	plan: ReadPlan
	off: readonly string[]
	defaults: FilterDefaults
}): ReadItem[] {
	const read = new URLSearchParams(reading.params)
	const own = new URLSearchParams(existing)
	const isOwn = (key: string, value: string) => (GROUPS.has(key) ? list(own.get(key)).includes(value) : own.get(key) === value)
	// The plan's filters hold the person's own and the hard ones read from the words; its preferences the soft ones.
	const soft = new Set(plan.preferences.map((p) => `${p.group}=${p.value}`))
	const hard = plan.filters
	const applied = (key: string, value: string) =>
		soft.has(`${key}=${value}`) || (GROUPS.has(key) ? list(hard.get(key)).includes(value) : hard.get(key) === value)
	const byPhrase = new Map<string, [string, string][]>()
	const aside = new Map<string, [string, string][]>()
	if (plan.branch !== "title")
		for (const p of reading.proposals) {
			if (p.status === "existing wins") {
				aside.set(p.phrase, [...(aside.get(p.phrase) ?? []), [p.parameter, p.value]])
				continue
			}
			if (p.status !== "applied" || !applied(p.parameter, p.value) || isOwn(p.parameter, p.value)) continue
			byPhrase.set(p.phrase, [...(byPhrase.get(p.phrase) ?? []), [p.parameter, p.value]])
		}
	const base = filterStateFromParams(new URLSearchParams(), defaults)
	const items: ReadItem[] = []
	for (const [phrase, params] of byPhrase) {
		const chips = activeChips(applyItem(base, { params }, defaults), {})
		items.push({
			phrase,
			params,
			soft: params.every(([k, v]) => soft.has(`${k}=${v}`)),
			on: !isOff(off, phrase),
			group: (chips[0]?.group as FilterName | undefined) ?? null,
			field: FIELDS[chips[0]?.group ?? ""] ?? "",
			label: chips.length ? chips.map((c) => c.label).join(" · ") : phrase,
			chipKeys: chips.map((c) => c.key),
		})
	}
	// Words the person's own choice sets aside, shown so they don't just vanish: the field of that choice says which.
	for (const [phrase, params] of aside) {
		if (byPhrase.has(phrase)) continue
		const chips = activeChips(applyItem(base, { params }, defaults), {})
		const field = FIELDS[chips[0]?.group ?? ""] ?? ""
		items.push({
			phrase,
			params,
			soft: true,
			on: false,
			aside: field || "your filter",
			group: null,
			field,
			label: chips.map((c) => c.label).join(" · ") || phrase,
			chipKeys: [],
		})
	}
	// The rest of the words: each run of words no item took is one switch, so Clear switches off everything the search
	// reads.
	const typed = reading.query
	const norm = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "")
	const searched = new Set((read.get("q") ?? "").split(/\s+/).map(norm))
	const taken: [number, number][] = []
	for (const item of items) {
		const at = typed.toLowerCase().indexOf(item.phrase.toLowerCase())
		if (at >= 0) taken.push([at, at + item.phrase.length])
	}
	const runs: string[] = []
	if (plan.branch === "title") runs.push(typed.trim())
	else {
		let run: [number, number] | null = null
		for (const m of typed.matchAll(/\S+/g)) {
			const start = m.index ?? 0
			const end = start + m[0].length
			const free =
				taken.every(([a, b]) => end <= a || start >= b) &&
				/[\p{L}\p{N}]/u.test(m[0]) &&
				searched.has(norm(m[0]))
			if (free) run = run ? [run[0], end] : [start, end]
			else if (run) {
				runs.push(typed.slice(run[0], run[1]))
				run = null
			}
		}
		if (run) runs.push(typed.slice(run[0], run[1]))
	}
	for (const phrase of runs)
		if (phrase)
			items.push({
				phrase,
				params: [],
				soft: true,
				words: true,
				on: !isOff(off, phrase),
				group: null,
				field: "",
				label: `“${phrase}”`,
				chipKeys: [],
			})
	// One field together, so the strip names each field once ("Mood Funny · Dark · Scary").
	const order = [...new Set(items.map((item) => item.field))]
	return items.sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field))
}

/** The state the controls show: the person's own filters plus the read items switched on. */
export function shownState(own: FilterState, items: readonly ReadItem[], defaults: FilterDefaults): FilterState {
	return items
		.filter((item) => item.on && !item.words && !item.aside && !hasItem(own, item, defaults))
		.reduce((state, item) => applyItem(state, item, defaults), own)
}

/**
 * A change made through the controls on the shown state, back as the person's own filters and the `off` list.
 * `next` is the shown state after the change.
 */
export function readFilterChange({
	own,
	next,
	items,
	off,
	defaults,
}: {
	own: FilterState
	next: FilterState
	items: readonly ReadItem[]
	off: readonly string[]
	defaults: FilterDefaults
}): { own: FilterState; off: string[] } {
	let manual = next
	const switchOff: string[] = []
	const switchOn = new Set<string>()
	for (const item of items) {
		if (item.words || item.aside) continue
		const inNext = hasItem(next, item, defaults)
		const inOwn = hasItem(own, item, defaults)
		if (item.on && !inNext && !inOwn) switchOff.push(item.phrase)
		if (!item.on && inNext && !inOwn) switchOn.add(item.phrase.toLowerCase())
		if (inNext && !inOwn) manual = stripItem(manual, item, defaults)
	}
	const kept = off.filter((phrase) => !switchOn.has(phrase.toLowerCase()))
	for (const phrase of switchOff) if (!isOff(kept, phrase)) kept.push(phrase)
	return { own: manual, off: kept }
}

/** The URL with these phrases switched off (and only these): the `off` parameters, back to the first page. */
export function withOff(params: URLSearchParams, phrases: readonly string[]): URLSearchParams {
	const out = new URLSearchParams(params)
	out.delete("off")
	for (const phrase of phrases) out.append("off", phrase)
	out.delete("page")
	return out
}

/** Which row carries the search's scope count: the first plain words switched on, else the first preference on. */
export function scopeOwner(items: readonly ReadItem[]): string | null {
	const live = items.filter((item) => item.on && !item.aside)
	return (live.find((item) => item.words) ?? live.find((item) => item.soft))?.phrase ?? null
}
