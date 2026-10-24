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
import { imdbImportKeys, request } from "./api"
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
		queryFn: async (): Promise<HeldRow[]> => {
			const url = `${api}/${encodeURIComponent(id)}/items?waiting=${question}&offset=0&limit=${HELD_PAGE}`
			if (api === "/api/imdb-import") {
				const page = await request<ImdbImportItemsResponse>(url)
				return page.items.flatMap((item) => heldFromImdbItem(item) ?? [])
			}
			const page = await request<{ items: ImportItem[]; total: number }>(url)
			return page.items.map(heldFromItem)
		},
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
}

/** Sends one answer. The answer comes back with the import as it is now, which replaces the one on screen. */
export function useDecide(api: ImportResultApi, id: string) {
	const client = useQueryClient()
	return useMutation<{ import: unknown; decided: number }, Error, Decision>({
		mutationFn: ({ question, answer, rows }) =>
			request(
				`${api}/${encodeURIComponent(id)}/decide`,
				post(
					api === "/api/imdb-import"
						? {
								answer: answer === "source" ? "imdb" : "keep",
								...(rows ? { rows } : {}),
							}
						: { question, answer, ...(rows ? { rows } : {}) },
				),
			),
		onSuccess: (response) => {
			if (api === "/api/imdb-import")
				client.setQueryData(imdbImportKeys.detail(id), {
					import: response.import,
				} as ImdbImportResponse)
			else
				client.setQueryData(sourceImportKeys.detail(id), {
					import: response.import as ImportSummary,
				})
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
