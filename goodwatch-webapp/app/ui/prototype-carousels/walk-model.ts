// PROTOTYPE for "Prototype native-scroll carousels on title pages", third round. Throwaway code: not for production.
//
// What the five walk variants show around the title you stand on, computed on the server from the related titles of
// the overall panel and their fingerprints. It reuses the tables and the grouping of explore-model.ts, and changes
// how a reason is found and worded, after what read wrong in the second round:
// - "less X" only where a viewer would say it ("slower", "less violent"). A side trait (music, dialogue, a niche
//   subject) is a reason only as "more X", and only when the title is strong on it. No "much".
// - a setting isn't claimed against the title's stronger setting ("more historical" for a film set in the future).
// - a direction ("darker", "funnier") is a group of attributes, and it counts only when most of them agree and
//   none says the opposite.
// - niche traits don't name a group. Titles without a score or from a coming year are left out.
// - nothing depends on what the page happens to know: the same title gives the same picture on every request.
import {
	AXES,
	DIFF,
	type Neighbor,
	OTHER_TYPE_RANK,
	type Option,
	type PxPick,
	type PxTitle,
	type PxType,
	SHARED,
	type Scores,
	Usage,
	cap,
	meanOf,
	split,
	toTitle,
} from "~/ui/prototype-carousels/explore-model"
import type { RelatedCard } from "~/utils/related-panel"

export const WALK_VARIANTS = [
	"walk1",
	"walk2",
	"walk3",
	"walk4",
	"walk5",
] as const
export type WalkVariant = (typeof WALK_VARIANTS)[number]
export const isWalkVariant = (value: unknown): value is WalkVariant =>
	WALK_VARIANTS.includes(value as WalkVariant)

export interface WalkModel {
	variant: WalkVariant
	center: PxTitle
	/** walk1 and walk4: the closest titles, closest first. */
	ring?: PxPick[]
	/** walk2: four ways to differ. `slot` is 0 for up, then clockwise. */
	compass?: { slot: number; label: string; titles: PxPick[] }[]
	/** walk3: the next steps, one title each. */
	steps?: (PxPick & { toward: string })[]
	/** walk5: groups named by what their titles share with the center. */
	piles?: { label: string; titles: PxPick[] }[]
	/** Every related title, closest first: the text links of the section. */
	links: Pick<PxTitle, "type" | "id" | "title" | "year">[]
}

// Craft and niche subjects: never "less", "more" only for a title that is strong on it, and no group is named by one.
const SIDE = new Set([
	"music_centrality",
	"educational",
	"showbiz",
	"sports",
	"gaming",
	"pop_culture",
	"meta_narrative",
	"non_linear_narrative",
	"camp_and_irony",
	"grotesque",
	"visual_stylization",
	"dialogue_centrality",
	"biographical",
	"nostalgia",
	"spiritual",
])

// The only "less" a viewer would say.
const LESS: Record<string, string> = {
	fast_pace: "slower",
	adrenaline: "calmer",
	tension: "less tense",
	scare: "less scary",
	violence: "less violent",
	bleakness: "less bleak",
	complexity: "simpler",
	ambiguity: "more clear-cut",
	eccentricity: "more conventional",
	spectacle: "smaller in scale",
}

const SETTINGS = ["futuristic", "historical", "contemporary_realism", "fantasy"]

// Never a reason: "same nostalgia" and "same pop culture" say nothing a viewer would look for.
const NEVER = new Set(["nostalgia", "pop_culture", "gaming", "educational"])

// What a shared trait is called here, where the second round's word read wrong after "Same".
const SHARED_WORDS: Record<string, string> = {
	music_centrality: "music at its heart",
	contemporary_realism: "real-world setting",
	showbiz: "showbiz world",
}
const sharedWord = (key: string) => SHARED_WORDS[key] ?? SHARED[key]

interface Reason {
	key: string
	group: string
	dir: "+" | "-" | "="
	phrase: string
	strength: number
}

interface Context {
	center: Scores
	mean: Map<string, number>
}

function differences(context: Context, neighbor: Neighbor): Reason[] {
	const found: Reason[] = []
	for (const [key, [more, , group]] of Object.entries(DIFF)) {
		const a = context.center(key)
		const b = neighbor.s(key)
		if (a === undefined || b === undefined) continue
		const d = b - a
		const side = SIDE.has(key)
		if (NEVER.has(key)) continue
		if (d > 0) {
			if (d < (side ? 3 : 2) || b < (side ? 8 : 6)) continue
			// A film set in the future isn't "more historical" for one scene in the past.
			if (
				SETTINGS.includes(key) &&
				SETTINGS.some((other) => other !== key && (neighbor.s(other) ?? 0) > b)
			)
				continue
		} else {
			if (!LESS[key] || d > -3 || a < 7) continue
		}
		const unusual = (b - (context.mean.get(key) ?? b)) * Math.sign(d)
		const level = d > 0 ? b : a
		found.push({
			key,
			group: group ?? key,
			dir: d > 0 ? "+" : "-",
			phrase: d > 0 ? more : LESS[key],
			strength:
				(Math.abs(d) + 0.6 * unusual + 0.4 * (level - 6)) *
				(d > 0 ? 1 : 0.6) *
				(side ? 0.7 : 1),
		})
	}
	return found
}

function shared(context: Context, neighbor: Neighbor): Reason[] {
	const found: Reason[] = []
	for (const key of Object.keys(SHARED)) {
		if (NEVER.has(key)) continue
		const noun = sharedWord(key)
		const a = context.center(key)
		const b = neighbor.s(key)
		if (a === undefined || b === undefined) continue
		if (a < 6 || b < 6) continue
		if (SIDE.has(key) && a < 9) continue
		found.push({
			key,
			group: DIFF[key]?.[2] ?? key,
			dir: "=",
			phrase: noun,
			// What the center is known for, and what this neighbor has more of than the others around it.
			strength: Math.min(a, b) - 6 + (b - (context.mean.get(key) ?? b)),
		})
	}
	return found
}

/** A title's reason: what it shares with the center that the others mostly lack, and how it differs. */
function reasonOf(
	context: Context,
	neighbor: Neighbor,
	usage: Usage,
	skipGroups: string[] = [],
	lead?: { kind: "same" | "diff"; text: string },
): { why: string; tag: string } {
	const skip = new Set(skipGroups)
	const diff = usage.best(differences(context, neighbor), skip, -2)
	if (diff) skip.add(diff.group)
	const same = usage.best(shared(context, neighbor), skip, -6)
	if (lead?.kind === "same")
		return {
			why: `Same ${same ? `${lead.text} and ${same.phrase}` : lead.text}${diff ? `, but ${diff.phrase}` : ""}`,
			tag: diff?.phrase ?? (same ? `same ${same.phrase}` : "very close"),
		}
	if (lead?.kind === "diff")
		return {
			why: `${cap(lead.text)}${diff ? ` and ${diff.phrase}` : ""}${same ? `, same ${same.phrase}` : ""}`,
			tag: lead.text,
		}
	return {
		why: same
			? diff
				? `Same ${same.phrase}, but ${diff.phrase}`
				: `Same ${same.phrase}, and close in most other ways`
			: diff
				? `Close overall, but ${diff.phrase}`
				: "Close in nearly every way",
		tag: diff?.phrase ?? (same ? `same ${same.phrase}` : "very close"),
	}
}

const pick = (
	neighbor: Neighbor,
	reason: { why: string; tag: string },
): PxPick => ({ ...neighbor.title, ...reason })

// walk1 and walk4: the closest titles. Each one's reason differs from the ones before it.
function ring(context: Context, neighbors: Neighbor[], count: number) {
	const usage = new Usage()
	return neighbors
		.slice(0, count)
		.map((neighbor) => pick(neighbor, reasonOf(context, neighbor, usage)))
}

interface Lean {
	id: string
	axis: (typeof AXES)[number]
	sign: 1 | -1
	label: string
	word: string
}
// Shorter names than the map's axes had: a direction's name has to fit next to two small posters.
const LEAN_WORDS: Record<string, string> = {
	"strange-": "more grounded",
	"ideas+": "more cerebral",
	"ideas-": "simpler",
	"heart+": "warmer",
	"scale-": "more intimate",
}
// "Cooler" and "more ordinary" are no way anyone wants to go.
const NO_LEAN = new Set(["heart-", "strange-"])
const LEANS: Lean[] = AXES.flatMap((axis) =>
	([1, -1] as const).map((sign) => {
		const id = `${axis.id}${sign > 0 ? "+" : "-"}`
		const word = LEAN_WORDS[id] ?? axis.words[sign > 0 ? 0 : 1]
		return { id, axis, sign, label: cap(word), word }
	}),
).filter((lean) => !NO_LEAN.has(lean.id))

/** How far a title leans one way from the center, or null when its attributes don't agree on it. */
function leanOf(context: Context, lean: Lean, s: Scores): number | null {
	const { plus, minus } = lean.axis
	const parts = [
		...plus.map((key) => (s(key) ?? 0) - (context.center(key) ?? 0)),
		...minus.map((key) => (context.center(key) ?? 0) - (s(key) ?? 0)),
	].map((part) => part * lean.sign)
	const avg = (keys: string[], of: Scores) =>
		keys.length
			? keys.reduce((sum, key) => sum + (of(key) ?? 0), 0) / keys.length
			: 0
	const at = (of: Scores) => avg(plus, of) - avg(minus, of)
	const delta = (at(s) - at(context.center)) * lean.sign
	if (delta < 1.5) return null
	if (parts.filter((part) => part >= 1).length < Math.ceil(parts.length / 2))
		return null
	if (parts.some((part) => part <= -2)) return null
	// "Funnier" needs a title with humor; "more serious" needs a center that is funny.
	// And the title itself has to be what the word says: a comedy that is less funny than a funnier comedy isn't
	// "more serious", and a grim crime drama isn't "lighter" than a grimmer one.
	if (lean.sign > 0) {
		if (Math.max(...plus.map((key) => s(key) ?? 0)) < 6) return null
		if (avg(plus, s) < 4.5) return null
	} else {
		if (avg(plus, context.center) < 5.5) return null
		if (avg(plus, s) > 5.5) return null
	}
	return delta
}

const leanOptions = (context: Context, weight = 1): Option[] =>
	LEANS.map((lean) => ({
		id: lean.id,
		group: lean.id,
		value: (neighbor: Neighbor) => {
			const value = leanOf(context, lean, neighbor.s)
			return value === null ? null : value * weight
		},
	}))

// A single attribute as a way to go ("more crime"): only a strong one, and never a setting, which is a place and
// not a direction.
const NO_WAY = new Set([...SETTINGS, "technology_and_humanity", "coming_of_age"])
const attributeOptions = (context: Context, weight = 1): Option[] =>
	Object.entries(DIFF)
		.filter(([key]) => !SIDE.has(key) && !NEVER.has(key) && !NO_WAY.has(key))
		.map(([key, [, , group]]) => ({
			id: key,
			group: `${group ?? key}+`,
			value: (neighbor: Neighbor) => {
				const b = neighbor.s(key) ?? 0
				if (b < 8 || b - (context.center(key) ?? 0) < 3) return null
				const reason = differences(context, neighbor).find(
					(r) => r.key === key && r.dir === "+",
				)
				return reason ? reason.strength * weight : null
			},
		}))

const leanGroups = (lean: Lean) => [
	...new Set(
		[...lean.axis.plus, ...lean.axis.minus].map(
			(key) => DIFF[key]?.[2] ?? key,
		),
	),
]

/** What a group of titles is called and which reason groups its name already covers. */
function named(option: Option): { label: string; word: string; skip: string[] } {
	const lean = LEANS.find((entry) => entry.id === option.id)
	if (lean)
		return { label: lean.label, word: lean.word, skip: leanGroups(lean) }
	const [more, , group] = DIFF[option.id]
	return { label: cap(more), word: more, skip: [group ?? option.id] }
}

// walk2: a compass. Four ways to differ from the center, up to three titles each. The two ends of one axis
// ("lighter" and "darker") sit opposite each other. A center whose neighbors lean fewer than four ways gets single
// attributes ("more crime") and then the closest titles for the rest.
function compass(context: Context, neighbors: Neighbor[]) {
	const pool = neighbors.slice(0, 40)
	let groups = split(pool, leanOptions(context), 4, 3, 2, 0.1)
	if (groups.length < 4) {
		const taken = new Set(groups.flatMap((group) => group.members))
		const covered = new Set(
			groups.flatMap((group) => named(group.option).skip.map((g) => `${g}+`)),
		)
		groups = [
			...groups,
			...split(
				pool.filter((neighbor) => !taken.has(neighbor)),
				attributeOptions(context).filter(
					(option) => !covered.has(option.group),
				),
				4 - groups.length,
				3,
				2,
				0.1,
			),
		]
	}
	const usage = new Usage()
	const found = groups.map(({ option, members }) => {
		const name = named(option)
		return {
			id: option.id,
			label: name.label,
			titles: members.map((member) =>
				pick(
					member,
					reasonOf(context, member, usage, name.skip, {
						kind: "diff",
						text: name.word,
					}),
				),
			),
		}
	})
	if (found.length < 4) {
		const taken = new Set(
			groups.flatMap((group) => group.members.map((member) => member.title)),
		)
		const rest = pool.filter((neighbor) => !taken.has(neighbor.title))
		while (found.length < 4 && rest.length) {
			found.push({
				id: `closest${found.length}`,
				label: found.some((entry) => entry.label === "Closest")
					? "Also close"
					: "Closest",
				titles: rest
					.splice(0, 3)
					.map((member) => pick(member, reasonOf(context, member, usage))),
			})
		}
	}
	// Slots: 0 up, 1 right, 2 down, 3 left. An axis with both ends takes left and right, the next one down and up.
	const slots: (typeof found)[number][] = []
	const pairs = [
		[3, 1],
		[2, 0],
	]
	const axisOf = (id: string) => id.slice(0, -1)
	const paired = new Set<string>()
	for (const entry of found) {
		const other = found.find(
			(o) =>
				o !== entry &&
				LEANS.some((l) => l.id === o.id) &&
				LEANS.some((l) => l.id === entry.id) &&
				axisOf(o.id) === axisOf(entry.id),
		)
		if (!other || paired.has(entry.id) || !pairs.length) continue
		const [low, high] = pairs.shift() as number[]
		const [lowEnd, highEnd] = entry.id.endsWith("-")
			? [entry, other]
			: [other, entry]
		slots[low] = lowEnd
		slots[high] = highEnd
		paired.add(entry.id).add(other.id)
	}
	for (const entry of found) {
		if (paired.has(entry.id)) continue
		const free = [0, 1, 2, 3].find((slot) => !slots[slot])
		if (free !== undefined) slots[free] = entry
	}
	return [0, 1, 2, 3]
		.filter((slot) => slots[slot])
		.map((slot) => ({
			slot,
			label: slots[slot].label,
			titles: slots[slot].titles,
		}))
}

// walk3: the next steps of a path. The closest title, then one title per way to differ.
function steps(context: Context, neighbors: Neighbor[], count: number) {
	const usage = new Usage()
	const [closest, ...rest] = neighbors
	const result: NonNullable<WalkModel["steps"]> = []
	if (closest)
		result.push({
			...closest.title,
			toward: "Closest",
			...reasonOf(context, closest, usage),
		})
	const groups = split(
		rest.slice(0, 40),
		[...leanOptions(context, 2), ...attributeOptions(context, 0.35)],
		count - 1,
		1,
		1,
		0.15,
	)
	const covered = new Set<string>()
	for (const { option, members } of groups) {
		const name = named(option)
		// "Darker" and then "bleaker" would be the same step twice.
		if (name.skip.some((group) => covered.has(group))) continue
		for (const group of name.skip) covered.add(group)
		result.push({
			...members[0].title,
			toward: name.label,
			...reasonOf(context, members[0], usage, name.skip, {
				kind: "diff",
				text: name.word,
			}),
		})
	}
	const shown = new Set(result.map((step) => `${step.type}-${step.id}`))
	for (const neighbor of rest) {
		if (result.length >= count) break
		if (shown.has(`${neighbor.title.type}-${neighbor.title.id}`)) continue
		result.push({
			...neighbor.title,
			toward: "Also close",
			...reasonOf(context, neighbor, usage),
		})
	}
	return result
}

// walk5: piles. A pile is a trait the center has that sets a few neighbors apart from the rest. Niche traits and
// craft don't name a pile.
function piles(context: Context, neighbors: Neighbor[]) {
	const options = (from: number): Option[] =>
		Object.keys(SHARED)
			.filter(
				(key) =>
					!SIDE.has(key) &&
					!NEVER.has(key) &&
					(context.center(key) ?? 0) >= from,
			)
			.map((key) => ({
				id: key,
				group: DIFF[key]?.[2] ?? key,
				value: (neighbor) => {
					const b = neighbor.s(key)
					if (b === undefined || b < 6) return null
					return (
						b -
						(context.mean.get(key) ?? b) +
						0.25 * (b - 6) +
						0.6 * ((context.center(key) ?? 0) - 6)
					)
				},
			}))
	const pool = neighbors.slice(0, 40)
	let groups = split(pool, options(7), 4, 3, 3, 0.12)
	if (groups.length < 4) groups = split(pool, options(5), 4, 3, 2, 0.12)
	const usage = new Usage()
	return groups.map(({ option, members }) => ({
		label: cap(sharedWord(option.id)),
		titles: members.map((member) =>
			pick(
				member,
				reasonOf(context, member, usage, [option.group], {
					kind: "same",
					text: sharedWord(option.id),
				}),
			),
		),
	}))
}

export function buildWalkModel(input: {
	variant: WalkVariant
	center: PxTitle
	scores: Scores
	movies: RelatedCard[]
	shows: RelatedCard[]
	fingerprint: (type: PxType, id: number) => Scores | undefined
	/** The current year: a title from a later one isn't out. */
	year: number
}): WalkModel {
	const type = input.center.type
	const lists: [PxType, RelatedCard[]][] =
		type === "movie"
			? [
					["movie", input.movies],
					["show", input.shows],
				]
			: [
					["show", input.shows],
					["movie", input.movies],
				]
	const neighbors: Neighbor[] = []
	lists.forEach(([listType, cards], list) =>
		cards.forEach((card, index) => {
			const s = input.fingerprint(listType, card.tmdb_id)
			const year = Number(card.release_year)
			if (!s || !card.poster_path) return
			if (!year || year > input.year) return
			if (!(card.goodwatch_overall_score_normalized_percent > 0)) return
			if (listType === type && card.tmdb_id === input.center.id) return
			neighbors.push({
				title: toTitle(listType, card),
				s,
				rank: index + list * OTHER_TYPE_RANK,
			})
		}),
	)
	neighbors.sort(
		(a, b) => a.rank - b.rank || a.title.type.localeCompare(b.title.type),
	)
	const context: Context = { center: input.scores, mean: meanOf(neighbors) }
	const model: WalkModel = {
		variant: input.variant,
		center: input.center,
		links: neighbors.map(({ title: { type, id, title, year } }) => ({
			type,
			id,
			title,
			year,
		})),
	}
	if (input.variant === "walk1" || input.variant === "walk4")
		model.ring = ring(context, neighbors, 8)
	else if (input.variant === "walk2")
		model.compass = compass(context, neighbors)
	else if (input.variant === "walk3") model.steps = steps(context, neighbors, 5)
	else model.piles = piles(context, neighbors)
	return model
}
