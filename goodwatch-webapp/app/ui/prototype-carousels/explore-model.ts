// PROTOTYPE for "Prototype native-scroll carousels on title pages", second round. Throwaway code: not for production.
//
// What the five explore variants show, computed on the server from the related titles of the overall panel and
// their fingerprints. No React and no server imports: a pure function from scores to a small model.
//
// The first round's reasons repeated, because nearest neighbors share their top attributes. Every reason here is
// measured against the neighbor set:
// - "shared" reasons: an attribute that this title and the center both score 6 or more, weighted by how far the
//   title is above the neighbors' mean on it. An attribute every neighbor has scores near zero and loses.
// - "difference" reasons: an attribute where the title is 2 or more points above or below the center, weighted by
//   how unusual that is among the neighbors ("funnier", "less violent").
// - a reason that was used for an earlier title of the same view costs points, so the titles shown together differ.
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type { RelatedCard } from "~/utils/related-panel"

export type PxType = "movie" | "show"
export type Scores = (key: string) => number | undefined

export const EXPLORE_VARIANTS = [
	"explore1",
	"explore2",
	"explore3",
	"explore4",
	"explore5",
] as const
export type ExploreVariant = (typeof EXPLORE_VARIANTS)[number]
export const isExploreVariant = (value: unknown): value is ExploreVariant =>
	EXPLORE_VARIANTS.includes(value as ExploreVariant)

export interface PxTitle {
	type: PxType
	id: number
	title: string
	year: string
	poster: string
	score: number
}
/** A title in a view: `why` is the full reason, `tag` the short one under a poster. */
export interface PxPick extends PxTitle {
	why: string
	tag: string
}

export interface ExploreModel {
	variant: ExploreVariant
	/** How many related titles the model was built from. */
	total: number
	/** explore1: spokes named by a trait shared with the center. */
	spokes?: { key: string; label: string; color: string; titles: PxPick[] }[]
	/** explore2: clusters named by how their titles differ from the center. */
	clusters?: {
		heading: string
		shared: string
		color: string
		titles: PxPick[]
	}[]
	/** explore3: one title per direction away from the center. */
	steps?: (PxPick & { toward: string })[]
	/** explore4: the center's traits, each with the titles that carry it. */
	chips?: { key: string; label: string; titles: PxPick[] }[]
	/** explore5: two axes and where each title sits on them, in percent of the map. */
	map?: {
		x: { low: string; high: string }
		y: { low: string; high: string }
		at: { x: number; y: number }
		points: (PxPick & { x: number; y: number })[]
	}
	/** Related titles the view doesn't show: text links in one line. */
	more: Pick<PxTitle, "type" | "id" | "title" | "year">[]
}

export interface Neighbor {
	title: PxTitle
	s: Scores
	/** Position in the related list of its own type; the other type starts later. */
	rank: number
}

// How a difference reads: [more, less, group]. Attributes of one group say nearly the same thing, so a title gets at
// most one reason per group. Craft attributes (direction, acting, ...) are left out: "better acted" is a judgment.
export const DIFF: Record<string, [string, string, string?]> = {
	adrenaline: ["more adrenaline", "less adrenaline", "pace"],
	fast_pace: ["faster", "slower", "pace"],
	tension: ["tenser", "more relaxed"],
	scare: ["scarier", "less scary"],
	violence: ["more violent", "less violent"],
	romance: ["more romantic", "less romance"],
	eroticism: ["steamier", "less steamy"],
	wholesome: ["more wholesome", "less wholesome", "tone"],
	hopefulness: ["more hopeful", "less hopeful", "tone"],
	bleakness: ["bleaker", "less bleak", "tone"],
	wonder: ["more wonder", "less wonder"],
	pathos: ["more moving", "less emotional"],
	melancholy: ["more melancholy", "less melancholy"],
	uncanny: ["eerier", "less eerie"],
	nostalgia: ["more nostalgic", "less nostalgic"],
	situational_comedy: ["funnier", "less funny", "humor"],
	wit_wordplay: ["wittier", "less witty", "humor"],
	physical_comedy: ["more slapstick", "less slapstick", "humor"],
	absurdist_humor: ["more absurd", "less absurd", "humor"],
	satire_parody: ["more satirical", "less satirical", "humor"],
	dark_humor: ["more dark humor", "less dark humor", "humor"],
	cringe_humor: ["more cringe humor", "less cringe humor", "humor"],
	fantasy: ["more fantasy", "less fantasy"],
	futuristic: ["more futuristic", "less futuristic"],
	historical: ["more historical", "less historical"],
	contemporary_realism: ["more present-day", "less present-day"],
	crime: ["more crime", "less crime"],
	mystery: ["more mystery", "less mystery"],
	warfare: ["more warfare", "less warfare"],
	political: ["more political", "less political"],
	sports: ["more sports", "less sports"],
	biographical: ["more biographical", "less biographical"],
	coming_of_age: ["more coming-of-age", "less coming-of-age"],
	family_dynamics: ["more family drama", "less family drama"],
	psychological: ["more psychological", "less psychological"],
	showbiz: ["more showbiz", "less showbiz"],
	social_commentary: ["more social commentary", "less social commentary"],
	class_and_capitalism: ["more about class", "less about class"],
	technology_and_humanity: ["more about technology", "less about technology"],
	spiritual: ["more spiritual", "less spiritual"],
	complexity: ["more complex", "simpler"],
	ambiguity: ["more ambiguous", "more clear-cut"],
	surrealism: ["more surreal", "less surreal", "strange"],
	psychedelic: ["trippier", "less trippy", "strange"],
	eccentricity: ["quirkier", "more conventional", "strange"],
	philosophical: ["more philosophical", "less philosophical"],
	spectacle: ["bigger spectacle", "smaller scale"],
	character_depth: ["more character-driven", "less character-driven"],
	dialogue_centrality: ["talkier", "less talk"],
	grotesque: ["more grotesque", "less grotesque"],
	camp_and_irony: ["campier", "less camp"],
	visual_stylization: ["more stylized", "less stylized"],
	music_centrality: ["more music-driven", "less music-driven"],
	educational: ["more educational", "less educational"],
	non_linear_narrative: ["more non-linear", "more linear"],
	meta_narrative: ["more meta", "less meta"],
}

// How a shared attribute reads after "Same".
export const SHARED: Record<string, string> = {
	adrenaline: "adrenaline",
	tension: "tension",
	scare: "scares",
	violence: "violence",
	romance: "romance",
	eroticism: "sensuality",
	wholesome: "warmth",
	wonder: "sense of wonder",
	pathos: "emotional weight",
	melancholy: "melancholy",
	uncanny: "eeriness",
	catharsis: "catharsis",
	nostalgia: "nostalgia",
	situational_comedy: "situational comedy",
	wit_wordplay: "wit",
	physical_comedy: "slapstick",
	cringe_humor: "cringe humor",
	absurdist_humor: "absurd humor",
	satire_parody: "satire",
	dark_humor: "dark humor",
	fantasy: "fantasy world",
	futuristic: "future setting",
	historical: "period setting",
	contemporary_realism: "present-day realism",
	crime: "crime story",
	mystery: "mystery",
	warfare: "warfare",
	political: "politics",
	sports: "sports",
	biographical: "true-life story",
	coming_of_age: "coming-of-age story",
	family_dynamics: "family drama",
	psychological: "psychological depth",
	showbiz: "showbiz setting",
	gaming: "gaming",
	pop_culture: "pop culture",
	social_commentary: "social commentary",
	class_and_capitalism: "class conflict",
	technology_and_humanity: "technology theme",
	spiritual: "spirituality",
	philosophical: "big ideas",
	surrealism: "surrealism",
	slow_burn: "slow burn",
	fast_pace: "fast pace",
	spectacle: "spectacle",
	complexity: "complex plot",
	bleakness: "bleakness",
	hopefulness: "hopefulness",
	eccentricity: "quirkiness",
	world_immersion: "immersive world",
	visual_stylization: "stylized look",
	non_linear_narrative: "non-linear story",
	character_depth: "deep characters",
	educational: "educational value",
	music_centrality: "music",
}

const SHARED_FROM = 6
/** A difference counts when the higher of the two scores is at least this. */
const DIFF_FROM = 6
/** What a reason loses per earlier use in the same view. */
const REPEAT_COST = 2.5
const RANK_COST = 0.04

export interface Reason {
	key: string
	group: string
	/** "+", "-" for a difference, "=" for a shared attribute. */
	dir: "+" | "-" | "="
	phrase: string
	strength: number
}

export const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function meanOf(neighbors: Neighbor[]): Map<string, number> {
	const mean = new Map<string, number>()
	for (const key of new Set([...Object.keys(DIFF), ...Object.keys(SHARED)])) {
		let sum = 0
		let count = 0
		for (const neighbor of neighbors) {
			const value = neighbor.s(key)
			if (value === undefined) continue
			sum += value
			count++
		}
		mean.set(key, count ? sum / count : 0)
	}
	return mean
}

function differences(
	center: Scores,
	neighbor: Neighbor,
	mean: Map<string, number>,
): Reason[] {
	const found: Reason[] = []
	for (const [key, [more, less, group]] of Object.entries(DIFF)) {
		const a = center(key)
		const b = neighbor.s(key)
		if (a === undefined || b === undefined) continue
		const d = b - a
		if (Math.abs(d) < 2) continue
		// "More" of something the title barely has, or "less" of something the center barely has, says nothing.
		const level = d > 0 ? b : a
		if (level < DIFF_FROM) continue
		const unusual = (b - (mean.get(key) ?? b)) * Math.sign(d)
		found.push({
			key,
			group: group ?? key,
			dir: d > 0 ? "+" : "-",
			phrase: `${Math.abs(d) >= 6 ? "much " : ""}${d > 0 ? more : less}`,
			strength:
				(Math.abs(d) + 0.6 * unusual + 0.4 * (level - DIFF_FROM)) *
				(d > 0 ? 1 : 0.8),
		})
	}
	return found
}

function shared(
	center: Scores,
	neighbor: Neighbor,
	mean: Map<string, number>,
	highlights: Set<string>,
): Reason[] {
	const found: Reason[] = []
	for (const [key, noun] of Object.entries(SHARED)) {
		const a = center(key)
		const b = neighbor.s(key)
		if (a === undefined || b === undefined) continue
		if (a < SHARED_FROM || b < SHARED_FROM) continue
		found.push({
			key,
			group: DIFF[key]?.[2] ?? key,
			dir: "=",
			phrase: noun,
			strength:
				Math.min(a, b) -
				6 +
				(b - (mean.get(key) ?? b)) +
				(highlights.has(key) ? 0.5 : 0),
		})
	}
	return found
}

/** Counts how often a reason was used in a view, so the next title gets another one. */
export class Usage {
	private used = new Map<string, number>()
	private id = (reason: Reason) => `${reason.key}${reason.dir}`
	cost(reason: Reason) {
		return (this.used.get(this.id(reason)) ?? 0) * REPEAT_COST
	}
	take(reason: Reason) {
		this.used.set(this.id(reason), (this.used.get(this.id(reason)) ?? 0) + 1)
	}
	best(reasons: Reason[], skipGroups: Set<string>, floor = 0): Reason | null {
		let best: Reason | null = null
		let bestValue = floor
		for (const reason of reasons) {
			if (skipGroups.has(reason.group)) continue
			const value = reason.strength - this.cost(reason)
			if (value > bestValue) {
				best = reason
				bestValue = value
			}
		}
		if (best) this.take(best)
		return best
	}
}

export interface Context {
	center: Scores
	highlights: Set<string>
	mean: Map<string, number>
}

/**
 * The reason of one title: what it shares that the others mostly lack, and how it differs. A view that already
 * says one half for a whole group passes it as the lead: a shared trait ("same"), a difference ("diff"), or a
 * finished phrase ("level").
 */
function reasonOf(
	context: Context,
	neighbor: Neighbor,
	usage: Usage,
	skipGroups: string[] = [],
	lead?: { kind: "same" | "diff" | "level"; text: string },
): { why: string; tag: string } {
	const skip = new Set(skipGroups)
	const diff = usage.best(
		differences(context.center, neighbor, context.mean),
		skip,
		-3,
	)
	if (diff) skip.add(diff.group)
	const same = usage.best(
		shared(context.center, neighbor, context.mean, context.highlights),
		skip,
		-6,
	)
	// The tag under a poster is short: "more crime", not "much more crime".
	const tag =
		diff?.phrase.replace(/^much /, "") ??
		(same ? `same ${same.phrase}` : "very close")
	if (lead?.kind === "same") {
		const both = same ? `${lead.text} and ${same.phrase}` : lead.text
		return {
			why: diff ? `Same ${both}, but ${diff.phrase}` : `Same ${both}`,
			tag,
		}
	}
	if (lead?.kind === "diff") {
		const both = diff ? `${lead.text} and ${diff.phrase}` : lead.text
		return { why: same ? `${both}, same ${same.phrase}` : both, tag }
	}
	if (lead)
		return {
			why: diff
				? `${lead.text}, but ${diff.phrase}`
				: same
					? `${lead.text}, same ${same.phrase}`
					: lead.text,
			tag,
		}
	const why = same
		? diff
			? `Same ${same.phrase}, but ${diff.phrase}`
			: `Same ${same.phrase}, and close in most other ways`
		: diff
			? `Close overall, but ${diff.phrase}`
			: "Close in nearly every way"
	return { why, tag }
}

export interface Option {
	id: string
	group: string
	value: (neighbor: Neighbor) => number | null
}

/**
 * Splits neighbors into groups: again and again, the option whose best unassigned members are strongest takes
 * them. An option that nearly every neighbor fits equally has low values and loses to one that sets a few apart.
 */
export function split(
	neighbors: Neighbor[],
	options: Option[],
	groups: number,
	per: number,
	atLeast: number,
	/** What a place further down the related list costs: higher keeps the groups to the closest titles. */
	rankCost: number,
): { option: Option; members: Neighbor[] }[] {
	const free = new Set(neighbors)
	const usedGroups = new Set<string>()
	const result: { option: Option; members: Neighbor[] }[] = []
	while (result.length < groups) {
		let best: { option: Option; members: Neighbor[]; total: number } | null =
			null
		for (const option of options) {
			if (usedGroups.has(option.group)) continue
			const members: { neighbor: Neighbor; value: number }[] = []
			for (const neighbor of free) {
				const value = option.value(neighbor)
				if (value !== null)
					members.push({ neighbor, value: value - rankCost * neighbor.rank })
			}
			if (members.length < atLeast) continue
			members.sort((x, y) => y.value - x.value)
			const top = members.slice(0, per)
			const total = top.reduce((sum, member) => sum + member.value, 0)
			if (!best || total > best.total)
				best = { option, members: top.map((member) => member.neighbor), total }
		}
		if (!best) break
		usedGroups.add(best.option.group)
		for (const member of best.members) free.delete(member)
		result.push({ option: best.option, members: best.members })
	}
	return result
}

const pick = (
	neighbor: Neighbor,
	reason: { why: string; tag: string },
): PxPick => ({ ...neighbor.title, ...reason })

const solid = (key: string) =>
	getFingerprintMeta(key).color.replace(/[\d.]+\)$/, "1)")

// explore1: spokes. A spoke is a trait the center has (6 or more) that best sets a few neighbors apart from the
// rest: its members are the neighbors furthest above the neighbors' mean on it. The tag under a poster is the
// title's own difference from the center.
function spokes(context: Context, neighbors: Neighbor[]) {
	const options = (from: number): Option[] =>
		Object.keys(SHARED)
			.filter((key) => (context.center(key) ?? 0) >= from)
			.map((key) => ({
				id: key,
				group: DIFF[key]?.[2] ?? key,
				value: (neighbor) => {
					const b = neighbor.s(key)
					if (b === undefined || b < SHARED_FROM) return null
					// A trait the center is known for (a highlight, a high score) makes the better spoke.
					const own =
						0.5 * ((context.center(key) ?? 0) - SHARED_FROM) +
						(context.highlights.has(key) ? 1 : 0)
					return b - (context.mean.get(key) ?? b) + 0.25 * (b - 6) + own
				},
			}))
	let groups = split(neighbors, options(SHARED_FROM), 4, 3, 2, 0.12)
	if (groups.length < 4) groups = split(neighbors, options(4), 4, 3, 2, 0.12)
	const usage = new Usage()
	return groups.map(({ option, members }) => {
		const meta = getFingerprintMeta(option.id)
		return {
			key: option.id,
			label: `${meta.emoji} ${meta.label}`,
			color: solid(option.id),
			titles: members.map((member) =>
				pick(
					member,
					reasonOf(context, member, usage, [option.group], {
						kind: "same",
						text: SHARED[option.id],
					}),
				),
			),
		}
	})
}

// explore2: clusters. A cluster is a direction away from the center ("funnier", "less violent"): its members are
// the neighbors with the strongest such difference. The second half of the heading is the trait the members share
// with the center that the other neighbors have least.
function clusters(context: Context, neighbors: Neighbor[]) {
	const all = new Map(
		neighbors.map((neighbor) => [
			neighbor,
			differences(context.center, neighbor, context.mean),
		]),
	)
	const options: Option[] = Object.entries(DIFF).flatMap(([key, [, , group]]) =>
		(["+", "-"] as const).map((dir) => ({
			id: `${key}${dir}`,
			group: `${group ?? key}${dir}`,
			value: (neighbor: Neighbor) =>
				all.get(neighbor)?.find((r) => r.key === key && r.dir === dir)
					?.strength ?? null,
		})),
	)
	const groups = split(neighbors, options, 4, 4, 3, 0.1)
	const sharedUsage = new Usage()
	const usage = new Usage()
	return groups.map(({ option, members }) => {
		const key = option.id.slice(0, -1)
		const dir = option.id.slice(-1)
		const [more, less] = DIFF[key]
		// The shared trait of the whole cluster: every member has it, and the sum of their reasons for it is highest.
		const totals = new Map<string, Reason>()
		for (const member of members)
			for (const reason of shared(
				context.center,
				member,
				context.mean,
				context.highlights,
			)) {
				if (reason.group === (DIFF[key]?.[2] ?? key)) continue
				const sum = totals.get(reason.key)
				totals.set(reason.key, {
					...reason,
					strength: (sum?.strength ?? 0) + reason.strength + 3,
				})
			}
		const everyMember = [...totals.values()].filter((reason) =>
			members.every((member) => (member.s(reason.key) ?? 0) >= SHARED_FROM),
		)
		const same = sharedUsage.best(everyMember, new Set(), -1000)
		return {
			heading: cap(dir === "+" ? more : less),
			shared: same ? `same ${same.phrase}` : "close in most other ways",
			color: solid(key),
			titles: members.map((member) =>
				pick(
					member,
					reasonOf(context, member, usage, [option.group.slice(0, -1)], {
						kind: "diff",
						text: cap(
							all.get(member)?.find((r) => r.key === key && r.dir === dir)
								?.phrase ?? more,
						),
					}),
				),
			),
		}
	})
}

// explore3: steps. Six directions away from the center, one neighbor each: the neighbor with the strongest
// difference of that kind. A step makes that neighbor the center, and the directions are computed again from there.
function steps(context: Context, neighbors: Neighbor[]) {
	const all = new Map(
		neighbors.map((neighbor) => [
			neighbor,
			differences(context.center, neighbor, context.mean),
		]),
	)
	const options: Option[] = Object.entries(DIFF).flatMap(([key, [, , group]]) =>
		(["+", "-"] as const).map((dir) => ({
			id: `${key}${dir}`,
			// One step per group in either direction: not "faster" next to "more adrenaline".
			group: `${group ?? key}${dir}`,
			value: (neighbor: Neighbor) =>
				all.get(neighbor)?.find((r) => r.key === key && r.dir === dir)
					?.strength ?? null,
		})),
	)
	const usage = new Usage()
	const taken = split(neighbors, options, 6, 1, 1, 0.15).map(
		({ option, members }) => {
			const key = option.id.slice(0, -1)
			const dir = option.id.slice(-1)
			const member = members[0]
			const toward =
				all.get(member)?.find((r) => r.key === key && r.dir === dir)?.phrase ??
				""
			const same = usage.best(
				shared(context.center, member, context.mean, context.highlights),
				new Set([DIFF[key]?.[2] ?? key]),
				-6,
			)
			return {
				...member.title,
				toward: cap(toward.replace(/^much /, "")),
				tag: toward,
				why: same ? `${cap(toward)}, same ${same.phrase}` : cap(toward),
			}
		},
	)
	// A center with very uniform neighbors has fewer than six directions: the closest titles fill the rest.
	const shown = new Set(taken.map((step) => `${step.type}-${step.id}`))
	for (const neighbor of neighbors) {
		if (taken.length >= 6) break
		if (shown.has(`${neighbor.title.type}-${neighbor.title.id}`)) continue
		const reason = reasonOf(context, neighbor, usage)
		taken.push({ ...neighbor.title, toward: "Very close", ...reason })
	}
	return taken
}

// explore4: chips. A chip is one of the center's traits (its highlight attributes, then its highest scores). Under
// a chip are the six neighbors that score highest on it, each with how much of the trait it has compared with the
// center and its own difference. The first chip is the closest titles overall.
function chips(context: Context, neighbors: Neighbor[]) {
	const keys = [...context.highlights].filter((key) => SHARED[key])
	const byScore = Object.keys(SHARED)
		.filter((key) => !keys.includes(key))
		.sort((x, y) => (context.center(y) ?? 0) - (context.center(x) ?? 0))
	for (const key of byScore) {
		if (keys.length >= 4 || (context.center(key) ?? 0) < 7) break
		keys.push(key)
	}
	const result: NonNullable<ExploreModel["chips"]> = []
	const closest = new Usage()
	result.push({
		key: "closest",
		label: "🧬 Closest",
		titles: neighbors
			.slice(0, 6)
			.map((neighbor) => pick(neighbor, reasonOf(context, neighbor, closest))),
	})
	for (const key of keys.slice(0, 6)) {
		if (result.length >= 5) break
		const a = context.center(key) ?? 0
		const members = neighbors
			.filter(
				(neighbor) => (neighbor.s(key) ?? 0) >= Math.max(SHARED_FROM, a - 2),
			)
			.sort(
				(x, y) =>
					(y.s(key) ?? 0) -
					RANK_COST * y.rank -
					((x.s(key) ?? 0) - RANK_COST * x.rank),
			)
			.slice(0, 6)
		if (members.length < 3) continue
		const usage = new Usage()
		const meta = getFingerprintMeta(key)
		result.push({
			key,
			label: `${meta.emoji} ${meta.label}`,
			titles: members.map((member) => {
				const d = (member.s(key) ?? 0) - a
				const level =
					d > 0 ? "Even more" : d === 0 ? "Just as much" : "Nearly as much"
				return pick(
					member,
					reasonOf(context, member, usage, [DIFF[key]?.[2] ?? key], {
						kind: "level",
						text: `${level} ${SHARED[key]}`,
					}),
				)
			}),
		})
	}
	return result
}

// explore5: a map. An axis is the mean of some attributes minus the mean of their opposites. The two axes are the
// ones on which the neighbors spread most relative to the center, the second one chosen to say something else than
// the first. A title's place is its difference from the center on both.
export const AXES: {
	id: string
	low: string
	high: string
	words: [string, string]
	plus: string[]
	minus: string[]
}[] = [
	{
		id: "tone",
		low: "Lighter",
		high: "Darker",
		words: ["darker", "lighter"],
		plus: ["bleakness", "violence", "scare", "melancholy"],
		minus: ["hopefulness", "wholesome"],
	},
	{
		id: "pace",
		low: "Calmer",
		high: "Faster",
		words: ["faster", "calmer"],
		plus: ["fast_pace", "adrenaline"],
		minus: ["slow_burn"],
	},
	{
		id: "humor",
		low: "More serious",
		high: "Funnier",
		words: ["funnier", "more serious"],
		plus: [
			"situational_comedy",
			"wit_wordplay",
			"absurdist_humor",
			"physical_comedy",
		],
		minus: [],
	},
	{
		id: "strange",
		low: "More ordinary",
		high: "Stranger",
		words: ["stranger", "more ordinary"],
		plus: ["surrealism", "uncanny", "eccentricity"],
		minus: [],
	},
	{
		id: "ideas",
		low: "More straightforward",
		high: "Headier",
		words: ["headier", "more straightforward"],
		plus: ["philosophical", "complexity", "ambiguity"],
		minus: [],
	},
	{
		id: "heart",
		low: "Cooler",
		high: "More heartfelt",
		words: ["more heartfelt", "cooler"],
		plus: ["romance", "pathos", "wholesome"],
		minus: [],
	},
	{
		id: "scale",
		low: "More intimate",
		high: "Bigger",
		words: ["bigger", "more intimate"],
		plus: ["spectacle", "world_immersion"],
		minus: ["dialogue_centrality"],
	},
]

// The map's box in the units the layout is solved in: a phone's stage in CSS pixels.
const MAP = { w: 346, h: 372, poster: 46, center: 60, pad: 5 }
const MAP_POINTS = 10

function map(context: Context, neighbors: Neighbor[]) {
	const avg = (s: Scores, keys: string[]) =>
		keys.length
			? keys.reduce((sum, key) => sum + (s(key) ?? 0), 0) / keys.length
			: 0
	const pool = neighbors.slice(0, 32)
	const axes = AXES.map((axis) => {
		const at = (s: Scores) => avg(s, axis.plus) - avg(s, axis.minus)
		const d = pool.map((neighbor) => at(neighbor.s) - at(context.center))
		const m = d.reduce((sum, value) => sum + value, 0) / (d.length || 1)
		const spread = Math.sqrt(
			d.reduce((sum, value) => sum + (value - m) ** 2, 0) / (d.length || 1),
		)
		// An axis with neighbors on both sides of the center says more than one where all of them are "darker".
		const above = d.filter((value) => value > 0.5).length
		const below = d.filter((value) => value < -0.5).length
		const balance =
			0.4 +
			0.6 * Math.min(1, (2 * Math.min(above, below)) / (d.length || 1) / 0.5)
		return { axis, d, m, spread, weight: spread * balance }
	})
	const correlation = (a: (typeof axes)[number], b: (typeof axes)[number]) => {
		if (!a.spread || !b.spread) return 0
		let sum = 0
		for (let i = 0; i < a.d.length; i++) sum += (a.d[i] - a.m) * (b.d[i] - b.m)
		return sum / a.d.length / (a.spread * b.spread)
	}
	const first = [...axes].sort((a, b) => b.weight - a.weight)[0]
	const second = axes
		.filter((axis) => axis !== first)
		.sort(
			(a, b) =>
				b.weight * (1 - Math.abs(correlation(b, first))) -
				a.weight * (1 - Math.abs(correlation(a, first))),
		)[0]
	// Tone and pace read best left to right; whatever is chosen, the wider spread goes on the wider side.
	const [ax, ay] = [first, second]

	// Which titles: the closest one, then again and again the one furthest from those already on the map.
	const place = (i: number) => ({
		x: ax.d[i] / (ax.spread || 1),
		y: ay.d[i] / (ay.spread || 1),
	})
	const chosen: number[] = pool.length ? [0] : []
	while (chosen.length < Math.min(MAP_POINTS, pool.length)) {
		let best = -1
		let bestValue = Number.NEGATIVE_INFINITY
		for (let i = 0; i < pool.length; i++) {
			if (chosen.includes(i)) continue
			const p = place(i)
			const nearest = Math.min(
				Math.hypot(p.x, p.y),
				...chosen.map((j) => {
					const q = place(j)
					return Math.hypot(p.x - q.x, p.y - q.y)
				}),
			)
			const value = nearest - RANK_COST * pool[i].rank
			if (value > bestValue) {
				best = i
				bestValue = value
			}
		}
		chosen.push(best)
	}

	// Where: the differences scaled into the box, the center where zero falls, then posters pushed off each other.
	const range = (d: number[]) => {
		const low = Math.min(0, ...chosen.map((i) => d[i]))
		const high = Math.max(0, ...chosen.map((i) => d[i]))
		const span = Math.max(high - low, 1)
		return (value: number) => (value - low) / span
	}
	const sx = range(ax.d)
	const sy = range(ay.d)
	const half = (size: number) => ({ w: size / 2, h: (size * 1.5) / 2 })
	const box = (size: number, fx: number, fy: number) => {
		const { w, h } = half(size)
		return {
			x: w + MAP.pad + fx * (MAP.w - 2 * (w + MAP.pad)),
			// The high end of the vertical axis is at the top.
			y: h + MAP.pad + (1 - fy) * (MAP.h - 2 * (h + MAP.pad)),
			w,
			h,
		}
	}
	const middle = box(MAP.center, sx(0), sy(0))
	const boxes = chosen.map((i) => box(MAP.poster, sx(ax.d[i]), sy(ay.d[i])))
	const gap = 3
	for (let round = 0; round < 200; round++) {
		let moved = false
		for (let i = 0; i < boxes.length; i++) {
			const a = boxes[i]
			for (const b of [middle, ...boxes.slice(0, i), ...boxes.slice(i + 1)]) {
				const overlapX = a.w + b.w + gap - Math.abs(a.x - b.x)
				const overlapY = a.h + b.h + gap - Math.abs(a.y - b.y)
				if (overlapX <= 0 || overlapY <= 0) continue
				moved = true
				// Apart along the side where less has to move. The center stays; two neighbors share the move.
				const share = b === middle ? 1 : 0.5
				if (overlapX < overlapY) {
					const dir = a.x === b.x ? (i % 2 ? 1 : -1) : Math.sign(a.x - b.x)
					a.x += dir * overlapX * share
					if (b !== middle) b.x -= dir * overlapX * share
				} else {
					const dir = a.y === b.y ? (i % 2 ? 1 : -1) : Math.sign(a.y - b.y)
					a.y += dir * overlapY * share
					if (b !== middle) b.y -= dir * overlapY * share
				}
			}
		}
		for (const b of boxes) {
			b.x = Math.min(MAP.w - b.w - MAP.pad, Math.max(b.w + MAP.pad, b.x))
			b.y = Math.min(MAP.h - b.h - MAP.pad, Math.max(b.h + MAP.pad, b.y))
		}
		if (!moved) break
	}

	const word = (d: number, spread: number, [high, low]: [string, string]) => {
		if (Math.abs(d) < Math.max(0.75, spread * 0.4)) return null
		return `${Math.abs(d) >= Math.max(3, spread * 1.8) ? "much " : ""}${d > 0 ? high : low}`
	}
	const usage = new Usage()
	const axisKeys = new Set(
		[ax, ay].flatMap((entry) => [...entry.axis.plus, ...entry.axis.minus]),
	)
	const skipGroups = [
		...new Set([...axisKeys].map((key) => DIFF[key]?.[2] ?? key)),
	]
	const pct = (value: number, of: number) =>
		Math.round((value / of) * 1000) / 10
	return {
		x: { low: ax.axis.low, high: ax.axis.high },
		y: { low: ay.axis.low, high: ay.axis.high },
		at: { x: pct(middle.x, MAP.w), y: pct(middle.y, MAP.h) },
		points: chosen.map((index, n) => {
			const neighbor = pool[index]
			const words = [
				word(ax.d[index], ax.spread, ax.axis.words),
				word(ay.d[index], ay.spread, ay.axis.words),
			].filter(Boolean)
			const own = reasonOf(context, neighbor, usage, skipGroups)
			const where = words.length ? cap(words.join(" and ")) : "Right beside it"
			return {
				...neighbor.title,
				x: pct(boxes[n].x, MAP.w),
				y: pct(boxes[n].y, MAP.h),
				tag: words.length ? words.join(", ") : own.tag,
				why: `${where}${own.tag === "very close" ? "" : `, ${own.tag}`}`,
			}
		}),
	}
}

export const toTitle = (type: PxType, card: RelatedCard): PxTitle => ({
	type,
	id: card.tmdb_id,
	title: card.title,
	year: String(card.release_year ?? ""),
	poster: card.poster_path,
	score: Math.round(card.goodwatch_overall_score_normalized_percent),
})

/** The other type's titles count as further away: a movie page shows mostly movies. */
export const OTHER_TYPE_RANK = 6

export function buildExploreModel(input: {
	variant: ExploreVariant
	type: PxType
	scores: Scores
	highlightKeys: string[]
	movies: RelatedCard[]
	shows: RelatedCard[]
	fingerprint: (type: PxType, id: number) => Scores | undefined
}): ExploreModel {
	const lists: [PxType, RelatedCard[]][] =
		input.type === "movie"
			? [
					["movie", input.movies],
					["show", input.shows],
				]
			: [
					["show", input.shows],
					["movie", input.movies],
				]
	const neighbors: Neighbor[] = []
	const unread: PxTitle[] = []
	lists.forEach(([type, cards], list) =>
		cards.forEach((card, index) => {
			const s = input.fingerprint(type, card.tmdb_id)
			if (!s || !card.poster_path) unread.push(toTitle(type, card))
			else
				neighbors.push({
					title: toTitle(type, card),
					s,
					rank: index + list * OTHER_TYPE_RANK,
				})
		}),
	)
	neighbors.sort((a, b) => a.rank - b.rank)
	const context: Context = {
		center: input.scores,
		highlights: new Set(input.highlightKeys),
		mean: meanOf(neighbors),
	}
	const model: ExploreModel = {
		variant: input.variant,
		total: neighbors.length + unread.length,
		more: [],
	}
	let shown: PxTitle[] = []
	if (input.variant === "explore1") {
		model.spokes = spokes(context, neighbors)
		shown = model.spokes.flatMap((spoke) => spoke.titles)
	} else if (input.variant === "explore2") {
		model.clusters = clusters(context, neighbors)
		shown = model.clusters.flatMap((cluster) => cluster.titles)
	} else if (input.variant === "explore3") {
		model.steps = steps(context, neighbors)
		shown = model.steps
	} else if (input.variant === "explore4") {
		model.chips = chips(context, neighbors)
		shown = model.chips.flatMap((chip) => chip.titles)
	} else {
		model.map = map(context, neighbors)
		shown = model.map.points
	}
	const seen = new Set(shown.map((title) => `${title.type}-${title.id}`))
	model.more = [...neighbors.map((neighbor) => neighbor.title), ...unread]
		.filter((title) => !seen.has(`${title.type}-${title.id}`))
		.map(({ type, id, title, year }) => ({ type, id, title, year }))
	return model
}
