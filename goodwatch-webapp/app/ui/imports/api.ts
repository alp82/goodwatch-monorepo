// TanStack Query hooks for the `/api/imdb-import/*` endpoints. The shapes live in ~/domain/imdb-import.
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import {
	IMDB_IMPORT_MAX_BYTES,
	type ImdbConflictChoice,
	type ImdbImportConfirmRequest,
	type ImdbImportItemsResponse,
	type ImdbImportListResponse,
	type ImdbImportOutcome,
	type ImdbImportPreviewRequest,
	type ImdbImportResponse,
	type ImdbImportStatus,
	type ImdbImportSummary,
} from "~/domain/imdb-import"

const API = "/api/imdb-import"
const KEY = "imdb-import"
const ITEMS_PAGE_SIZE = 50
/** How often a running import is asked for its progress. */
const PROGRESS_INTERVAL_MS = 1500

export const imdbImportKeys = {
	all: [KEY] as const,
	list: [KEY, "list"] as const,
	detail: (id: string) => [KEY, "detail", id] as const,
	items: (id: string, outcome: ImdbImportOutcome) =>
		[KEY, "items", id, outcome] as const,
}

export const skippedDownloadUrl = (id: string) =>
	`${API}/${encodeURIComponent(id)}/skipped`

const GENERIC_ERROR = "Something went wrong on our side. Please try again."

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	let response: Response
	try {
		response = await fetch(url, init)
	} catch {
		throw new Error(
			"We couldn't reach GoodWatch. Check your connection and try again.",
		)
	}
	const body = await response.json().catch(() => null)
	if (!response.ok || body === null)
		throw new Error(
			typeof body?.error === "string" && body.error
				? body.error
				: GENERIC_ERROR,
		)
	return body as T
}

const post = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(body),
})

/** The member's imports, newest first. */
export function useImdbImports() {
	return useQuery({
		queryKey: imdbImportKeys.list,
		queryFn: () => request<ImdbImportListResponse>(API),
	})
}

/** One import. Asks again every moment while it is running, and stops once it isn't. */
export function useImdbImport(id: string) {
	const queryClient = useQueryClient()
	return useQuery({
		queryKey: imdbImportKeys.detail(id),
		queryFn: () =>
			request<ImdbImportResponse>(`${API}/${encodeURIComponent(id)}`),
		// Start from what the list already knows about this import.
		initialData: () => {
			const found = queryClient
				.getQueryData<ImdbImportListResponse>(imdbImportKeys.list)
				?.imports.find((item) => item.id === id)
			return found ? { import: found } : undefined
		},
		initialDataUpdatedAt: () =>
			queryClient.getQueryState(imdbImportKeys.list)?.dataUpdatedAt,
		refetchInterval: (query) =>
			query.state.data?.import.status === "running"
				? PROGRESS_INTERVAL_MS
				: false,
	})
}

/** The titles behind one count, loaded a page at a time once `enabled`. */
export function useImdbImportItems(
	id: string,
	outcome: ImdbImportOutcome,
	enabled: boolean,
) {
	return useInfiniteQuery({
		queryKey: imdbImportKeys.items(id, outcome),
		enabled,
		initialPageParam: 0,
		queryFn: ({ pageParam }) =>
			request<ImdbImportItemsResponse>(
				`${API}/${encodeURIComponent(id)}/items?outcome=${outcome}&offset=${pageParam}&limit=${ITEMS_PAGE_SIZE}`,
			),
		getNextPageParam: (last, pages) => {
			const loaded = pages.reduce((n, page) => n + page.items.length, 0)
			return last.items.length > 0 && loaded < last.total ? loaded : undefined
		},
	})
}

function useStoreImport() {
	const queryClient = useQueryClient()
	return (response: ImdbImportResponse) => {
		queryClient.setQueryData(
			imdbImportKeys.detail(response.import.id),
			response,
		)
		return response
	}
}

/** Reads the chosen file in the browser and asks for a preview. Nothing is saved to the member's ratings. */
export function usePreviewImdbImport() {
	const store = useStoreImport()
	return useMutation<ImdbImportResponse, Error, File>({
		mutationFn: async (file) => {
			if (!/\.csv$/i.test(file.name) && file.type !== "text/csv")
				throw new Error(
					"That doesn't look like a CSV file. Choose the ratings file you downloaded from IMDb.",
				)
			if (file.size > IMDB_IMPORT_MAX_BYTES)
				throw new Error(
					`That file is larger than ${Math.round(IMDB_IMPORT_MAX_BYTES / 1024 / 1024)} MB, which is more than an IMDb ratings file should be. Choose the ratings file you downloaded from IMDb.`,
				)
			let csv: string
			try {
				csv = await file.text()
			} catch {
				throw new Error("We couldn't read that file. Please try again.")
			}
			if (!csv.trim()) throw new Error("That file is empty.")
			const body: ImdbImportPreviewRequest = { fileName: file.name, csv }
			return request<ImdbImportResponse>(`${API}/preview`, post(body))
		},
		onSuccess: store,
	})
}

/** Starts an import, or resumes one that stopped. */
export function useConfirmImdbImport(id: string) {
	const store = useStoreImport()
	return useMutation<ImdbImportResponse, Error, ImdbConflictChoice>({
		mutationFn: (conflictChoice) => {
			const body: ImdbImportConfirmRequest = { conflictChoice }
			return request<ImdbImportResponse>(
				`${API}/${encodeURIComponent(id)}/confirm`,
				post(body),
			)
		},
		onSuccess: store,
	})
}

export function useUndoImdbImport(id: string) {
	const store = useStoreImport()
	return useMutation<ImdbImportResponse, Error, void>({
		mutationFn: () =>
			request<ImdbImportResponse>(
				`${API}/${encodeURIComponent(id)}/undo`,
				post({}),
			),
		onSuccess: store,
	})
}

/**
 * Keeps the rest of the app in step with an import. When the import shown here starts, finishes, fails or is undone,
 * the import history is fetched again; once it has written or removed ratings, so is everything built on the member's
 * ratings (their user data, Taste, suggestions).
 */
export function useRefreshAfterImport(summary: ImdbImportSummary | undefined) {
	const queryClient = useQueryClient()
	const previous = useRef<ImdbImportStatus | undefined>(undefined)
	const status = summary?.status
	useEffect(() => {
		const before = previous.current
		previous.current = status
		if (!before || !status || before === status) return
		queryClient.invalidateQueries({ queryKey: imdbImportKeys.list })
		if (status === "preview" || status === "running") return
		queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] !== KEY,
		})
	}, [status, queryClient])
}
