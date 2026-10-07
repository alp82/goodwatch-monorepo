// PROTOTYPE for "Prototype native-scroll carousels on title pages", fifth round. Throwaway code: not for production.
//
// What the ring variants show around the title you stand on. The scheme is the fourth round's (dive-model.ts): an
// axis is a level from 0 to 10, a direction is one end of an axis, and a title lies in a direction when its level is
// clearly further that way. What this round changes:
//
// - A walk has one, two, or three axes, and none of them is fixed by the model: the form says how many, and a dial
//   (when the form has one) says which. An axis can be one fingerprint attribute of the page's title ("more
//   tension").
// - A dive shows ranks: "a bit" nearest to the title you stand on, the plain word, and "much" farthest. A title's
//   rank is its real difference in level, so an empty rank stays empty and the words stay true.
// - Steps in one direction can be anchored: the titles further that way are the ones closest to the title where the
//   direction started, not to the title of the last step. A chain of steps then stays near its start and ends
//   sooner, and doesn't drift to wherever "lighter" leads from anywhere.
//
// No server imports: pure functions from scores to a small model.
import {
	type Axis,
	type Candidate,
	type Direction,
	type DivePick,
	MIN_NEAR,
	SECOND_AXES,
	type Sign,
	TONE,
	axisOf,
	bandOf,
	cap,
	farther,
	gradeOf,
	keyOf,
	levelOf,
	runOf,
	sharedTrait,
	traitAxis,
} from "~/ui/prototype-carousels/dive-model"
import {
	type PxTitle,
	SHARED,
	type Scores,
} from "~/ui/prototype-carousels/explore-model"

export const RING_VARIANTS = [
	"ring1",
	"ring2",
	"ring3",
	"ring4",
	"ring5",
	"ring6",
	"ring7",
	"ring8",
	"ring9",
] as const
export type RingVariant = (typeof RING_VARIANTS)[number]
export const isRingVariant = (value: unknown): value is RingVariant =>
	RING_VARIANTS.includes(value as RingVariant)

/**
 * How a form lays its directions out.
 * - ring: two axes, a row or column of three per side. A dive opens one side into a fan of ranks.
 * - star: three axes, six spokes of two. A dive opens one spoke into a fan.
 * - line: one axis, two strips that scroll sideways away from the center. No dive: scrolling goes further.
 * - bow: one axis, three ranks on each side of the center, left and right. No dive: the ranks are the run.
 * - glass: one axis, two ranks above and below the center. No dive.
 * - arms: two axes as two rows, four strips that scroll sideways away from the center. No dive.
 */
export type RingLayout = "ring" | "star" | "line" | "bow" | "glass" | "arms"
/**
 * How the visitor chooses what the axes are about.
 * - words: a direction's word opens the choices for its axis.
 * - presets: chips that set every axis at once.
 * - traits: chips with the page title's own traits, for the form's last axis.
 * - list: a list of pairs for the one axis, each spelled out.
 */
export type RingDial = "none" | "words" | "presets" | "traits" | "list"

export interface RingForm {
	layout: RingLayout
	axes: 1 | 2 | 3
	dial: RingDial
	/** Whether the form has a dive mode. */
	dive: boolean
	hint: string
}

export const RING_FORMS: Record<RingVariant, RingForm> = {
	ring1: {
		layout: "ring",
		axes: 2,
		dial: "none",
		dive: true,
		hint: "Each side keeps its meaning. Tap a poster to step that way, or a word to see further that way.",
	},
	ring2: {
		layout: "ring",
		axes: 2,
		dial: "words",
		dive: true,
		hint: "Tap a word to choose what its axis is about. Tap a poster to step, or further to dive.",
	},
	ring3: {
		layout: "ring",
		axes: 2,
		dial: "presets",
		dive: true,
		hint: "The chips set both axes. Tap a poster to step that way, or a word to see further that way.",
	},
	ring4: {
		layout: "ring",
		axes: 2,
		dial: "traits",
		dive: true,
		hint: "Lighter and darker stay left and right. The chips set up and down to one of this title's own traits.",
	},
	ring5: {
		layout: "star",
		axes: 3,
		dial: "none",
		dive: true,
		hint: "Six ways, nearer titles first. Tap a poster to step that way, or a word to see further that way.",
	},
	ring6: {
		layout: "line",
		axes: 1,
		dial: "list",
		dive: false,
		hint: "One line. Scroll away from the middle to go further, and pick below what the line means.",
	},
	ring7: {
		layout: "glass",
		axes: 1,
		dial: "words",
		dive: false,
		hint: "One axis, up and down. The further from the middle, the more. Tap a word to change what it means.",
	},
	ring8: {
		layout: "arms",
		axes: 2,
		dial: "words",
		dive: false,
		hint: "Four arms. Scroll an arm outward to go further. Tap a word to change what its row means.",
	},
	ring9: {
		layout: "bow",
		axes: 1,
		dial: "traits",
		dive: false,
		hint: "One axis from this title's own traits. The further from the middle, the more. The chips change it.",
	},
}

/** Where a direction lies. The arms have two rows: w and e, and below them w2 and e2. */
export type RingPos =
	| "n"
	| "e"
	| "s"
	| "w"
	| "ne"
	| "se"
	| "sw"
	| "nw"
	| "w2"
	| "e2"

/** Per layout and axis: the places of the low and the high end. */
const PLACES: Record<RingLayout, [RingPos, RingPos][]> = {
	ring: [
		["w", "e"],
		["s", "n"],
	],
	star: [
		["w", "e"],
		["sw", "ne"],
		["se", "nw"],
	],
	line: [["w", "e"]],
	bow: [["w", "e"]],
	glass: [["s", "n"]],
	arms: [
		["w", "e"],
		["w2", "e2"],
	],
}

/** How many titles a direction holds at rest, and the ranks of a dive (or of a form that is all ranks). */
const COUNTS: Record<
	RingLayout,
	{ rest: number; ranks: number[]; long: number; show: number }
> = {
	ring: { rest: 3, ranks: [3, 3, 3], long: 0, show: 0 },
	star: { rest: 2, ranks: [3, 3, 3], long: 0, show: 0 },
	line: { rest: 0, ranks: [], long: 16, show: 5 },
	arms: { rest: 0, ranks: [], long: 16, show: 5 },
	bow: { rest: 0, ranks: [2, 3, 4], long: 0, show: 0 },
	// Two ranks have room above and below: "a bit", and everything further.
	glass: { rest: 0, ranks: [4, 5], long: 0, show: 0 },
}

const FIXED = [TONE, ...SECOND_AXES]

const mean = (values: number[]) =>
	values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

const directionAt = (axis: Axis, sign: Sign): Direction => ({
	id: `${axis.id}${sign > 0 ? "+" : "-"}`,
	axis,
	sign,
	pos: "n",
	label: sign > 0 ? axis.high : axis.low,
	word: sign > 0 ? axis.highWord : axis.lowWord,
})

/** How many of the neighbors lie each way on an axis, by the test that decides what a direction shows. */
function ways(axis: Axis, center: Scores, neighbors: Scores[]) {
	const count = (sign: Sign) =>
		neighbors.filter(
			(s) => farther(directionAt(axis, sign), center, s) !== null,
		).length
	return { up: count(1), down: count(-1) }
}

/**
 * Axes ordered by how much there is to see on them around a title: neighbors both ways count most, an axis that
 * says the same as one already taken counts less, and an axis the title is known for counts a little more.
 */
export function rankAxes(
	center: Scores,
	neighbors: Scores[],
	axes: Axis[],
	taken: Axis[] = [],
): { axis: Axis; value: number; up: number; down: number }[] {
	const deltas = (axis: Axis) => {
		const base = levelOf(axis, center)
		const d = neighbors.map((s) => levelOf(axis, s) - base)
		const m = mean(d)
		return { d, m, sd: Math.sqrt(mean(d.map((v) => (v - m) ** 2))) }
	}
	const against = taken.map(deltas)
	return axes
		.map((axis) => {
			const { up, down } = ways(axis, center, neighbors)
			const own = deltas(axis)
			let same = 0
			for (const other of against) {
				const correlation =
					own.sd && other.sd
						? mean(own.d.map((v, i) => (v - own.m) * (other.d[i] - other.m))) /
							(own.sd * other.sd)
						: 0
				same = Math.max(same, Math.abs(correlation))
			}
			const known = levelOf(axis, center) >= 6.5 ? 1.25 : 1
			const value =
				(2 * Math.min(up, down, 10) + 0.5 * Math.min(up + down, 20)) *
				(1 - 0.5 * same) *
				known
			return { axis, value, up, down }
		})
		.sort((a, b) => b.value - a.value)
}

// Attributes that are already an end of a fixed axis, or that say nothing as "more" and "less".
const NO_TRAIT = new Set([
	...FIXED.flatMap((axis) => [...axis.plus, ...axis.minus]),
	"nostalgia",
	"pop_culture",
	"gaming",
	"contemporary_realism",
	"visual_stylization",
	"non_linear_narrative",
	"character_depth",
	"music_centrality",
])

/** A choice of a dial: an axis, and whether the related titles have clearly more and clearly less of it. */
export interface RingOption {
	id: string
	name: string
	low: string
	high: string
	/** "both", or the one end that has titles. */
	side: "both" | "low" | "high"
}

/**
 * The page title's own traits as axes: the attributes it scores at least 6 on, best first. A trait is offered when
 * the related titles include at least three with clearly more and three with clearly less of it. A trait the title
 * is at the top of (hardly anything has more) is offered as one-sided, and says so.
 */
export function ownTraits(
	center: Scores,
	neighbors: Scores[],
	limit: number,
): RingOption[] {
	const found: { option: RingOption; value: number }[] = []
	for (const key of Object.keys(SHARED)) {
		if (NO_TRAIT.has(key)) continue
		const axis = traitAxis(key)
		const score = center(key) ?? 0
		if (!axis || score < 6) continue
		const { up, down } = ways(axis, center, neighbors)
		const side =
			up >= 3 && down >= 3
				? "both"
				: down >= 5
					? "low"
					: up >= 5
						? "high"
						: null
		if (!side) continue
		found.push({
			option: {
				id: axis.id,
				name: axis.name,
				low: axis.low,
				high: axis.high,
				side,
			},
			// The title's strongest traits first. Between equals, the one with titles both ways.
			value:
				2 * score + (side === "both" ? 1.5 : 0) + 0.1 * Math.min(up, down, 10),
		})
	}
	// A title's very strongest traits are mostly one-sided (hardly anything has more), so the choices are the
	// strongest traits with titles both ways, and the rest of the places go to the strongest one-sided ones.
	const sorted = found.sort((a, b) => b.value - a.value)
	const both = sorted
		.filter((entry) => entry.option.side === "both")
		.slice(0, Math.max(1, limit - 1))
	const rest = sorted
		.filter((entry) => entry.option.side !== "both")
		.slice(0, limit - both.length)
	return [...both, ...rest]
		.sort((a, b) => b.value - a.value)
		.map((entry) => entry.option)
}

const optionOf = (
	axis: Axis,
	side: RingOption["side"] = "both",
): RingOption => ({
	id: axis.id,
	name: axis.name,
	low: axis.low,
	high: axis.high,
	side,
})

/** A trait choice as the browser passes it on: `t.tension`, or `t.crime.low` for a one-sided one. */
export const packOption = (option: RingOption) =>
	option.side === "both" ? option.id : `${option.id}.${option.side}`
export function unpackOption(value: string): RingOption | undefined {
	const [, id, side] = /^(t\.[a-z_]+)(?:\.(low|high))?$/.exec(value) ?? []
	const axis = id ? axisOf(id) : undefined
	return axis
		? optionOf(axis, (side as RingOption["side"] | undefined) ?? "both")
		: undefined
}

/** The presets of ring3: both axes at once. `own` and `surprise` are filled in for the title. */
export const PRESETS: { id: string; label: string; axes: string[] | null }[] = [
	{ id: "mood", label: "Mood", axes: ["tone", "humor"] },
	{ id: "drive", label: "Pace and scale", axes: ["pace", "scale"] },
	{ id: "mind", label: "Mind", axes: ["ideas", "strange"] },
	{ id: "own", label: "Own traits", axes: null },
]

export interface RingPick extends DivePick {
	/** 0 nearest to the center. Only where the form shows ranks. */
	rank: number
}

/**
 * One direction as ranks: per band of the difference in level ("a bit", the word, "much"), the most similar titles,
 * as many as the rank has room for. `merge` puts everything from the last rank's band on into the last rank.
 */
export function ranksOf(
	direction: Direction,
	center: Scores,
	candidates: Candidate[],
	sizes: number[],
): RingPick[] {
	const bands: { candidate: Candidate; delta: number }[][] = sizes.map(() => [])
	for (const candidate of candidates) {
		const delta = farther(direction, center, candidate.s)
		if (delta === null) continue
		bands[Math.min(sizes.length - 1, bandOf(direction, delta))].push({
			candidate,
			delta,
		})
	}
	const used = new Map<string, number>()
	const base = levelOf(direction.axis, center)
	return bands.flatMap((band, rank) =>
		band
			.sort((a, b) => b.candidate.near - a.candidate.near)
			.slice(0, sizes[rank])
			.sort((a, b) => a.delta - b.delta)
			.map(({ candidate, delta }) => {
				const grade = gradeOf(direction, delta)
				const trait = sharedTrait(direction, center, candidate.s, used)
				return {
					...candidate.title,
					level: Math.round((base + delta * direction.sign) * 100) / 100,
					delta: Math.round(delta * 100) / 100,
					grade,
					near: candidate.near,
					why: trait ? `${cap(grade)}, same ${trait}` : cap(grade),
					rank,
				}
			}),
	)
}

export interface RingDirection {
	id: string
	/** Which of the walk's axes it belongs to. */
	slot: number
	sign: Sign
	pos: RingPos
	label: string
	word: string
	/** The titles that way, near to far. Empty when the direction is exhausted, or hidden by a dive elsewhere. */
	titles: RingPick[]
	/** Why it is empty: "about as dark as it gets". */
	end: string | null
	/** The title the visitor came from, when the last step went the opposite way. */
	back: PxTitle | null
	/** Strips: further titles than the ones shown can be asked for. */
	more: boolean
}

export interface RingModel {
	variant: RingVariant
	center: PxTitle
	/** The axes of the walk, in the order of the form's places. */
	axes: string[]
	/** The words of each axis, for the dial. */
	axisNames: { id: string; name: string; low: string; high: string }[]
	/** The center's level per axis. */
	levels: Record<string, number>
	directions: RingDirection[]
	/** The direction the stage dives into, or null. */
	lock: string | null
	/** What the dial offers besides the fixed axes: the page title's own traits. */
	traits: RingOption[]
	/** The fixed axes, for the dials that list them. */
	fixed: RingOption[]
	links: Pick<PxTitle, "type" | "id" | "title" | "year">[]
}

export const fixedOptions = (): RingOption[] =>
	FIXED.map((axis) => optionOf(axis))

/** The directions of a walk on these axes, with their places in the form's layout. */
export function ringDirections(variant: RingVariant, axes: Axis[]) {
	const places = PLACES[RING_FORMS[variant].layout]
	return axes.slice(0, places.length).flatMap((axis, slot) =>
		([-1, 1] as const).map((sign) => ({
			...directionAt(axis, sign),
			slot,
			place: places[slot][sign > 0 ? 1 : 0],
		})),
	)
}

/**
 * A far end must not leave the kind of title: from a nature documentary, "much faster" was a disaster movie. The
 * fingerprint has one attribute that tells non-fiction from fiction well enough for a prototype (educational
 * value), so a title that is strongly non-fiction only leads to titles that are at least somewhat so.
 */
const sameKind = (center: Scores, s: Scores) =>
	(center("educational") ?? 0) < 7 || (s("educational") ?? 0) >= 5

export function buildRingModel(input: {
	variant: RingVariant
	center: PxTitle
	scores: Scores
	axes: Axis[]
	/** Per direction id, the titles found that way, and whether they are measured from the center itself. */
	candidates: Record<string, Candidate[]>
	lock: string | null
	from: { title: PxTitle; via: string } | null
	traits: RingOption[]
	links: RingModel["links"]
	/** Strips: the direction whose further titles are asked for. Its titles are then the ones after the shown. */
	more?: string | null
}): RingModel {
	const form = RING_FORMS[input.variant]
	const counts = COUNTS[form.layout]
	const directions = ringDirections(input.variant, input.axes)
	const lock =
		form.dive && directions.some((d) => d.id === input.lock) ? input.lock : null
	const opposite = (id: string) =>
		`${id.slice(0, -1)}${id.endsWith("+") ? "-" : "+"}`
	const backAt =
		input.from && directions.some((d) => d.id === input.from?.via)
			? opposite(input.from.via)
			: null
	// The title the visitor came from has its place: no direction offers it a second time.
	const shown = new Set<string>(
		backAt && input.from ? [keyOf(input.from.title)] : [],
	)
	const built = new Map<string, RingDirection>()
	// A title shows once: it lies in the first direction that takes it. The direction of a dive goes first.
	for (const direction of [...directions].sort(
		(a, b) => Number(b.id === lock) - Number(a.id === lock),
	)) {
		const back = backAt === direction.id && input.from ? input.from.title : null
		const pool = (input.candidates[direction.id] ?? []).filter(
			(candidate) =>
				candidate.near >= MIN_NEAR &&
				!shown.has(keyOf(candidate.title)) &&
				sameKind(input.scores, candidate.s),
		)
		const less = (sizes: number[]) =>
			back ? [Math.max(0, sizes[0] - 1), ...sizes.slice(1)] : sizes
		let titles: RingPick[] = []
		let more = false
		if (lock) {
			if (direction.id === lock)
				titles = ranksOf(direction, input.scores, pool, less(counts.ranks))
		} else if (counts.long) {
			const run = runOf(direction, input.scores, pool, counts.long).map(
				(pick) => ({ ...pick, rank: 0 }),
			)
			const show = counts.show - (back ? 1 : 0)
			titles =
				input.more === direction.id ? run.slice(show) : run.slice(0, show)
			more = input.more !== direction.id && run.length > show
		} else if (counts.rest) {
			const want = counts.rest - (back ? 1 : 0)
			titles = runOf(direction, input.scores, pool, want).map((pick) => ({
				...pick,
				rank: 0,
			}))
			// A short range of levels gives fewer grades than places. The most similar titles that way fill them.
			if (titles.length < want) {
				const have = new Set(titles.map(keyOf))
				titles = [
					...titles,
					...ranksOf(direction, input.scores, pool, [want + titles.length])
						.filter((pick) => !have.has(keyOf(pick)))
						.slice(0, want - titles.length),
				].sort((a, b) => a.delta - b.delta)
			}
		} else titles = ranksOf(direction, input.scores, pool, less(counts.ranks))
		for (const title of titles) shown.add(keyOf(title))
		const level = levelOf(direction.axis, input.scores)
		const { axis, sign } = direction
		const edge = sign > 0 ? level >= 7.5 : level <= Math.max(2.5, axis.lowFrom)
		built.set(direction.id, {
			id: direction.id,
			slot: direction.slot,
			sign,
			pos: direction.place,
			label: direction.label,
			word: direction.word,
			titles,
			end: pool.some((c) => farther(direction, input.scores, c.s) !== null)
				? null
				: edge
					? `about as ${sign > 0 ? axis.highMost : axis.lowMost} as it gets`
					: `nothing ${direction.word} is still close`,
			back,
			more,
		})
	}
	return {
		variant: input.variant,
		center: input.center,
		axes: input.axes.map((axis) => axis.id),
		axisNames: input.axes.map((axis) => ({
			id: axis.id,
			name: axis.name,
			low: axis.low,
			high: axis.high,
		})),
		levels: Object.fromEntries(
			input.axes.map((axis) => [
				axis.id,
				Math.round(levelOf(axis, input.scores) * 100) / 100,
			]),
		),
		lock,
		traits: input.traits,
		fixed: fixedOptions(),
		links: input.links,
		directions: directions.map(
			(direction) => built.get(direction.id) as RingDirection,
		),
	}
}

/**
 * The axes a form starts with on a title, chosen once from its related titles. Tone is first where the form has
 * more than one axis and no dial that sets them all.
 */
export function startAxes(
	variant: RingVariant,
	center: Scores,
	neighbors: Scores[],
	traits: RingOption[],
): Axis[] {
	const form = RING_FORMS[variant]
	const both = traits.filter((trait) => trait.side === "both")
	const trait = (both[0] ?? traits[0])?.id
	const traitAxisOf = trait ? axisOf(trait) : undefined
	if (variant === "ring9") return [traitAxisOf ?? TONE]
	if (variant === "ring6") return [TONE]
	if (form.axes === 1)
		return [rankAxes(center, neighbors, FIXED)[0]?.axis ?? TONE]
	if (variant === "ring4")
		return [
			TONE,
			traitAxisOf ?? rankAxes(center, neighbors, SECOND_AXES, [TONE])[0].axis,
		]
	if (variant === "ring3") return presetAxes("best", center, neighbors, traits)
	const second = rankAxes(center, neighbors, SECOND_AXES, [TONE])
	if (form.axes === 2) return [TONE, second[0].axis]
	const third = rankAxes(
		center,
		neighbors,
		SECOND_AXES.filter((axis) => axis !== second[0].axis),
		[TONE, second[0].axis],
	)
	return [TONE, second[0].axis, third[0].axis]
}

/** The axes of a preset. `best` is the fixed preset with the most to see, and `surprise` is any two axes. */
export function presetAxes(
	id: string,
	center: Scores,
	neighbors: Scores[],
	traits: RingOption[],
	not: string[] = [],
): Axis[] {
	const resolve = (ids: string[]) =>
		ids
			.map((axis) => axisOf(axis))
			.filter((axis): axis is Axis => Boolean(axis))
	const richness = (axes: Axis[]) =>
		axes.reduce((sum, axis) => {
			const { up, down } = ways(axis, center, neighbors)
			return sum + Math.min(up, down, 10)
		}, 0)
	if (id === "own") {
		const own = resolve(traits.map((trait) => trait.id)).slice(0, 2)
		if (own.length === 2) return own
	}
	if (id === "surprise") {
		const all = [...FIXED, ...resolve(traits.map((trait) => trait.id))]
		const first = rankAxes(
			center,
			neighbors,
			all.filter((axis) => !not.includes(axis.id)),
		)[0]?.axis
		const second =
			first &&
			rankAxes(
				center,
				neighbors,
				all.filter((axis) => axis !== first && !not.includes(axis.id)),
				[first],
			)[0]?.axis
		if (first && second) return [first, second]
	}
	const fixed = PRESETS.filter((preset) => preset.axes).map((preset) =>
		resolve(preset.axes ?? []),
	)
	const named = PRESETS.find((preset) => preset.id === id)?.axes
	if (named) return resolve(named)
	return fixed.sort((a, b) => richness(b) - richness(a))[0]
}

/** "Surprise me" for one axis: the axis with the most to see that isn't in the walk already. */
export function surpriseAxis(
	center: Scores,
	neighbors: Scores[],
	traits: RingOption[],
	taken: Axis[],
	only?: Axis[],
): Axis | undefined {
	const all = only ?? [
		...FIXED,
		...traits
			.map((trait) => axisOf(trait.id))
			.filter((axis): axis is Axis => Boolean(axis)),
	]
	return rankAxes(
		center,
		neighbors,
		all.filter((axis) => !taken.some((other) => other.id === axis.id)),
		taken,
	)[0]?.axis
}
