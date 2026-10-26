import type { TropeDescriptions } from "../server/profile/trope-catalog-data.ts"
import type { RankedTrope } from "../ui/profile/tropes/model.ts"

export const MAX_DESCRIPTION_IDS = 60
export interface ProfileTropeDescriptions {
	entries: TropeDescriptions
	catalogVersion: string
	pending: boolean
}

/** Bounded IDs, never source URLs supplied directly to a public catalog query. */
export function descriptionIds(input: unknown): string[] | null {
	if (
		!Array.isArray(input) ||
		input.length > MAX_DESCRIPTION_IDS ||
		input.some(
			(id) =>
				typeof id !== "string" ||
				!id ||
				id.length > 4096 ||
				[...id].some((char) => char.charCodeAt(0) < 32),
		)
	)
		return null
	return [...new Set(input)]
}

export function descriptionBatches(ids: string[]): string[][] {
	const unique = [...new Set(ids)]
	const batches: string[][] = []
	for (let i = 0; i < unique.length; i += MAX_DESCRIPTION_IDS)
		batches.push(unique.slice(i, i + MAX_DESCRIPTION_IDS))
	return batches
}

/** The initial ranked bands already contain the SSR text; keep it during matrix arrival and revalidation. */
export function previewDescriptions(ranked: RankedTrope[]): TropeDescriptions {
	return Object.fromEntries(
		ranked.map((tag) => [
			tag.id ?? tag.name,
			{ url: tag.url, title: tag.name, text: tag.description },
		]),
	)
}

export function describeTrope(
	tag: RankedTrope,
	entries: TropeDescriptions,
): RankedTrope {
	const entry = entries[tag.id ?? tag.name]
	return entry
		? {
				...tag,
				name: entry.title || tag.name,
				url: entry.url || tag.url,
				description: entry.text,
			}
		: tag
}

/** SSR remains the fallback while a batch is pending or fails; successful null rows deliberately clear old text. */
export function mergeDescriptionEntries(
	seed: TropeDescriptions,
	batches: (TropeDescriptions | undefined)[],
	current: TropeDescriptions,
): TropeDescriptions {
	return Object.assign({}, seed, ...batches.filter(Boolean), current)
}
