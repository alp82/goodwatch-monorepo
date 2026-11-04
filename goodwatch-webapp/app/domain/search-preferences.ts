// How Discover's search uses what it reads from the words (issue #726; docs/implementation/search-preferences.md).
//
// The interpreter turns supported phrases into Discover filters. Discover's search then splits them:
// - A genre, theme, mood or style read from the words is a preference: under Relevance, titles that fit rank higher,
//   and none are hidden. Two kinds stay filters, because they're about what a title is rather than how it feels:
//   True stories, and the Animated and Documentary forms.
// - Everything else the words set (years, type, runtime, country, services, scores, people…) stays a filter.
// - A filter the person chose themself always stays a filter, and it wins over the words (the interpreter's
//   "existing wins").
// - A search that leaves something out ("without warfare") keeps every read filter strict, as before.
// - A search that names a title uses only the person's own filters: the words are the title.
// - Words that all became filters leave nothing to rank: Discover's list for those filters, every one strict.
//
// Pure, so the rules are tested without a server (search-preferences.test.ts).

export const PREFERENCE_GROUPS = ["genres", "themes", "moods", "styles"] as const
export type PreferenceGroup = (typeof PREFERENCE_GROUPS)[number]
const isGroup = (key: string): key is PreferenceGroup =>
	(PREFERENCE_GROUPS as readonly string[]).includes(key)

/** What the interpreter applied or set aside, as the search uses it. */
export interface ReadProposal {
	parameter: string
	value: string
	phrase: string
	status: "applied" | "existing wins"
}

export interface Preference {
	group: PreferenceGroup
	value: string
}

export type ReadBranch = "positive" | "exclusion" | "title" | "catalogue"

export interface ReadPlan {
	branch: ReadBranch
	/** Read preferences: they order the list, never filter it. */
	preferences: Preference[]
	/** The filters the search applies: the person's own and the hard ones read from the words, without `q`. */
	filters: URLSearchParams
	/** The original reading's filters (preferences as filters too): what "matches every read filter" means. */
	original: URLSearchParams
}

/** True stories, Animated and Documentary describe what a title is: they stay filters. */
export function staysFilter(parameter: string, value: string): boolean {
	return (
		(parameter === "themes" && value === "true") ||
		(parameter === "styles" && (value === "animated" || value === "documentary"))
	)
}

const list = (value: string | null) => (value ?? "").split(",").filter(Boolean)

function without(params: URLSearchParams, preferences: readonly Preference[]) {
	const out = new URLSearchParams(params)
	for (const group of PREFERENCE_GROUPS) {
		const drop = new Set(preferences.filter((p) => p.group === group).map((p) => p.value))
		if (!drop.size) continue
		const kept = list(out.get(group)).filter((value) => !drop.has(value))
		if (kept.length) out.set(group, kept.join(","))
		else out.delete(group)
	}
	return out
}

/**
 * The search's plan for one reading. `params` are the interpreter's filters (the person's own merged with the read
 * ones), `existing` the person's own.
 */
export function readPlan({
	params,
	existing,
	proposals,
	negated,
	namedTitle,
}: {
	params: string
	existing: string
	proposals: readonly ReadProposal[]
	negated: readonly string[]
	namedTitle: boolean
}): ReadPlan {
	const interpreted = new URLSearchParams(params)
	const words = Boolean(interpreted.get("q")?.trim())
	interpreted.delete("q")
	const own = new URLSearchParams(existing)
	if (namedTitle) return { branch: "title", preferences: [], filters: own, original: own }
	if (negated.length)
		return { branch: "exclusion", preferences: [], filters: interpreted, original: interpreted }
	if (!words) return { branch: "catalogue", preferences: [], filters: interpreted, original: interpreted }
	const preferences: Preference[] = []
	for (const p of proposals) {
		if (p.status !== "applied" || !isGroup(p.parameter) || staysFilter(p.parameter, p.value)) continue
		if (list(own.get(p.parameter)).includes(p.value)) continue
		if (!list(interpreted.get(p.parameter)).includes(p.value)) continue
		if (preferences.some((q) => q.group === p.parameter && q.value === p.value)) continue
		preferences.push({ group: p.parameter, value: p.value })
	}
	return { branch: "positive", preferences, filters: without(interpreted, preferences), original: interpreted }
}

/** `prefer=moods:funny,themes:history`: the read preferences, for the results endpoint. */
export function preferencesParam(preferences: readonly Preference[]): string {
	return preferences.map((p) => `${p.group}:${p.value}`).join(",")
}

export function preferencesFromParam(value: string | null): Preference[] {
	const out: Preference[] = []
	for (const part of list(value).slice(0, 12)) {
		const at = part.indexOf(":")
		const group = part.slice(0, at)
		const v = part.slice(at + 1)
		if (at > 0 && isGroup(group) && /^[\w &'-]{1,40}$/.test(v)) out.push({ group, value: v })
	}
	return out
}
