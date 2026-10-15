import { z } from "zod"
import type { AnimeEntry, AnimeMapping } from "../../domain/anime-mapping.ts"
import { select } from "./store.server.ts"

const integer = z.number().int().safe()
const id = integer.positive()
const snapshotSchema = z.object({
	schemaVersion: z.literal(1),
	entries: z
		.array(
			z.object({
				anidbId: id,
				showId: id,
				season: z.union([integer.nonnegative(), z.literal("a")]).nullable(),
				offset: integer,
				ranges: z.array(
					z.object({
						start: id,
						end: id,
						season: integer.nonnegative(),
						offset: integer,
					}),
				),
				ids: z.object({
					myanimelist: z.array(id),
					anilist: z.array(id),
					kitsu: z.array(id),
				}),
				unsupportedReason: z.string().optional(),
			}),
		)
		.max(100_000),
})

/** Anime-Lists placement + Fribb identities; one atomic snapshot, pinned per preview. */
export function createCatalogAnimeLookup() {
	let pending: Promise<Map<string, AnimeMapping[]>> | undefined
	async function load() {
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
			Date.now() - new Date(rows[0].refreshed_at).getTime() > 21 * 86400_000
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
