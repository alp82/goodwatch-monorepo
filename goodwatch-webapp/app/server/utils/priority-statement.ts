import { canonicalTitleId } from "../../utils/title-identity.ts"

export interface PriorityImpression {
	media_type: "movie" | "show"
	tmdb_id: number
	source_kind?: "poster" | "opened"
}

/** Fold aliases and sources before upsert: at most one VALUES entry per primary key. */
export function priorityStatement(items: PriorityImpression[], amount = 1) {
	if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid priority increment")
	const unique = new Map<string, PriorityImpression>()
	for (const item of items) {
		if (!["movie", "show"].includes(item.media_type) || !Number.isSafeInteger(item.tmdb_id) || item.tmdb_id <= 0 || item.tmdb_id > 2_147_483_647 || (item.source_kind !== undefined && !["poster", "opened"].includes(item.source_kind))) throw new Error("Invalid priority item")
		const canonical = { ...item, tmdb_id: canonicalTitleId(item.media_type, item.tmdb_id) }
		unique.set(`${canonical.source_kind ?? "poster"}:${canonical.media_type}:${canonical.tmdb_id}`, canonical)
	}
	const titles = new Map<string, { item: PriorityImpression; demand: number; opened: boolean }>()
	for (const item of unique.values()) {
		const key = `${item.media_type}:${item.tmdb_id}`
		const row = titles.get(key) ?? { item, demand: 0, opened: false }
		row.demand += amount
		row.opened ||= item.source_kind === "opened"
		titles.set(key, row)
	}
	if (!titles.size) return null
	return {
		sql: `INSERT INTO crawl_priority
		(media_type, tmdb_id, demand, acknowledged_demand, claimed_demand, created_at, updated_at, last_opened_at)
		VALUES ${[...titles.values()].map(row => `    (?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${row.opened ? "CURRENT_TIMESTAMP" : "NULL"})`).join(", ")}
		ON CONFLICT (media_type, tmdb_id) DO UPDATE SET
			demand = demand + excluded.demand,
			updated_at = CURRENT_TIMESTAMP,
			last_opened_at = CASE WHEN excluded.last_opened_at IS NULL THEN last_opened_at
				ELSE GREATEST(COALESCE(last_opened_at, excluded.last_opened_at), excluded.last_opened_at) END`,
		args: [...titles.values()].flatMap(({ item, demand }) => [item.media_type, item.tmdb_id, demand]),
	}
}
