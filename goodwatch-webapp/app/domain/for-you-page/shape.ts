import type { MoodKey } from "~/domain/moods"
import { FAMILY_ORDER, type FamilyId, type ForYouTaste } from "./contract"
import type { Steer } from "./rank"
export type Bundle = Record<string, number>
export type Level = -1 | 0 | 1 | 2
export type Levels = Record<FamilyId, Level>

/** Attribute weights translate site mood, theme and style rules into steering. */
export interface Recipe {
	id: string
	name: string

	sub: string

	word: string
	attrs: Bundle
	shape: Levels

	lean?: MoodKey
	hue: string

	yours?: boolean

	tone?: string
}

export const LEVELS: Level[] = [-1, 0, 1, 2]

export const RING: Record<Level, number> = {
	[-1]: 0.76,
	0: 1,
	1: 1.22,
	2: 1.44,
}
export const RING_WORD: Record<Level, string> = {
	[-1]: "less",
	0: "usual",
	1: "more",
	2: "lots more",
}
export const MIN_SCALE = RING[-1]
export const MAX_SCALE = RING[2]

export const FLAT: Levels = { feel: 0, humor: 0, world: 0, story: 0, craft: 0 }

export const FAMILY_WORD: Record<FamilyId, string> = {
	feel: "Feel",
	humor: "Humor",
	world: "World",
	story: "Story",
	craft: "Craft",
}

export const shapeOf = (p: Partial<Levels>): Levels => ({ ...FLAT, ...p })
export const levelsKey = (l: Levels) => FAMILY_ORDER.map((f) => l[f]).join(",")
export const isFlat = (l: Levels) => FAMILY_ORDER.every((f) => l[f] === 0)

export function snapLevel(scale: number): Level {
	let best: Level = 0
	for (const l of LEVELS)
		if (Math.abs(RING[l] - scale) < Math.abs(RING[best] - scale)) best = l
	return best
}

export function steps(a: Levels, b: Levels): number {
	let s = 0
	for (const f of FAMILY_ORDER) s += Math.abs(a[f] - b[f])
	return s
}

/** Lowering a lead family counts twice toward leaving a recipe. */
export function drift(levels: Levels, shape: Levels): number {
	let s = 0
	for (const f of FAMILY_ORDER) {
		const d = levels[f] - shape[f]
		s += d < 0 && shape[f] === 2 ? -2 * d : Math.abs(d)
	}
	return s
}

export const TOLERANCE = 2
export const keeps = (levels: Levels, shape: Levels) =>
	drift(levels, shape) <= TOLERANCE

export function cosine(a: Bundle, b: Bundle): number {
	let dot = 0
	let na = 0
	let nb = 0
	for (const [k, w] of Object.entries(a)) {
		na += w * w
		if (b[k]) dot += w * b[k]
	}
	for (const w of Object.values(b)) nb += w * w
	return dot / (Math.sqrt(na * nb) || 1)
}

export const nearDup = (a: Recipe, b: Recipe) => {
	const c = cosine(a.attrs, b.attrs)
	return (steps(a.shape, b.shape) <= 1 && c > 0.3) || c > 0.7
}

export function leadOf(m: Recipe): FamilyId | null {
	let best: FamilyId | null = null
	for (const f of FAMILY_ORDER)
		if (m.shape[f] >= 1 && (!best || m.shape[f] > m.shape[best])) best = f
	return best
}

export type FamilyPush = { wide: Bundle; peak: Bundle }

const unit = (raw: (readonly [string, number])[]): Bundle => {
	const norm = Math.sqrt(raw.reduce((s, [, w]) => s + w * w, 0)) || 1
	return Object.fromEntries(raw.map(([k, w]) => [k, w / norm]))
}

export function familyPushes(taste: ForYouTaste): Record<FamilyId, FamilyPush> {
	const max = Math.max(...taste.attributes.map((a) => Math.abs(a.edge)), 0.01)
	const out = {} as Record<FamilyId, FamilyPush>
	for (const f of FAMILY_ORDER) {
		const inFam = taste.attributes
			.filter((a) => a.family === f)
			.sort((a, b) => b.edge - a.edge)
		let sought = inFam.filter((a) => a.edge > 0.15).slice(0, 5)
		if (sought.length < 3) sought = inFam.slice(0, 3)
		const raw = sought.map(
			(a) => [a.key, 0.45 + 0.55 * Math.max(0, a.edge / max)] as const,
		)
		const wide = inFam
			.filter((a) => a.edge > -0.1)
			.map((a) => [a.key, 1] as const)
		out[f] = { wide: unit(wide), peak: unit(raw.slice(0, 3)) }
	}
	return out
}

/** Push strength per handle step; the deeper ring emphasizes sought attributes. */
export const STEP = { alone: 1, mood: 1.8, deep: 4.5 }

function pushOf(l: Level, p: FamilyPush, a: number, deep: number): Bundle {
	const out: Bundle = {}
	if (l === 0) return out
	const sign = l < 0 ? -1 : 1
	for (const [k, w] of Object.entries(p.wide)) out[k] = sign * w * a
	if (l === 2)
		for (const [k, w] of Object.entries(p.peak))
			out[k] = (out[k] ?? 0) + w * deep
	return out
}

/** Apply handle changes relative to the selected recipe shape. */
export function attrsOf(
	recipe: Recipe | undefined,
	levels: Levels,
	keys: Record<FamilyId, FamilyPush>,
): Bundle {
	const out: Bundle = {}
	const shape = recipe?.shape ?? FLAT
	if (recipe) for (const [k, w] of Object.entries(recipe.attrs)) out[k] = w
	const a = recipe ? STEP.mood : STEP.alone
	for (const f of FAMILY_ORDER) {
		if (levels[f] === shape[f]) continue

		const now = pushOf(levels[f], keys[f], a, STEP.deep)
		const was = pushOf(shape[f], keys[f], a, STEP.deep)
		for (const [k, w] of Object.entries(now)) out[k] = (out[k] ?? 0) + w
		for (const [k, w] of Object.entries(was)) out[k] = (out[k] ?? 0) - w
	}
	for (const k of Object.keys(out)) {
		out[k] = Math.max(-3, Math.min(3, Math.round(out[k] * 100) / 100))
		if (Math.abs(out[k]) < 0.05) delete out[k]
	}
	return out
}

export function steerOf(
	recipe: Recipe | undefined,
	levels: Levels,
	keys: Record<FamilyId, FamilyPush>,
): Steer {
	return {
		attrs: attrsOf(recipe, levels, keys),
		recipeLean: recipe?.lean ? [recipe.lean] : [],
	}
}

const joinWords = (w: string[]) =>
	w.length > 1
		? `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`
		: (w[0] ?? "")

export function summaryOf(
	recipe: Recipe | undefined,
	levels: Levels,
): string | null {
	const shape = recipe?.shape ?? FLAT
	const changed = FAMILY_ORDER.filter((f) => levels[f] !== shape[f])

	const byWord = new Map<string, string[]>()
	for (const f of changed) {
		const up = levels[f] > shape[f]
		const word = !up ? "less" : levels[f] === 2 ? "lots more" : "more"
		byWord.set(word, [...(byWord.get(word) ?? []), FAMILY_WORD[f]])
	}
	const bits = [...byWord].map(([w, fs]) => `${w} ${joinWords(fs)}`)
	if (!recipe && !bits.length) return null
	if (!recipe) {
		const s = bits.join(", ")
		return `${s.charAt(0).toUpperCase()}${s.slice(1)} than usual`
	}
	return bits.length ? `${recipe.name}, with ${bits.join(", ")}` : recipe.name
}
