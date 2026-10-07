// PROTOTYPE for "Prototype native-scroll carousels on title pages", fourth round. Throwaway code: not for production.
//
// What the dive variants show around the title you stand on. What the third round got wrong: the directions were
// chosen again for every center, so the words changed with every tap. Here:
//
// - A direction is one end of an axis. An axis is a level from 0 to 10, computed from a few fingerprint attributes
//   ("how dark", "how fast"). The level is the same function for every title, so two titles can be compared.
// - A walk has two axes and four directions, and they never change during the walk. Tone (lighter and darker) is on
//   every title and always lies left to right. The second axis is chosen once, for the title of the page, and lies
//   bottom to top. A step keeps both.
// - A title lies in a direction when its level is at least MIN_STEP further that way than the center's and the
//   two halves of the axis don't disagree. So the title you came from lies in the opposite direction by construction.
// - A direction with no such title is exhausted. It keeps its word and its place and says that it ends here.
// - A run is one direction graded from near to far: buckets of the level, the most similar title of each. It is
//   what a deep dive shows.
//
// No server imports: a pure function from scores to a small model.
import {
	type PxTitle,
	type PxType,
	SHARED,
	type Scores,
} from "~/ui/prototype-carousels/explore-model"

export const DIVE_VARIANTS = [
	"dive1",
	"dive2",
	"dive3",
	"dive4",
	"dive5",
] as const
export type DiveVariant = (typeof DIVE_VARIANTS)[number]
export const isDiveVariant = (value: unknown): value is DiveVariant =>
	DIVE_VARIANTS.includes(value as DiveVariant)

export interface Axis {
	id: string
	/** What the axis is called where the visitor picks one (dive5). */
	name: string
	/** The words of the low and the high end, as a label and inside a sentence. */
	low: string
	high: string
	lowWord: string
	highWord: string
	/** What the level measures, for "as dark as it gets". */
	lowMost: string
	highMost: string
	plus: string[]
	/** Only the strongest `top` of the plus attributes count: a comedy is funny in one or two ways, not in five. */
	top?: number
	minus: string[]
	/** The level a title needs before the high word is said of it ("funnier" needs a title with humor). */
	highFrom: number
	/** The level the center needs before the low word is offered ("more serious" needs a center that is funny). */
	lowFrom: number
	/** The smallest difference in level the words are claimed for. MIN_STEP unless the axis says otherwise. */
	step?: number
}

export const TONE: Axis = {
	id: "tone",
	name: "Tone",
	low: "Lighter",
	high: "Darker",
	lowWord: "lighter",
	highWord: "darker",
	lowMost: "light",
	highMost: "dark",
	plus: ["bleakness", "violence", "scare", "melancholy"],
	top: 2,
	minus: ["hopefulness", "wholesome"],
	highFrom: 0,
	lowFrom: 0,
}

/** The candidates for the second axis of a walk. */
export const SECOND_AXES: Axis[] = [
	{
		id: "pace",
		name: "Pace",
		low: "Calmer",
		high: "Faster",
		lowWord: "calmer",
		highWord: "faster",
		lowMost: "calm",
		highMost: "fast",
		plus: ["fast_pace", "adrenaline"],
		minus: ["slow_burn"],
		highFrom: 4,
		lowFrom: 0,
	},
	{
		id: "humor",
		name: "Humor",
		low: "More serious",
		high: "Funnier",
		lowWord: "more serious",
		highWord: "funnier",
		lowMost: "serious",
		highMost: "funny",
		plus: [
			"situational_comedy",
			"wit_wordplay",
			"physical_comedy",
			"absurdist_humor",
			"cringe_humor",
		],
		top: 2,
		minus: [],
		highFrom: 6,
		lowFrom: 4.5,
	},
	{
		id: "strange",
		name: "Strangeness",
		low: "More conventional",
		high: "Stranger",
		lowWord: "more conventional",
		highWord: "stranger",
		lowMost: "conventional",
		highMost: "strange",
		plus: ["surrealism", "uncanny", "eccentricity", "psychedelic"],
		top: 2,
		minus: [],
		highFrom: 4.5,
		lowFrom: 4,
	},
	{
		id: "ideas",
		name: "Complexity",
		low: "Simpler",
		high: "More complex",
		lowWord: "simpler",
		highWord: "more complex",
		lowMost: "simple",
		highMost: "complex",
		plus: ["complexity", "ambiguity", "philosophical"],
		minus: [],
		highFrom: 4.5,
		lowFrom: 4,
	},
	{
		id: "scale",
		name: "Scale",
		low: "More intimate",
		high: "Bigger",
		lowWord: "more intimate",
		highWord: "bigger",
		lowMost: "intimate",
		highMost: "big",
		plus: ["spectacle", "world_immersion"],
		minus: ["dialogue_centrality"],
		highFrom: 4.5,
		lowFrom: 0,
	},
]

export const ALL_AXES = [TONE, ...SECOND_AXES]

/**
 * Fifth round: an axis that is one fingerprint attribute ("more tension", "less tension"), for the dials that draw
 * their choices from the title's own traits. Its id is `t.` and the attribute. One attribute is coarser than a mean
 * of several, so the words are claimed only from a difference of two points.
 */
export function traitAxis(key: string): Axis | undefined {
	const noun = SHARED[key]
	if (!noun) return undefined
	return {
		id: `t.${key}`,
		name: noun.charAt(0).toUpperCase() + noun.slice(1),
		low: `Less ${noun}`,
		high: `More ${noun}`,
		lowWord: `less ${noun}`,
		highWord: `more ${noun}`,
		lowMost: `free of ${noun}`,
		highMost: `full of ${noun}`,
		plus: [key],
		minus: [],
		highFrom: 5,
		lowFrom: 4,
		step: 1.5,
	}
}

export const axisOf = (id: string) =>
	id.startsWith("t.")
		? traitAxis(id.slice(2))
		: ALL_AXES.find((axis) => axis.id === id)

const mean = (values: number[]) =>
	values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

/** The two halves of an axis for a title: how much of the high end, and how much of what speaks against it. */
function halves(axis: Axis, s: Scores): { plus: number; minus: number | null } {
	const plus = axis.plus.map((key) => s(key) ?? 0).sort((a, b) => b - a)
	return {
		plus: mean(plus.slice(0, axis.top ?? plus.length)),
		minus: axis.minus.length
			? mean(axis.minus.map((key) => s(key) ?? 0))
			: null,
	}
}

/** A title's level on an axis, from 0 (the low end) to 10. */
export function levelOf(axis: Axis, s: Scores): number {
	const { plus, minus } = halves(axis, s)
	return minus === null ? plus : (plus + 10 - minus) / 2
}

export type Sign = 1 | -1
export interface Direction {
	id: string
	axis: Axis
	sign: Sign
	/** Where it lies: w and e for tone, s and n for the second axis. */
	pos: "n" | "e" | "s" | "w"
	label: string
	word: string
}

export function directionOf(id: string): Direction | undefined {
	const axis = axisOf(id.slice(0, -1))
	if (!axis || !/[+-]$/.test(id)) return undefined
	const sign: Sign = id.endsWith("+") ? 1 : -1
	return {
		id,
		axis,
		sign,
		pos: axis === TONE ? (sign > 0 ? "e" : "w") : sign > 0 ? "n" : "s",
		label: sign > 0 ? axis.high : axis.low,
		word: sign > 0 ? axis.highWord : axis.lowWord,
	}
}

/** The four directions of a walk: north, east, south, west. */
export const directionsOf = (second: Axis): Direction[] =>
	[`${second.id}+`, "tone+", `${second.id}-`, "tone-"].map(
		(id) => directionOf(id) as Direction,
	)

export const oppositeOf = (id: string) =>
	`${id.slice(0, -1)}${id.endsWith("+") ? "-" : "+"}`

/** The smallest difference in level that a direction word is claimed for. */
export const MIN_STEP = 0.75
/** The least similarity a title needs to count as "still close". Fingerprints of unrelated titles reach about 0.85. */
export const MIN_NEAR = 0.88

/**
 * How far a title lies in a direction from the center: the difference in level, or null when the word wouldn't be
 * true (too small a difference, the halves of the axis disagree, or the title isn't what the word says at all).
 */
export function farther(
	direction: Direction,
	center: Scores,
	s: Scores,
): number | null {
	const { axis, sign } = direction
	const delta = (levelOf(axis, s) - levelOf(axis, center)) * sign
	if (delta < (axis.step ?? MIN_STEP)) return null
	const a = halves(axis, center)
	const b = halves(axis, s)
	// "Darker" for a title with less of everything dark, only because it is less hopeful, reads wrong.
	if ((b.plus - a.plus) * sign < 0) return null
	if (a.minus !== null && b.minus !== null && (a.minus - b.minus) * sign < -1)
		return null
	if (sign > 0 && levelOf(axis, s) < axis.highFrom) return null
	if (sign < 0 && levelOf(axis, center) < axis.lowFrom) return null
	return delta
}

export interface Candidate {
	title: PxTitle
	s: Scores
	/** Qdrant's similarity to the center. */
	near: number
}

export interface DivePick extends PxTitle {
	/** The level on the direction's axis, and how far it is from the center's. */
	level: number
	delta: number
	/** "A bit darker", "Darker", "Much darker". */
	grade: string
	why: string
	/** Qdrant's similarity to the center, with the bonus for a known title. */
	near: number
}

/** 0 for "a bit", 1 for the plain word, 2 for "much". */
export const bandOf = (direction: Direction, delta: number) => {
	const step = direction.axis.step ?? MIN_STEP
	return delta < 2 * step ? 0 : delta < 4 * step ? 1 : 2
}

export const gradeOf = (direction: Direction, delta: number) =>
	[`a bit ${direction.word}`, direction.word, `much ${direction.word}`][
		bandOf(direction, delta)
	]

export const cap = (text: string) =>
	text.charAt(0).toUpperCase() + text.slice(1)

// A trait worth naming next to a direction: both titles are strong on it. Niche and craft traits say nothing here.
const NO_SHARED = new Set([
	"nostalgia",
	"pop_culture",
	"gaming",
	"educational",
	"contemporary_realism",
	"dialogue_centrality",
	"visual_stylization",
	"music_centrality",
	"meta_narrative",
	"non_linear_narrative",
	"camp_and_irony",
	"grotesque",
])

export function sharedTrait(
	direction: Direction,
	center: Scores,
	s: Scores,
	used: Map<string, number>,
): string | null {
	const own = new Set([...direction.axis.plus, ...direction.axis.minus])
	let best: string | null = null
	let bestValue = 0
	for (const key of Object.keys(SHARED)) {
		if (own.has(key) || NO_SHARED.has(key)) continue
		const a = center(key) ?? 0
		const b = s(key) ?? 0
		if (a < 7 || b < 7) continue
		const value = Math.min(a, b) - 1.5 * (used.get(key) ?? 0)
		if (value > bestValue) {
			best = key
			bestValue = value
		}
	}
	if (best) used.set(best, (used.get(best) ?? 0) + 1)
	return best ? SHARED[best] : null
}

/**
 * One direction graded from near to far: the level range that the candidates cover is cut into `count` buckets, and
 * each bucket gives its most similar title. Levels rise (or fall) along the run.
 */
export function runOf(
	direction: Direction,
	center: Scores,
	candidates: Candidate[],
	count: number,
): DivePick[] {
	const found = candidates
		.map((candidate) => ({
			candidate,
			delta: farther(direction, center, candidate.s),
		}))
		.filter(
			(entry): entry is { candidate: Candidate; delta: number } =>
				entry.delta !== null,
		)
	if (!found.length) return []
	const far = Math.max(...found.map((entry) => entry.delta))
	const from = direction.axis.step ?? MIN_STEP
	// Buckets no narrower than half a point, so that a short range gives a short run and not a crowd on one level.
	const width = Math.max(0.5, (far - from + 0.001) / count)
	const buckets = new Map<number, { candidate: Candidate; delta: number }>()
	for (const entry of found) {
		const bucket = Math.min(count - 1, Math.floor((entry.delta - from) / width))
		const held = buckets.get(bucket)
		if (!held || entry.candidate.near > held.candidate.near)
			buckets.set(bucket, entry)
	}
	const used = new Map<string, number>()
	const base = levelOf(direction.axis, center)
	return [...buckets.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([, { candidate, delta }]) => {
			const grade = gradeOf(direction, delta)
			const trait = sharedTrait(direction, center, candidate.s, used)
			return {
				...candidate.title,
				level: Math.round((base + delta * direction.sign) * 100) / 100,
				delta: Math.round(delta * 100) / 100,
				grade,
				near: candidate.near,
				why: trait ? `${cap(grade)}, same ${trait}` : cap(grade),
			}
		})
}

/**
 * The second axis of a walk that starts on this title, chosen once: the one that has neighbors both ways (by the
 * same test that decides what a direction shows), says something other than tone, and, between equals, that the
 * title is known for (humor for a comedy). An axis with one dead end at the start loses to one with two ways to go.
 */
export function chooseSecondAxis(center: Scores, neighbors: Scores[]): Axis {
	if (!neighbors.length) return SECOND_AXES[0]
	const deltas = (axis: Axis) => {
		const base = levelOf(axis, center)
		const d = neighbors.map((s) => levelOf(axis, s) - base)
		const m = mean(d)
		return { d, m, sd: Math.sqrt(mean(d.map((v) => (v - m) ** 2))) }
	}
	const tone = deltas(TONE)
	let best = SECOND_AXES[0]
	let bestValue = Number.NEGATIVE_INFINITY
	for (const axis of SECOND_AXES) {
		const [up, down] = ([1, -1] as const).map((sign) => {
			const direction = directionOf(`${axis.id}${sign > 0 ? "+" : "-"}`)
			return direction
				? Math.min(
						10,
						neighbors.filter((s) => farther(direction, center, s) !== null)
							.length,
					)
				: 0
		})
		const { d, m, sd } = deltas(axis)
		const correlation =
			sd && tone.sd
				? mean(d.map((v, i) => (v - m) * (tone.d[i] - tone.m))) / (sd * tone.sd)
				: 0
		const known = levelOf(axis, center) >= 6.5 ? 1.25 : 1
		const value =
			(2 * Math.min(up, down) + 0.5 * (up + down)) *
			(1 - 0.5 * Math.abs(correlation)) *
			known
		if (value > bestValue) {
			best = axis
			bestValue = value
		}
	}
	return best
}

export interface DiveDirection {
	id: string
	pos: Direction["pos"]
	label: string
	word: string
	/** The titles that way, near to far. Empty when the direction is exhausted. */
	titles: DivePick[]
	/** Why it is empty: "As dark as it gets around here". */
	end: string | null
	/** The title the visitor came from, when the last step went the opposite way. */
	back: PxTitle | null
}

export interface DiveModel {
	variant: DiveVariant
	center: PxTitle
	/** The second axis of the walk. Tone is the first, always. */
	axis: string
	/** The center's level per axis of the walk. */
	levels: Record<string, number>
	/** North, east, south, west. */
	directions: DiveDirection[]
	/** The direction the stage dives into, or null. */
	lock: string | null
	/** Text links of the section: the closest titles of the page's title. */
	links: Pick<PxTitle, "type" | "id" | "title" | "year">[]
}

export const keyOf = (title: { type: PxType; id: number }) =>
	`${title.type}-${title.id}`

export function buildDiveModel(input: {
	variant: DiveVariant
	center: PxTitle
	scores: Scores
	second: Axis
	/** Per direction id, the titles Qdrant found that way. */
	candidates: Record<string, Candidate[]>
	/** How many titles a direction shows at rest, as the one dived into, and next to the one dived into. */
	rest: number
	dive: number
	beside: number
	lock: string | null
	from: { title: PxTitle; via: string } | null
	links: DiveModel["links"]
}): DiveModel {
	const directions = directionsOf(input.second)
	const backAt = input.from ? oppositeOf(input.from.via) : null
	// The title the visitor came from has its place: no direction offers it a second time.
	const shown = new Set<string>(input.from ? [keyOf(input.from.title)] : [])
	// A title shows once: a faster and darker title lies in the first direction that takes it. The direction the
	// stage dives into goes first.
	const built = new Map<string, DiveDirection>()
	for (const direction of [...directions].sort(
		(a, b) => Number(b.id === input.lock) - Number(a.id === input.lock),
	)) {
		const back = backAt === direction.id && input.from ? input.from.title : null
		const want =
			input.lock === direction.id
				? input.dive
				: input.lock
					? input.beside
					: input.rest
		const pool = (input.candidates[direction.id] ?? []).filter(
			(candidate) =>
				candidate.near >= MIN_NEAR && !shown.has(keyOf(candidate.title)),
		)
		const count = back ? want - 1 : want
		const titles = count > 0 ? runOf(direction, input.scores, pool, count) : []
		for (const title of titles) shown.add(keyOf(title))
		const level = levelOf(direction.axis, input.scores)
		const { axis, sign } = direction
		const edge = sign > 0 ? level >= 7.5 : level <= Math.max(2.5, axis.lowFrom)
		built.set(direction.id, {
			id: direction.id,
			pos: direction.pos,
			label: direction.label,
			word: direction.word,
			titles,
			end: pool.some((c) => farther(direction, input.scores, c.s) !== null)
				? null
				: edge
					? `about as ${sign > 0 ? axis.highMost : axis.lowMost} as it gets`
					: `nothing ${direction.word} is still close`,
			back,
		})
	}
	return {
		variant: input.variant,
		center: input.center,
		axis: input.second.id,
		levels: Object.fromEntries(
			[TONE, input.second].map((axis) => [
				axis.id,
				Math.round(levelOf(axis, input.scores) * 100) / 100,
			]),
		),
		lock: input.lock,
		links: input.links,
		directions: directions.map(
			(direction) => built.get(direction.id) as DiveDirection,
		),
	}
}
