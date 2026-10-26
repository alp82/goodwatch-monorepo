import { type TropePageReferences, mainTropeUrl } from "./trope-pages.ts"
import {
	type TropeLength,
	type TropePool,
	type TropeTitle,
	buildTropePool,
	defining,
	leastTitles,
} from "./tropes-model.ts"

/** Shared by pool construction and excerpt authorization. Invalid/non-Main routes keep their label identity. */
export function tropeTarget(
	name: string,
	url: string | null,
	resolved: TropePageReferences = {},
) {
	const reference = mainTropeUrl(url)
	return reference
		? (mainTropeUrl(resolved[reference]?.url) ?? reference)
		: `label:${JSON.stringify([name, url ?? ""])}`
}

/** Group associations before applying the title-count threshold. A title contributes once to each target. */
export function buildUriTropePool(
	titles: TropeTitle[],
	associations: TropeLength[],
	resolved: TropePageReferences,
): TropePool {
	const byTitle = new Map(
		titles.map((t) => [
			t.title.key,
			new Map<
				string,
				{ length: number; labels: Set<string>; references: Set<string> }
			>(),
		]),
	)
	const names: Record<string, string> = {}
	const labels = new Map<string, Set<string>>()
	const references = new Map<string, Set<string>>()
	function add(
		key: string,
		name: string,
		url: string | null,
		length: number | null,
	) {
		const entries = byTitle.get(key)
		if (!entries || !name) return
		const id = tropeTarget(name, url, resolved)
		const entry = entries.get(id) ?? {
			length: 0,
			labels: new Set<string>(),
			references: new Set<string>(),
		}
		entry.length = Math.max(entry.length, Number(length) || 0)
		entry.labels.add(name)
		if (url) entry.references.add(url)
		entries.set(id, entry)
		const allLabels = labels.get(id) ?? new Set<string>()
		allLabels.add(name)
		labels.set(id, allLabels)
		const allReferences = references.get(id) ?? new Set<string>()
		if (url) allReferences.add(url)
		references.set(id, allReferences)
		const reference = mainTropeUrl(url)
		const title = reference ? resolved[reference]?.title : null
		if (title) names[id] = title
	}
	for (const row of associations) add(row.key, row.name, row.url, row.length)
	// A stale title aggregate may contain a name for which no source row remains. Keep it honestly unresolved.
	for (const t of titles) {
		const found = new Set(
			[...(byTitle.get(t.title.key)?.values() ?? [])].flatMap((e) => [
				...e.labels,
			]),
		)
		for (const name of t.names)
			if (!found.has(name)) add(t.title.key, name, null, 0)
	}
	const counts = new Map<string, number>()
	for (const entries of byTitle.values())
		for (const id of entries.keys()) counts.set(id, (counts.get(id) ?? 0) + 1)
	const kept = [...counts.keys()]
		.filter((id) => (counts.get(id) ?? 0) >= leastTitles(titles.length))
		.sort()
	const index = new Map(kept.map((id, i) => [id, i]))
	const base = buildTropePool(
		titles.map((t) => ({ ...t, names: [] })),
		[],
		{},
	)
	const pool = base.pool.map((t) => {
		const entries = byTitle.get(t.k) ?? new Map()
		const selected = [...entries]
			.filter(([id]) => index.has(id))
			.sort(([a], [b]) => a.localeCompare(b))
		return {
			...t,
			r: selected.map(([id]) => index.get(id) ?? 0),
			d: selected.map(([, entry]) =>
				Math.round(defining(entry.length, entries.size) * 100),
			),
		}
	})
	return {
		...base,
		schema: 2,
		tropes: kept,
		pool,
		names: Object.fromEntries(
			kept.map((id) => [
				id,
				names[id] ?? [...(labels.get(id) ?? new Set<string>())].sort()[0],
			]),
		),
		labels: Object.fromEntries(
			kept.map((id) => [id, [...(labels.get(id) ?? new Set<string>())].sort()]),
		),
		references: Object.fromEntries(
			kept.map((id) => [
				id,
				[...(references.get(id) ?? new Set<string>())].sort(),
			]),
		),
		urls: Object.fromEntries(kept.map((id) => [id, mainTropeUrl(id) ?? ""])),
		descriptions: {},
	}
}
