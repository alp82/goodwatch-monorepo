import { FAMILY_ORDER, type FamilyId } from "./contract"
import { type Levels, type Recipe, leadOf, nearDup, steps } from "./shape"
export const DRAWER_SIZE = 12

export const DESK_SIZE = 10
const OWN_FIRST = 3
const MAX_LEAD = 3

export type RecipeInfo = {
	count: Record<string, number>
	like: Record<string, number>
}

const l2 = (a: Levels, b: Levels) =>
	Math.sqrt(FAMILY_ORDER.reduce((s, f) => s + (a[f] - b[f]) ** 2, 0))

const fits = (m: Recipe, chosen: Recipe[]) => !chosen.some((c) => nearDup(c, m))

export function drawerOrder(
	lib: Recipe[],
	levels: Levels,
	picked: Recipe | undefined,
	info: RecipeInfo,
	size = DRAWER_SIZE,
): string[] {
	const near = (m: Recipe) =>
		steps(levels, m.shape) * 10 +
		l2(levels, m.shape) * 0.5 -
		(info.like[m.id] ?? 0) * 2
	const byNear = (a: Recipe, b: Recipe) =>
		near(a) - near(b) || (info.count[b.id] ?? 0) - (info.count[a.id] ?? 0)
	const own: Recipe[] = []
	for (const m of lib.filter((x) => x.yours).sort(byNear)) {
		if (own.length >= OWN_FIRST) break

		if (m === picked || fits(m, own)) own.push(m)
	}
	if (picked?.yours && !own.includes(picked)) own.unshift(picked)
	const chosen: Recipe[] = [...own]
	const rest = lib.filter((m) => !m.yours).sort(byNear)
	if (picked && !picked.yours) chosen.push(picked)
	const leads: Partial<Record<FamilyId, number>> = {}
	for (const m of chosen) {
		const f = leadOf(m)
		if (f) leads[f] = (leads[f] ?? 0) + 1
	}
	for (const pass of [0, 1])
		for (const m of rest) {
			if (chosen.length >= size) break
			if (chosen.includes(m) || !fits(m, chosen)) continue
			const f = leadOf(m)
			if (pass === 0 && f && (leads[f] ?? 0) >= MAX_LEAD) continue
			chosen.push(m)
			if (f) leads[f] = (leads[f] ?? 0) + 1
		}

	const lib2 = chosen.filter((m) => !own.includes(m)).sort(byNear)
	return [...own, ...lib2].slice(0, size).map((m) => m.id)
}

export function pinned(
	ids: string[],
	pin: { id: string; index: number } | null,
	size = DESK_SIZE,
): string[] {
	if (!pin || pin.index < 0) return ids
	const rest = ids.filter((x) => x !== pin.id)
	if (rest.length >= size) rest.length = size - 1
	rest.splice(Math.min(pin.index, rest.length), 0, pin.id)
	return rest
}
