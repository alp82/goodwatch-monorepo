import { z } from "zod"
import {
	IMPORT_MAX_ROWS,
	importActionable,
	type ImportCustomList,
	type ImportObservation,
	type ImportWarning,
} from "../../domain/imports.ts"
import { customListObservation } from "./custom-list-files.server.ts"

const paging = z.object({
	page: z.number().int().positive(),
	total_pages: z.number().int().nonnegative(),
	total_results: z.number().int().nonnegative(),
})
const metadata = z.object({
	id: z.number().int().positive(),
	name: z.string(),
	description: z.string(),
	item_count: z.number().int().nonnegative(),
})
const item = z.object({
	id: z.number().int().positive(),
	media_type: z.string(),
	title: z.string().optional(),
	name: z.string().optional(),
	release_date: z.string().optional(),
	first_air_date: z.string().optional(),
})
const indexPage = paging.extend({ results: z.array(metadata) })
const contentPage = paging.merge(metadata).extend({ items: z.array(item) })

/** Uses the same one-time v3 session as ratings; no provider mutations or independent credential storage. */
export async function readTmdbCustomLists(options: {
	request: (path: string) => Promise<unknown>
	accountId: string
	check: () => void
	fail: (message: string) => Error
	remaining: number
}): Promise<{ observations: ImportObservation[]; warnings: ImportWarning[] }> {
	const observations: ImportObservation[] = []
	const warnings: ImportWarning[] = []
	const lists: z.infer<typeof metadata>[] = []
	let pages = 1,
		expected = 0
	const ids = new Set<number>()
	for (let page = 1; page <= pages; page++) {
		options.check()
		const result = indexPage.safeParse(
			await options.request(
				`account/${encodeURIComponent(options.accountId)}/lists?page=${page}`,
			),
		)
		if (!result.success)
			throw options.fail(
				"TMDB returned unreadable custom lists. Please try again.",
			)
		const data = result.data
		if (data.page !== page)
			throw options.fail(
				"TMDB returned an unexpected custom-list page. Please try again.",
			)
		if (data.total_pages > 2500 || data.total_results > options.remaining)
			throw options.fail("That account produces more than 50,000 import items.")
		if (page === 1) {
			pages = data.total_pages
			expected = data.total_results
		} else if (data.total_pages !== pages || data.total_results !== expected)
			warnings.push(
				importActionable(
					"Your TMDB list count changed while reading. Review this partial import or connect again.",
				),
			)
		for (const list of data.results) {
			if (ids.has(list.id))
				throw options.fail(
					"TMDB returned duplicate custom lists. Please try again.",
				)
			ids.add(list.id)
			lists.push(list)
			if (lists.length > options.remaining)
				throw options.fail(
					"That account produces more than 50,000 import items.",
				)
		}
	}
	if (lists.length !== expected)
		warnings.push(
			importActionable(
				`Read ${lists.length} of ${expected} TMDB lists. Review this partial import or connect again.`,
			),
		)
	let used = lists.length
	for (const list of lists) {
		const entries: ImportCustomList["entries"] = []
		const seen = new Set<string>()
		let itemPages = 1,
			total = list.item_count
		for (let page = 1; page <= itemPages; page++) {
			options.check()
			const result = contentPage.safeParse(
				await options.request(`list/${list.id}?page=${page}`),
			)
			if (!result.success)
				throw options.fail(
					"TMDB returned an unreadable custom list. Please try again.",
				)
			const data = result.data
			if (data.id !== list.id || data.page !== page)
				throw options.fail(
					"TMDB returned an unexpected custom list or page. Please try again.",
				)
			if (
				data.total_pages > 2500 ||
				data.item_count > IMPORT_MAX_ROWS ||
				data.total_results > options.remaining - used + entries.length
			)
				throw options.fail(
					"That account produces more than 50,000 import items.",
				)
			if (page === 1) {
				itemPages = data.total_pages
				total = data.total_results
			}
			if (
				data.total_pages !== itemPages ||
				data.total_results !== total ||
				data.item_count !== list.item_count
			)
				warnings.push(
					importActionable(
						"A TMDB custom list changed while reading. Review this partial import or connect again.",
					),
				)
			for (const row of data.items) {
				const identity = `${row.media_type}:${row.id}`
				if (seen.has(identity))
					throw options.fail(
						"TMDB returned duplicate custom-list entries. Please try again.",
					)
				seen.add(identity)
				const position = entries.length + 1
				const release =
					row.media_type === "movie" ? row.release_date : row.first_air_date
				entries.push({
					position,
					note: "",
					entry: {
						key: `tmdb:list:${list.id}:${position}`,
						kind: "want",
						mediaType: row.media_type === "tv" ? "show" : "movie",
						title: (row.title ?? row.name ?? "").slice(0, 500),
						year:
							release && /^\d{4}-/.test(release)
								? Number(release.slice(0, 4))
								: null,
						tmdbId: row.id,
						imdbId: null,
						...(!["movie", "tv"].includes(row.media_type)
							? {
									problem: {
										outcome: "unsupported" as const,
										reason: "This TMDB list entry is not a movie or show.",
									},
								}
							: {}),
					},
				})
				used++
				if (used > options.remaining)
					throw options.fail(
						"That account produces more than 50,000 import items.",
					)
			}
		}
		if (entries.length !== total || entries.length !== list.item_count)
			warnings.push(
				importActionable(
					"A TMDB custom-list item count did not match what GoodWatch read. Review this partial import or connect again.",
				),
			)
		observations.push(
			customListObservation({
				sourceId: `tmdb:${list.id}`,
				name: list.name,
				description: list.description,
				entries,
			}),
		)
	}
	return { observations, warnings }
}
