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
export function providerCatalog(rows: ProviderCatalogRow[], country: string | null) {
	if (!country || !/^[A-Z]{2}$/.test(country)) return { services: [], providerGroups: [] }
	const byId = new Map<number, ProviderCatalogRow>()
	for (const row of rows) {
		const rank = row.order_by_country?.[country]
		if (typeof rank !== "number" || !Number.isFinite(rank)) continue
		const old = byId.get(row.tmdb_id)
		if (!old || rank < old.order_by_country![country]) byId.set(row.tmdb_id, row)
	}
	const services = [...byId.values()]
		.sort((a, b) => a.order_by_country![country] - b.order_by_country![country]
			|| (a.order_default ?? Infinity) - (b.order_default ?? Infinity)
			|| a.name.trim().localeCompare(b.name.trim()) || a.tmdb_id - b.tmdb_id)
		.map(row => ({ id: row.tmdb_id, name: row.name.trim(),
			logoUrl: row.logo_path ? `https://image.tmdb.org/t/p/w92${row.logo_path}` : null }))
	return { services, providerGroups: groupProviderChoices(services) }
}
