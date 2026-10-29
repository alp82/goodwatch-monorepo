// The fingerprint section's selection and what it lights on the drawing.
//
// - The selection: up to three effect ids. A row toggles its effect; an area of the drawing toggles its leading effect
//   (or takes out the selected effects on that axis). A fourth effect pushes the oldest out.
// - It starts on the title's rarest pair (GET /api/fingerprint/pairs) with at most one end outside the rows: that end
//   takes the slot under them while it's selected.
// - Lighting a selection lights every selected axis and the ingredients of every selected effect; the rim names only
//   what says something (the must-haves and what adds at 7+), at most nine, so three effects never crowd the ring.
// - A dial lights the sub-scores it's read from, each named at the rim; no axis lights.
import type {
	EffectReading,
	PartReading,
} from "~/domain/fingerprint-effects/effects"
import type { CoreScores } from "~/server/utils/fingerprint"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import {
	AXES,
	type Key,
	type Reading,
	type ScaleReading,
	axisOf,
	familyOf,
	keyLabel,
} from "./reading"

export const MAX_SELECTED = 3

export type Role = "need" | "adds" | "brake"

export interface Ingredient {
	p: PartReading
	role: Role
	value: number
}

/**
 * The effect's recipe: every must-have, everything that adds, and the brakes that bit (a brake only takes something
 * off above 4). Needs first, then adds, then brakes; strongest first.
 */
export function recipe(r: EffectReading): Ingredient[] {
	const roleOf = (p: PartReading): Role =>
		p.part.w < 0 ? "brake" : p.part.need ? "need" : "adds"
	const order: Record<Role, number> = { need: 0, adds: 1, brake: 2 }
	return r.parts
		.filter((p) => p.part.w > 0 || p.value > 4)
		.map((p) => ({ p, role: roleOf(p), value: p.value }))
		.sort((a, b) => order[a.role] - order[b.role] || b.value - a.value)
}

/** One sub-score lit on the print: its ridges glow, and when `named` it's named at its rim position. */
export interface LitKey {
	key: Key
	role: Role
	label: string
	score: number
	color: string
	named: boolean
}

/** A part's print keys: a group part ("dry humor") lights the two members that made its value. */
const partKeys = (p: PartReading) =>
	p.members.slice(0, p.members.length > 1 ? 2 : 1)

/** The recipe as print keys. */
export function litKeys(r: EffectReading): Omit<LitKey, "named">[] {
	const out: Omit<LitKey, "named">[] = []
	for (const ing of recipe(r))
		for (const m of partKeys(ing.p))
			if (!out.some((k) => k.key === m.key))
				out.push({
					key: m.key,
					role: ing.role,
					label: keyLabel(m.key),
					score: m.score,
					color: FAMILY_COLOR[familyOf(m.key)],
				})
	return out
}

export interface Light {
	/** Axes lit on the shape. */
	axes: Set<string>
	/** Print keys lit (and named at the rim when they say something). */
	keys: LitKey[]
	/** Changes whenever the lit set does: the lit layers re-mount and fade in. */
	id: string
}

export type Target =
	| { kind: "effect"; id: string }
	| { kind: "axis"; id: string }
export const keyOf = (t: Target) => `${t.kind}:${t.id}`

export const byId = (reading: Reading, id: string) =>
	reading.all.find((r) => r.effect.id === id) ?? null

/** The selection a click on `target` makes. */
export function nextSelection(
	selected: readonly string[],
	target: Target,
	reading: Reading,
): string[] {
	if (target.kind === "effect") {
		if (selected.includes(target.id))
			return selected.filter((x) => x !== target.id)
		return [...selected, target.id].slice(-MAX_SELECTED)
	}
	const axis = AXES.find((a) => a.id === target.id)
	if (!axis) return [...selected]
	const inside = selected.filter((x) => axis.members.includes(x))
	if (inside.length) return selected.filter((x) => !inside.includes(x))
	const lead = reading.axes.find((a) => a.axis.id === target.id)?.lead
	return lead
		? [...selected, lead.effect.id].slice(-MAX_SELECTED)
		: [...selected]
}

/**
 * The starting selection: the rarest pair with at most one end outside the rows (else the rarest pair), else the
 * first row. Pairs whose effects the title doesn't have are skipped.
 */
export function startSelection(
	pairs: readonly { a: string; b: string }[] | null,
	reading: Reading,
): string[] {
	const isRow = (id: string) => reading.rows.some((p) => p.r.effect.id === id)
	const known = (pairs ?? []).filter(
		(p) => byId(reading, p.a) && byId(reading, p.b),
	)
	const pair = known.find((p) => isRow(p.a) || isRow(p.b)) ?? known[0]
	if (pair) return [pair.a, pair.b]
	return reading.rows.slice(0, 1).map((p) => p.r.effect.id)
}

/** What the drawing lights for a selection: its axes, and its ingredients. */
export function lightOf(
	selected: readonly string[],
	reading: Reading,
): Light | null {
	const effects = selected
		.map((id) => byId(reading, id))
		.filter((r): r is EffectReading => !!r)
	if (!effects.length) return null
	const axes = new Set<string>()
	const keys: LitKey[] = []
	for (const r of effects) {
		const ax = axisOf(r.effect.id)
		if (ax) axes.add(ax)
		const says = new Set(
			recipe(r)
				.filter((x) => x.role === "need" || (x.role === "adds" && x.value >= 7))
				.flatMap((x) => partKeys(x.p).map((m) => m.key)),
		)
		for (const k of litKeys(r))
			if (!keys.some((x) => x.key === k.key))
				keys.push({ ...k, named: says.has(k.key) })
	}
	// One effect names all it says; a selection of more names at most nine, needs first.
	let named = 0
	for (const k of [...keys].sort(
		(a, b) =>
			(a.role === "need" ? 0 : 1) - (b.role === "need" ? 0 : 1) ||
			b.score - a.score,
	))
		if (k.named) k.named = ++named <= (effects.length === 1 ? 12 : 9)
	return { axes, keys, id: selected.join("+") }
}

/**
 * What a dial lights: the sub-scores it's read from, each named with its score. A two-ended dial lights both ends,
 * the low end dashed as a brake; an area dial lights what scores 6+ fully and the rest softer.
 */
export function dialLight(s: ScaleReading, scores: CoreScores): Light {
	const src = s.source
	const lit: { key: Key; role: Role }[] =
		src.kind === "balance"
			? [
					...src.high.map((key) => ({ key, role: "need" as const })),
					...src.low.map((key) => ({ key, role: "brake" as const })),
				]
			: src.kind === "area"
				? src.keys.map((key) => ({
						key,
						role: scores[key] >= 6 ? ("need" as const) : ("adds" as const),
					}))
				: src.keys.map((key) => ({ key, role: "need" as const }))
	return {
		axes: new Set(),
		keys: lit.map(({ key, role }) => ({
			key,
			role,
			label: keyLabel(key),
			score: scores[key],
			color: FAMILY_COLOR[familyOf(key)],
			named: true,
		})),
		id: `dial-${s.sc.name}`,
	}
}
