// What the questions during a run load and send: the rows held for a question (`items?waiting=`), and an answer
// (`/decide`). Both import APIs, general and IMDb ratings, behind one shape.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
	ImdbImportItemsResponse,
	ImdbImportResponse,
} from "~/domain/imdb-import"
import type {
	ImportAnswer,
	ImportItem,
	ImportQuestion,
	ImportSummary,
} from "~/domain/imports"
import type { ImportResultApi } from "./ImportResult"
import { sourceImportKeys } from "./SourceImportHooks"
import { RequestError, imdbImportKeys, request } from "./api"
import {
	type HeldRow,
	heldFromImdbItem,
	heldFromItem,
} from "./import-questions-model"

/** Held rows read per question: enough for the first titles, never the whole import. */
export const HELD_PAGE = 200

/** The questions whose held rows the items API lists. */
const LISTED: Record<ImportResultApi, readonly ImportQuestion[]> = {
	"/api/imports": ["conflict", "rewatch", "wholeShow"],
	"/api/imdb-import": ["conflict"],
}

const heldKey = (api: ImportResultApi, id: string, question: ImportQuestion) =>
	["import-held", api, id, question] as const

/** One page of the rows held for a question, as held rows; with `title`, only that title's (`tmdbId`, `mediaType`). */
async function heldPage(
	api: ImportResultApi,
	id: string,
	question: ImportQuestion,
	offset: number,
	title?: { tmdbId: string; mediaType: string },
): Promise<{ rows: HeldRow[]; total: number }> {
	const url = `${api}/${encodeURIComponent(id)}/items?waiting=${question}${title ? `&tmdbId=${title.tmdbId}&mediaType=${title.mediaType}` : ""}&offset=${offset}&limit=${HELD_PAGE}`
	if (api === "/api/imdb-import") {
		const page = await request<ImdbImportItemsResponse>(url)
		return {
			rows: page.items.flatMap((item) => heldFromImdbItem(item) ?? []),
			total: page.total,
		}
	}
	const page = await request<{ items: ImportItem[]; total: number }>(url)
	return { rows: page.items.map(heldFromItem), total: page.total }
}

/** Pages read at once while looking for every row of one title. */
const PAGES_AT_ONCE = 4

/** Every page of the held rows from the second on, a few at a time, each row passed to `take`. */
async function restOfPages(
	total: number,
	read: (offset: number) => Promise<{ rows: HeldRow[] }>,
	take: (row: HeldRow) => void,
) {
	const offsets: number[] = []
	for (let offset = HELD_PAGE; offset < total; offset += HELD_PAGE)
		offsets.push(offset)
	for (let at = 0; at < offsets.length; at += PAGES_AT_ONCE)
		for (const page of await Promise.all(
			offsets.slice(at, at + PAGES_AT_ONCE).map(read),
		))
			for (const row of page.rows) take(row)
}

/**
 * Every row a question holds for one title (`HeldRow.key`). The items API narrows the held rows to the title, so this
 * is one request, more only past a page. A server from before that filter refuses it (400): then every page of the
 * held rows is read, since a title's rows can be anywhere in the file.
 */
export async function heldRowsOfTitle(
	api: ImportResultApi,
	id: string,
	question: ImportQuestion,
	key: string,
): Promise<number[]> {
	const found = new Set<number>()
	const take = (row: HeldRow) => {
		if (row.key === key) found.add(row.index)
	}
	const ref = /^(movie|show):(\d+)(?::|$)/.exec(key)
	if (ref) {
		const title = { mediaType: ref[1], tmdbId: ref[2] }
		const first = await heldPage(api, id, question, 0, title).catch(
			(failure: unknown) => {
				if (failure instanceof RequestError && failure.status === 400)
					return null
				throw failure
			},
		)
		if (first) {
			for (const row of first.rows) take(row)
			await restOfPages(
				first.total,
				(offset) => heldPage(api, id, question, offset, title),
				take,
			)
			return [...found]
		}
	}
	const first = await heldPage(api, id, question, 0)
	for (const row of first.rows) take(row)
	await restOfPages(
		first.total,
		(offset) => heldPage(api, id, question, offset),
		take,
	)
	return [...found]
}

/**
 * The first rows held for a question, while it has any. `waiting` is part of the key, so an answer that moved rows
 * reads the list again. Rows are undefined while loading, for a question the API doesn't list, and after a failed read.
 */
export function useHeldRows(
	api: ImportResultApi,
	id: string,
	question: ImportQuestion,
	waiting: number,
): {
	rows: readonly HeldRow[] | undefined
	failed: boolean
	retry: () => void
} {
	const enabled = waiting > 0 && LISTED[api].includes(question)
	const query = useQuery({
		queryKey: [...heldKey(api, id, question), waiting],
		enabled,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: 1,
		// The next page keeps the screen's title on show while it loads.
		placeholderData: (previous) => previous,
		queryFn: async () => (await heldPage(api, id, question, 0)).rows,
	})
	return {
		rows: enabled ? query.data : undefined,
		failed: enabled && query.isError,
		retry: () => void query.refetch(),
	}
}

export interface Decision {
	question: ImportQuestion
	answer: ImportAnswer
	/** Row indexes of one title; absent answers every row the question holds. */
	rows?: number[]
	/**
	 * The title (`HeldRow.key`) the rows belong to, when the loaded page may not hold all of its rows: they are read
	 * first, so the answer covers the whole title.
	 */
	wholeTitle?: string
}

/** Rows one answer sends at most: the decide APIs take up to 500. */
export const DECIDE_BATCH = 500

/**
 * Sends one answer, in batches of rows when it covers many. The answer comes back with the import as it is now, which
 * replaces the one on screen, and with the rows it answered.
 */
export function useDecide(api: ImportResultApi, id: string) {
	const client = useQueryClient()
	const detail =
		api === "/api/imdb-import"
			? imdbImportKeys.detail(id)
			: sourceImportKeys.detail(id)
	return useMutation<
		{ import: unknown; decided: number; rows?: number[] },
		Error,
		Decision
	>({
		mutationFn: async ({ question, answer, rows, wholeTitle }) => {
			const send = (batch?: number[]) =>
				request<{ import: unknown; decided: number }>(
					`${api}/${encodeURIComponent(id)}/decide`,
					post(
						api === "/api/imdb-import"
							? {
									answer: answer === "source" ? "imdb" : "keep",
									...(batch ? { rows: batch } : {}),
								}
							: { question, answer, ...(batch ? { rows: batch } : {}) },
					),
				)
			if (!rows) return send()
			const all = wholeTitle
				? [
						...new Set([
							...rows,
							...(await heldRowsOfTitle(api, id, question, wholeTitle)),
						]),
					].sort((a, b) => a - b)
				: rows
			let last: { import: unknown; decided: number } | null = null
			let decided = 0
			for (let at = 0; at < all.length; at += DECIDE_BATCH) {
				last = await send(all.slice(at, at + DECIDE_BATCH))
				decided += last.decided
			}
			return { import: last?.import, decided, rows: all }
		},
		onSuccess: async (response) => {
			// A progress read sent before the answer went in would put the import back as it was, and could stop
			// the polling on a "done" that's no longer true: it is dropped, and the import read again.
			await client.cancelQueries({ queryKey: detail })
			if (api === "/api/imdb-import")
				client.setQueryData(detail, {
					import: response.import,
				} as ImdbImportResponse)
			else
				client.setQueryData(detail, {
					import: response.import as ImportSummary,
				})
			void client.invalidateQueries({ queryKey: detail })
			// What the import changed moves with every answer, even while its status stays the same.
			void client.invalidateQueries({
				queryKey: ["import-result", api, id],
			})
		},
	})
}

const post = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(body),
})
