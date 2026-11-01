import { groupProviderChoices } from "../../utils/streaming-links.ts"

export interface ProviderCatalogRow {
	tmdb_id: number
	name: string
	logo_path: string | null
	order_by_country: Record<string, number> | null
	order_default: number | null
}

/** Country presence comes from the catalog, not a global default or a brand alias abroad.
 * Rank is the source's country popularity order (lower first). Keep aliases for availability.
 */
export function providerCatalog(
	rows: ProviderCatalogRow[],
	country: string | null
) {
	if (!country || !/^[A-Z]{2}$/.test(country))
		return { services: [], providerGroups: [] }
	const byId = new Map<number, ProviderCatalogRow>()
	for (const row of rows) {
		const rank = row.order_by_country?.[country]
		if (typeof rank !== "number" || !Number.isFinite(rank)) continue
		const old = byId.get(row.tmdb_id)
		if (!old || rank < old.order_by_country![country])
			byId.set(row.tmdb_id, row)
	}
	const services = [...byId.values()]
		.sort(
			(a, b) =>
				a.order_by_country![country] - b.order_by_country![country] ||
				(a.order_default ?? Infinity) - (b.order_default ?? Infinity) ||
				a.name.trim().localeCompare(b.name.trim()) ||
				a.tmdb_id - b.tmdb_id
		)
		.map((row) => ({
			id: row.tmdb_id,
			name: row.name.trim(),
			logoUrl: row.logo_path
				? `https://image.tmdb.org/t/p/w92${row.logo_path}`
				: null
		}))
	const major = [
		/^netflix$/i,
		/^prime video$/i,
		/^disney\+$/i,
		/^hbo max$|^max$/i,
		/^apple tv\+?$/i,
		/^paramount\+/i,
		/^hulu$/i,
		/^peacock/i,
		/^(sky go|wow|now)$/i,
		/^crunchyroll$/i
	]
	const extra = (name: string) =>
		/amazon channel|apple tv channel|roku premium channel|plex channel|\bstore\b|google play|microsoft|rakuten tv|videobuster|fandango at home|justwatch tv|^amazon video$|vudu|chili|with ads|\bfree\b|kids/i.test(
			name
		)
	const clean = (name: string) =>
		name
			.trim()
			.replace(/^Amazon Prime Video$/i, "Prime Video")
			.replace(/ Plus\b/g, "+")
	const byService = new Map(services.map((s) => [s.id, s]))
	const seen = new Set<number>()
	const providerGroups = groupProviderChoices(services)
		.map((g, i) => {
			const main = g.selectionIds
				.map((id) => byService.get(id)!)
				.filter((s) => s && !extra(s.name))
				.sort((a, b) => a.name.length - b.name.length)[0]
			const name = clean(main?.name ?? g.name)
			let rank = major.findIndex((re) => re.test(name))
			if (main && rank >= 0) {
				if (seen.has(rank)) rank = -1
				else seen.add(rank)
			}
			return {
				...g,
				name,
				logoUrl: main?.logoUrl ?? g.logoUrl,
				minor: !main,
				score: !main ? 1000 + i : rank >= 0 ? rank : 100 + i
			}
		})
		.sort((a, b) => a.score - b.score)
		.map(({ score: _, ...g }) => g)
	return { services, providerGroups }
}
