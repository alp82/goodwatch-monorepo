import type { TropeDescriptions } from "./trope-catalog-data.ts"
import type { CatalogRead } from "./tropes-data.ts"

/** Same conservative Main-route normalization as the catalog importer; never guess a slug. */
export function mainTropeUrl(input: string | null | undefined): string | null {
	// Historical title imports prepended this exact origin to an already absolute link.
	// Repair only the evidenced two-origin form, then apply every ordinary route check below.
	const duplicated = "https://tvtropes.orghttps://tvtropes.org/"
	if (input?.startsWith(duplicated))
		input = input.slice("https://tvtropes.org".length)
	if (
		!input ||
		!/^https?:\/\/(?:www\.)?tvtropes\.org\/pmwiki\/pmwiki\.php\/Main\/[A-Za-z0-9_]+$/i.test(
			input,
		)
	)
		return null
	const url = new URL(input)
	if (!/^\/pmwiki\/pmwiki\.php\/Main\/[A-Za-z0-9_]+$/.test(url.pathname))
		return null
	return `https://tvtropes.org${url.pathname}`
}

export interface TropePageReference {
	url: string
	title: string | null
}
export type TropePageReferences = Record<string, TropePageReference>

async function batched<T extends {}>(
	read: CatalogRead,
	table: string,
	columns: string,
	key: string,
	input: string[],
) {
	const keys = [...new Set(input)].sort()
	const rows: T[] = []
	let next = 0
	async function worker() {
		while (next < keys.length) {
			const batch = keys.slice(next, next + 400)
			next += batch.length
			rows.push(
				...(await read<T>(
					`SELECT ${columns} FROM ${table} WHERE ${key} IN (${batch.map(() => "?").join(",")}) LIMIT ${batch.length}`,
					batch,
				)),
			)
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(4, Math.ceil(keys.length / 400)) }, worker),
	)
	return rows
}

/** Background pool construction reads identities/titles only, never every article description. */
export function createTropeReferenceReader(read: CatalogRead) {
	return async (input: string[]): Promise<TropePageReferences> => {
		const urls = [...new Set(input.flatMap((url) => mainTropeUrl(url) ?? []))]
		const allowed = new Set(urls)
		const references = await batched<{
			reference_url: string
			canonical_url: string
		}>(
			read,
			"trope_catalog_reference",
			"reference_url, canonical_url",
			"reference_url",
			urls,
		)
		const targets = new Map<string, string>()
		for (const row of references) {
			const target = mainTropeUrl(row.canonical_url)
			if (allowed.has(row.reference_url) && target)
				targets.set(row.reference_url, target)
		}
		const pages = await batched<{ url: string; title: string | null }>(
			read,
			"trope_catalog_page",
			"url, title",
			"url",
			[...urls, ...targets.values()],
		)
		const titles = new Map(
			pages
				.filter((p) => mainTropeUrl(p.url) === p.url)
				.map((p) => [p.url, p.title?.trim() || null]),
		)
		return Object.fromEntries(
			urls.flatMap((url) => {
				const target = targets.get(url) ?? url
				return targets.has(url) || titles.has(url)
					? [[url, { url: target, title: titles.get(target) ?? null }]]
					: []
			}),
		)
	}
}

/** Small request-time read: preview supplies only the first thirty target IDs. */
export function createTropePageReader(read: CatalogRead) {
	return async (input: string[]): Promise<TropeDescriptions> => {
		const urls = input.filter((url) => mainTropeUrl(url) === url)
		const allowed = new Set(urls)
		const rows = await batched<{
			url: string
			title: string | null
			description: string | null
		}>(read, "trope_catalog_page", "url, title, description", "url", urls)
		return Object.fromEntries(
			rows
				.filter((row) => allowed.has(row.url))
				.map((row) => [
					row.url,
					{
						url: row.url,
						title: row.title?.trim() || null,
						text: row.description?.trim() || null,
					},
				]),
		)
	}
}
