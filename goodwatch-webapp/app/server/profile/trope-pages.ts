import {
	type DescriptionReadOptions,
	type TropeDescriptions,
	describeRow,
} from "./trope-catalog-data.ts"
import type { CatalogRead } from "./tropes-data.ts"

const GENERAL_TROPE_NAMESPACES = new Set([
	"Main",
	"DuelingWorks",
	"Headscratchers",
	"Mohs",
	"MediaNotes",
	"Administrivia",
	"NamesToKnowInAnime",
	"ReferencedBy",
	"ShoutOut",
	"Analysis",
	"UsefulNotes",
	"HistoricalFiction",
])

/** Only observed, approved general-page namespaces; work and creator pages are separate subjects. */
export function tropePageUrl(input: string | null | undefined): string | null {
	// Historical title imports prepended this exact origin to an already absolute link.
	const duplicated = "https://tvtropes.orghttps://tvtropes.org/"
	const candidate = input?.startsWith(duplicated)
		? input.slice("https://tvtropes.org".length)
		: input
	if (
		!candidate ||
		!/^https?:\/\/(?:www\.)?tvtropes\.org\/pmwiki\/pmwiki\.php\/[A-Za-z]+\/[A-Za-z0-9_]+$/i.test(
			candidate,
		)
	)
		return null
	const url = new URL(candidate)
	const route = /^\/pmwiki\/pmwiki\.php\/([A-Za-z]+)\/[A-Za-z0-9_]+$/.exec(
		url.pathname,
	)
	return route && GENERAL_TROPE_NAMESPACES.has(route[1])
		? `https://tvtropes.org${url.pathname}`
		: null
}

/** Raw source discovery stays Main-only. No page URL or slug is ever guessed. */
export function mainTropeUrl(input: string | null | undefined): string | null {
	const page = tropePageUrl(input)
	return page?.startsWith("https://tvtropes.org/pmwiki/pmwiki.php/Main/")
		? page
		: null
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
		const urls = [...new Set(input.flatMap((url) => tropePageUrl(url) ?? []))]
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
			const target = tropePageUrl(row.canonical_url)
			if (
				allowed.has(row.reference_url) &&
				target &&
				(mainTropeUrl(row.reference_url) || row.reference_url === target)
			)
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
				.filter((p) => tropePageUrl(p.url) === p.url)
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
	return async (
		input: string[],
		options: DescriptionReadOptions = {},
	): Promise<TropeDescriptions> => {
		const urls = input.filter((url) => tropePageUrl(url) === url)
		const allowed = new Set(urls)
		const rows = await batched<{
			url: string
			title: string | null
			description: string | null
			description_doc?: string | null
		}>(
			read,
			"trope_catalog_page",
			options.openings === false
				? "url, title, description"
				: "url, title, description, description_doc",
			"url",
			urls,
		)
		return Object.fromEntries(
			rows
				.filter((row) => allowed.has(row.url))
				.map((row) => [
					row.url,
					{
						url: row.url,
						title: row.title?.trim() || null,
						...describeRow(row.description, row.description_doc, options),
					},
				]),
		)
	}
}
