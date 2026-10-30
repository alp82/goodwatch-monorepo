import { readProfileCatalog } from "~/server/profile/catalog.server"
import { resolveTropeReferences } from "~/server/profile/trope-catalog.server"
import { tropeTarget } from "~/server/profile/trope-uri-pool"
import { htmlToText } from "~/server/profile/trope-text"
import { trimExample } from "~/server/profile/tropes-model"
import { loadTropeRecommendations } from "./index.server"

/** Only titles returned by a recommendation mode for this member may expose examples. */
export async function loadRecommendationExcerpts(
	userId: string,
	trope: string,
	keys: string[],
) {
	const lists = await Promise.all(
		(["all", "movie", "show"] as const).flatMap((kind) => [
			loadTropeRecommendations(userId, kind),
			loadTropeRecommendations(userId, kind, trope),
		]),
	)
	if (lists.some((r) => r.pending)) return { pending: true, examples: [] }
	const allowed = new Set<string>(
		lists.flatMap((r) => r.titles.map((t) => t.id)),
	)
	const visible = [...new Set(keys)].filter((k) => allowed.has(k))
	const examples: { key: string; text: string; label: string }[] = []
	for (const kind of ["movie", "show"] as const) {
		const ids = visible
			.filter((k) => k.startsWith(`${kind}-`))
			.map((k) => Number(k.split("-")[1]))
		if (!ids.length) continue
		const rows: {
			media_tmdb_id: number
			name: string
			url: string | null
			content: string | null
		}[] = []
		for (let offset = 0; ; offset += 1000) {
			const page = await readProfileCatalog<(typeof rows)[number]>(
				`SELECT media_tmdb_id, name, url, content FROM trope
    WHERE media_type = ? AND media_tmdb_id IN (${ids.map(() => "?").join(",")})
    ORDER BY media_tmdb_id, name, url LIMIT 1000 OFFSET ${offset}`,
				[kind, ...ids],
			)
			rows.push(...page)
			if (page.length < 1000) break
		}
		const resolved = await resolveTropeReferences([
			...new Set(rows.flatMap((r) => r.url ?? [])),
		])
		const byKey = new Map<
			string,
			{ key: string; text: string; label: string }
		>()
		for (const row of rows) {
			if (tropeTarget(row.name, row.url, resolved) !== trope) continue
			const text = trimExample(htmlToText(row.content ?? ""))
			const key = `${kind}-${row.media_tmdb_id}`
			if (text && text.length > (byKey.get(key)?.text.length ?? 0))
				byKey.set(key, { key, text, label: row.name })
		}
		examples.push(...byKey.values())
	}
	return { pending: false, examples }
}
