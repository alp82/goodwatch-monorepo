import { z } from "zod"
import {
	type AnimeEntry,
	type AnimeMapping,
	animeMappingSchema,
} from "../../domain/anime-mapping.ts"

const SNAPSHOT_MAX_AGE_MS = 21 * 86400_000
const snapshotSchema = z.object({
	schemaVersion: z.literal(1),
	entries: z.array(animeMappingSchema).max(100_000),
})
export type AnimeMappings = (entry: AnimeEntry) => Promise<AnimeMapping[]>

/** The same identity and parent rule is used by title matching and episode placement. */
export async function resolveAnimeParent(
	entry: AnimeEntry,
	animeMappings: AnimeMappings,
	showId?: number,
): Promise<
	| { status: "matched"; mapping: AnimeMapping }
	| { status: "unmatched"; reason: string }
> {
	try {
		const mappings = await animeMappings(entry)
		if (
			mappings.length !== 1 ||
			(showId != null && mappings[0].showId !== showId)
		)
			return {
				status: "unmatched",
				reason: "This anime entry is not mapped uniquely to this TMDB show.",
			}
		return { status: "matched", mapping: mappings[0] }
	} catch {
		return {
			status: "unmatched",
			reason: "Anime mappings are unavailable; retry this import later.",
		}
	}
}

/** Anime-Lists placement + Fribb identities; one atomic snapshot, pinned per preview. */
export function createCatalogAnimeLookup() {
	let pending: Promise<Map<string, AnimeMapping[]>> | undefined
	async function load() {
		const { select } = await import("./store.server.ts")
		const rows = await select<{
			payload: string
			refreshed_at: string | number | Date
		}>(
			"SELECT payload, refreshed_at FROM anime_mapping_snapshot WHERE id = ?",
			["current"],
		)
		if (
			rows.length !== 1 ||
			!Number.isFinite(new Date(rows[0].refreshed_at).getTime()) ||
			Date.now() - new Date(rows[0].refreshed_at).getTime() >
				SNAPSHOT_MAX_AGE_MS
		)
			throw new Error(
				"Anime mapping snapshot missing or older than three weeks",
			)
		const { entries } = snapshotSchema.parse(JSON.parse(rows[0].payload))
		const index = new Map<string, AnimeMapping[]>()
		for (const mapping of entries) {
			const identities = { anidb: [mapping.anidbId], ...mapping.ids }
			for (const [source, ids] of Object.entries(identities))
				for (const id of new Set(ids)) {
					const key = `${source}:${id}`
					index.set(key, [...(index.get(key) ?? []), mapping])
				}
		}
		return index
	}
	return async (entry: AnimeEntry): Promise<AnimeMapping[]> => {
		pending ??= load()
		return (await pending).get(`${entry.source}:${entry.id}`) ?? []
	}
}
