// PROTOTYPE - throwaway (discover search preferences, see README.md). What the search read from the words, as items the
// person can switch off and on, and the filter state Discover's controls show: the manual filters plus the items that
// are on. The URL keeps the two apart: manual filters as Discover's own parameters, switched-off items as `off=<phrase>`
// (the words stay in `q`, and the phrase is left out of what the search reads). A change made through the controls is
// translated back, so an interpreted item is never turned into a manual filter by switching modes or opening a panel:
// - an item the change removes is switched off;
// - a switched-off item the change brings back is switched on again;
// - anything else the change adds is a manual choice, as on Discover today.
import { useSearchParams } from "@remix-run/react"
import { useCallback, useMemo, useRef } from "react"
import {
	type FilterDefaults,
	type FilterName,
	type FilterState,
	filterQuery,
	filterStateFromParams,
	filterStateToParams,
	resolveFilterChange,
} from "~/domain/filter-state"
import { activeChips } from "~/ui/filter-bar/labels"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"
import type { V7Answer } from "./model"

const GROUPS = new Set(["genres", "themes", "moods", "styles"])
const list = (value: string | null) => (value ?? "").split(",").filter(Boolean)

export interface Item {
	/** The words it was read from, as they appear in the query; the key of `off`. */
	phrase: string
	params: [string, string][]
	/** A preference: lifts titles that fit, hides none (V7). Otherwise a filter the search applies. */
	soft: boolean
	/**
	 * Words the search reads as they are (text and fingerprint ranking), with no filter or preference of their own,
	 * such as "epic". The fingerprint qualities on the line come from all the words switched on together.
	 */
	words?: boolean
	/** Your own choice in the same group takes over (manual wins): not read, not switchable. Names that choice. */
	aside?: string
	on: boolean
	/** Discover's filter group and words for it, as the bar and the Matches list name them. */
	group: FilterName | null
	field: string
	label: string
	/** The keys of the bar chips that show it, to tell them from manual filters' chips. */
	chipKeys: string[]
}

/** The words the search reads: the query without the switched-off phrases. Null when nothing is left. */
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

function toParams(state: FilterState, defaults: FilterDefaults) {
	return filterStateToParams(state, defaults, new URLSearchParams())
}
function fromParams(params: URLSearchParams, defaults: FilterDefaults) {
	return filterStateFromParams(params, defaults)
}

export function applyItem(state: FilterState, item: Item, defaults: FilterDefaults): FilterState {
	const params = toParams(state, defaults)
	for (const [key, value] of item.params) {
		if (GROUPS.has(key)) {
			const values = new Set(list(params.get(key)))
			values.add(value)
			params.set(key, [...values].join(","))
			continue
		}
		if (key === "minYear" || key === "maxYear") {
			params.delete("years")
			params.delete("released")
		}
		if (key === "minRuntime" || key === "maxRuntime") params.delete("runtime")
		params.set(key, value)
	}
	return fromParams(params, defaults)
}

export function hasItem(state: FilterState, item: Item, defaults: FilterDefaults): boolean {
	// Group values by membership: adding a fourth mood to a full set of three changes nothing (Discover keeps three),
	// which a compare-after-adding test would misread as "already there".
	const groups = item.params.filter(([key]) => GROUPS.has(key))
	if (groups.some(([key, value]) => !((state as unknown as Record<string, string[]>)[key] ?? []).includes(value)))
		return false
	const rest = { ...item, params: item.params.filter(([key]) => !GROUPS.has(key)) }
	if (!rest.params.length) return true
	return (
		filterQuery(applyItem(state, rest, defaults), "popular", defaults) ===
		filterQuery(state, "popular", defaults)
	)
}

function stripItem(state: FilterState, item: Item, defaults: FilterDefaults): FilterState {
	const params = toParams(state, defaults)
	for (const [key, value] of item.params) {
		if (GROUPS.has(key)) {
			const values = list(params.get(key)).filter((v) => v !== value)
			if (values.length) params.set(key, values.join(","))
			else params.delete(key)
		} else if (key === "minYear" || key === "maxYear") {
			for (const k of ["years", "minYear", "maxYear", "released"]) params.delete(k)
		} else if (key === "minRuntime" || key === "maxRuntime") {
			for (const k of ["runtime", "minRuntime", "maxRuntime"]) params.delete(k)
		} else params.delete(key)
	}
	return fromParams(params, defaults)
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
 * The items of the full query's answer that V7 actually applies: its preferences, and the filters in its own
 * parameters. An interpretation V7 sets aside (the exact-title guard keeps only your filters) isn't shown as applied.
 */
export function itemsOf(answer: V7Answer | null, off: readonly string[], defaults: FilterDefaults): Item[] {
	if (!answer?.proposals) return []
	const v7 = new URLSearchParams(answer.params.v7)
	const manual = new URLSearchParams(answer.existing)
	const soft = new Set(answer.prefs.map((p) => `${p.parameter}=${p.value}`))
	const applied = (key: string, value: string) =>
		soft.has(`${key}=${value}`) ||
		(GROUPS.has(key) ? list(v7.get(key)).includes(value) : v7.get(key) === value)
	const byPhrase = new Map<string, [string, string][]>()
	const asidePhrases = new Map<string, [string, string][]>()
	for (const p of answer.proposals) {
		if (p.status === "existing wins") {
			const at = asidePhrases.get(p.phrase) ?? []
			at.push([p.parameter, p.value])
			asidePhrases.set(p.phrase, at)
			continue
		}
		if (!applied(p.parameter, p.value)) continue
		if (manual.get(p.parameter) === p.value || list(manual.get(p.parameter)).includes(p.value)) continue
		const at = byPhrase.get(p.phrase) ?? []
		at.push([p.parameter, p.value])
		byPhrase.set(p.phrase, at)
	}
	const base = fromParams(new URLSearchParams(), defaults)
	const items: Item[] = []
	for (const [phrase, params] of byPhrase) {
		const item: Item = {
			phrase,
			params,
			soft: params.every(([k, v]) => soft.has(`${k}=${v}`)),
			on: !off.some((o) => o.toLowerCase() === phrase.toLowerCase()),
			group: null,
			field: "",
			label: phrase,
			chipKeys: [],
		}
		// The bar's own chip for the item alone: the same words Discover uses for that filter.
		const chips = activeChips(applyItem(base, item, defaults), {})
		const chip = chips[0]
		if (chip) {
			item.group = chip.group as FilterName
			item.field = FIELDS[chip.group ?? ""] ?? ""
			item.label = chips.map((c) => c.label).join(" · ")
			item.chipKeys = chips.map((c) => c.key)
		}
		items.push(item)
	}
	// Words your own choice sets aside, shown so they don't just vanish: the field of that choice says which.
	for (const [phrase, params] of asidePhrases) {
		if (byPhrase.has(phrase)) continue
		const chips = activeChips(applyItem(base, { params } as Item, defaults), {})
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
	// The rest of the words: each run of words no item took is one switch, so Clear really switches off everything the
	// search reads. A named title is read as one piece.
	const typed = answer.query
	const semantic = new Set(
		answer.semanticQuery.toLowerCase().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, "")),
	)
	const taken: [number, number][] = []
	for (const item of items) {
		// (set-aside words included: they aren't plain words either)
		const at = typed.toLowerCase().indexOf(item.phrase.toLowerCase())
		if (at >= 0) taken.push([at, at + item.phrase.length])
	}
	const runs: string[] = []
	if (answer.branch === "title-guard") runs.push(typed.trim())
	else {
		let run: [number, number] | null = null
		for (const m of typed.matchAll(/\S+/g)) {
			const start = m.index ?? 0
			const end = start + m[0].length
			// Only words the search still reads: a word your own filter sets aside (manual wins) isn't offered.
			const free =
				taken.every(([a, b]) => end <= a || start >= b) &&
				/[\p{L}\p{N}]/u.test(m[0]) &&
				semantic.has(m[0].toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ""))
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
				on: !off.some((o) => o.toLowerCase() === phrase.toLowerCase()),
				group: null,
				field: "",
				label: `“${phrase}”`,
				chipKeys: [],
			})
	// Same field together, so the line names each field once ("Mood Funny · Dark · Scary").
	const order = [...new Set(items.map((item) => item.field))]
	return items.sort((a, b) => order.indexOf(a.field) - order.indexOf(b.field))
}

/**
 * Discover's filter binding, as the controls see it: the manual filters plus the items that are on. Its changes go
 * back as manual filters and switched-off items (see the top of this file). `query` stays the manual one, which is what
 * the results and the panel's counts are asked with.
 */
export function useInterpretedFilters(
	real: FilterStateBinding,
	items: readonly Item[],
	enabled: boolean,
): FilterStateBinding {
	const [, setParams] = useSearchParams()
	const { defaults } = real
	const shown = useMemo(
		() =>
			enabled
				? items
						.filter((item) => item.on && !item.words && !item.aside && !hasItem(real.state, item, defaults))
						.reduce((state, item) => applyItem(state, item, defaults), real.state)
				: real.state,
		[enabled, items, real.state, defaults],
	)
	// The latest state, read at call time: a panel's content can keep a callback from an earlier render.
	const latest = useRef({ shown, items, real })
	latest.current = { shown, items, real }
	const update = useCallback(
		(change: (state: FilterState) => FilterState) => {
			const { shown, items, real } = latest.current
			if (!enabled) return real.update(change)
			const next = resolveFilterChange(shown, change(shown))
			let manual = next
			// Only what this change switches: added to or taken from the URL's own `off` at the moment of writing.
			const switchOff = new Set<string>()
			const switchOn = new Set<string>()
			for (const item of items) {
				if (item.words || item.aside) continue
				const inNext = hasItem(next, item, defaults)
				const inManual = hasItem(real.state, item, defaults)
				if (item.on && !inNext && !inManual) switchOff.add(item.phrase.toLowerCase())
				if (!item.on && inNext && !inManual) switchOn.add(item.phrase.toLowerCase())
				if (inNext && !inManual) manual = stripItem(manual, item, defaults)
			}
			setParams(
				(previous) => {
					const offNow = previous.getAll("off").filter((phrase) => !switchOn.has(phrase.toLowerCase()))
					for (const item of items)
						if (switchOff.has(item.phrase.toLowerCase()) && !offNow.some((o) => o.toLowerCase() === item.phrase.toLowerCase()))
							offNow.push(item.phrase)
					const out = filterStateToParams(manual, defaults, new URLSearchParams(previous))
					out.delete("off")
					for (const phrase of offNow) out.append("off", phrase)
					out.delete("page")
					return out
				},
				{ replace: true, preventScrollReset: true },
			)
		},
		[enabled, defaults, setParams],
	)
	return useMemo(
		() =>
			enabled
				? {
						...real,
						state: shown,
						update,
						set: (patch: Partial<FilterState>) => update((s) => ({ ...s, ...patch })),
						clearSecondary: () => real.clearSecondary(),
					}
				: real,
		[enabled, real, shown, update],
	)
}

/** Switch one item, or all of them, off or on: the `off` parameters only. */
export function setOff(params: URLSearchParams, phrases: readonly string[]): URLSearchParams {
	const out = new URLSearchParams(params)
	out.delete("off")
	for (const phrase of phrases) out.append("off", phrase)
	out.delete("page")
	return out
}
