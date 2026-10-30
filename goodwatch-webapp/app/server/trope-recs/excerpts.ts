import type { CatalogRead } from "../profile/tropes-data.ts"
import {
	mainTropeUrl,
	tropePageUrl,
	type TropePageReferences,
} from "../profile/trope-pages.ts"
import { tropeTarget } from "../profile/trope-uri-pool.ts"
import { htmlToText } from "../profile/trope-text.ts"
import { trimExample } from "../profile/tropes-model.ts"
import type { CandidateIndex } from "./ranking.ts"

/** Authorize against the full shared index, including titles outside every ranked page. */
export function excerptKeys(
	index: CandidateIndex,
	excluded: ReadonlySet<string>,
	trope: string,
	keys: string[],
) {
	const i = index.tropes.indexOf(trope)
	const requested = new Set(keys)
	return index.titles
		.filter(
			(t) =>
				requested.has(t.id) &&
				!excluded.has(t.id) &&
				t.tropes.some((h) => h.i === i),
		)
		.map((t) => t.id)
}

export async function readRecommendationExcerpts(
	read: CatalogRead,
	index: CandidateIndex,
	trope: string,
	visible: string[],
) {
	const i = index.tropes.indexOf(trope)
	if (i < 0 || !visible.length) return []
	const sources = index.references[i]
	// Reconstruct the published identity, preserving contextual labels for unapproved routes.
	const identities: TropePageReferences = Object.fromEntries(
		sources.flatMap((url) => {
			const reference = tropePageUrl(url)
			return reference &&
				tropePageUrl(trope) &&
				(mainTropeUrl(reference) || reference === trope)
				? [[reference, { url: trope, title: null }]]
				: []
		}),
	)
	// Only a null-URL unresolved identity can use the full-text name fallback.
	let fallback: string | undefined
	if (trope.startsWith("label:")) {
		const identity: unknown = JSON.parse(trope.slice(6))
		if (
			Array.isArray(identity) &&
			typeof identity[0] === "string" &&
			identity[1] === ""
		)
			fallback = identity[0]
	}
	const routes: (string[] | null)[] = []
	for (let start = 0; start < sources.length; start += 400)
		routes.push(sources.slice(start, start + 400))
	if (fallback !== undefined) routes.push(null)
	const examples = new Map<
		string,
		{ key: string; text: string; label: string }
	>()
	const allowed = new Set(visible)
	for (const kind of ["movie", "show"] as const) {
		const ids = visible
			.filter((k) => k.startsWith(`${kind}-`))
			.map((k) => Number(k.split("-")[1]))
		if (!ids.length) continue
		for (const batch of routes)
			for (let offset = 0; ; offset += 1000) {
				const rows = await read<{
					media_tmdb_id: number
					name: string
					url: string | null
					content: string | null
				}>(
					`SELECT media_tmdb_id, name, url, content FROM trope
    WHERE media_type = ? AND media_tmdb_id IN (${ids.map(() => "?").join(",")})
    AND ${batch ? `url IN (${batch.map(() => "?").join(",")})` : "url IS NULL AND match(name, ?)"}
    ORDER BY media_tmdb_id, name, url LIMIT 1000 OFFSET ${offset}`,
					[kind, ...ids, ...(batch ?? [fallback!])],
				)
				for (const row of rows) {
					const key = `${kind}-${row.media_tmdb_id}`
					if (
						!allowed.has(key) ||
						tropeTarget(row.name, row.url, identities) !== trope ||
						(batch
							? !batch.includes(row.url ?? "")
							: row.url !== null || tropeTarget(row.name, null) !== trope)
					)
						continue
					const text = trimExample(htmlToText(row.content ?? ""))
					if (text && text.length > (examples.get(key)?.text.length ?? 0))
						examples.set(key, { key, text, label: row.name })
				}
				if (rows.length < 1000) break
			}
	}
	return [...examples.values()]
}
