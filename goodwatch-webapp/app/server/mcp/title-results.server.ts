import { canonicalTitleId } from "../../utils/title-identity.ts"
import { titleKey } from "../../utils/title-key.ts"

/** Presentation only: never store derived member scores in catalog caches or durable write receipts. */
export async function enrichTitleResults(
	userId: string,
	data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const ids = new Map<string, number>()
	const visit = (value: unknown) => {
		if (!value || typeof value !== "object") return
		const row = value as Record<string, unknown>
		if (typeof row.id === "string" && /^(movie|show):[1-9]\d*$/.test(row.id)) {
			const [kind, raw] = row.id.split(":")
			const type = kind === "show" ? "show" : "movie"
			ids.set(row.id, titleKey(type, canonicalTitleId(type, Number(raw))))
		}
		for (const child of Object.values(row)) visit(child)
	}
	visit(data)
	if (!ids.size) return data
	const [{ loadTaste }, { getDisplayFields }] = await Promise.all([
		import("../taste/index.server"),
		import("../title-cards.server"),
	])
	const keys = [...new Set(ids.values())]
	// Derived presentation must not hide an already committed write when a metadata read fails.
	const [taste, batches] = await Promise.all([
		loadTaste({ kind: "member", userId }).catch(() => null),
		Promise.allSettled(
			Array.from({ length: Math.ceil(keys.length / 60) }, (_, i) =>
				getDisplayFields(keys.slice(i * 60, (i + 1) * 60)),
			),
		),
	])
	const displays = new Map<number, { runtime: number | null }>()
	for (const batch of batches)
		if (batch.status === "fulfilled")
			for (const [key, value] of batch.value) displays.set(key, value)
	const matches = taste?.match(keys) ?? keys.map(() => null)
	const byKey = new Map(keys.map((key, i) => [key, matches[i]]))
	const map = (value: unknown): unknown => {
		if (!value || typeof value !== "object") return value
		if (Array.isArray(value)) return value.map(map)
		const row = value as Record<string, unknown>
		const next = Object.fromEntries(
			Object.entries(row).map(([key, child]) => [key, map(child)]),
		)
		const key = typeof row.id === "string" ? ids.get(row.id) : undefined
		if (key === undefined) return next
		const match = byKey.get(key) ?? null
		return {
			...next,
			runtime_minutes:
				displays.get(key)?.runtime ?? row.runtime_minutes ?? null,
			match,
			match_label: match === null ? null : `${match}% taste match`,
		}
	}
	return {
		...(map(data) as Record<string, unknown>),
		taste: { signal: taste?.signal ?? "unavailable", liked: taste?.liked ?? 0 },
	}
}
