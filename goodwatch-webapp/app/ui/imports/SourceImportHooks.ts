import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import type {
	ImportItem,
	ImportOptions,
	ImportOutcome,
	ImportSource,
	ImportStatus,
	ImportSummary,
} from "~/domain/imports"
import { buildSourceImportUpload } from "./SourceImportUpload"

const API = "/api/imports"
const KEY = "source-imports"
const ITEMS_PAGE_SIZE = 50
const PROGRESS_INTERVAL_MS = 1500

type ImportResponse = { import: ImportSummary }
export type ImportListResponse = { imports: ImportSummary[] }
type ImportItemsResponse = { items: ImportItem[]; total: number }

export const sourceImportKeys = {
	all: [KEY] as const,
	list: [KEY, "list"] as const,
	detail: (id: string) => [KEY, "detail", id] as const,
	items: (id: string, outcome: ImportOutcome) =>
		[KEY, "items", id, outcome] as const,
}

export const sourceSkippedDownloadUrl = (id: string) =>
	`${API}/${encodeURIComponent(id)}/skipped`

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
				: "Something went wrong on our side. Please try again.",
		)
	return body as T
}

const post = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(body),
})

export function useSourceImports(initialData?: ImportListResponse) {
	return useQuery({
		queryKey: sourceImportKeys.list,
		queryFn: () => request<ImportListResponse>(API),
		initialData,
	})
}

export function useSourceImport(id: string) {
	const client = useQueryClient()
	return useQuery({
		queryKey: sourceImportKeys.detail(id),
		queryFn: () => request<ImportResponse>(`${API}/${encodeURIComponent(id)}`),
		initialData: () => {
			const found = client
				.getQueryData<ImportListResponse>(sourceImportKeys.list)
				?.imports.find((item) => item.id === id)
			return found ? { import: found } : undefined
		},
		initialDataUpdatedAt: () =>
			client.getQueryState(sourceImportKeys.list)?.dataUpdatedAt,
		refetchInterval: (query) =>
			query.state.data?.import.status === "running"
				? PROGRESS_INTERVAL_MS
				: false,
	})
}

export function useSourceImportItems(
	id: string,
	outcome: ImportOutcome,
	enabled: boolean,
) {
	return useInfiniteQuery({
		queryKey: sourceImportKeys.items(id, outcome),
		enabled,
		initialPageParam: 0,
		queryFn: ({ pageParam }) =>
			request<ImportItemsResponse>(
				`${API}/${encodeURIComponent(id)}/items?outcome=${outcome}&offset=${pageParam}&limit=${ITEMS_PAGE_SIZE}`,
			),
		getNextPageParam: (last, pages) => {
			const loaded = pages.reduce((count, page) => count + page.items.length, 0)
			return last.items.length > 0 && loaded < last.total ? loaded : undefined
		},
	})
}

function invalidateMemberData(client: ReturnType<typeof useQueryClient>) {
	return Promise.all([
		client.invalidateQueries({ queryKey: ["user-data"] }),
		client.invalidateQueries({ queryKey: ["member-data"] }),
		client.invalidateQueries({ queryKey: ["tracking"] }),
		client.invalidateQueries({ queryKey: ["taste"] }),
		client.invalidateQueries({
			predicate: (query) => String(query.queryKey[0]).startsWith("taste"),
		}),
		client.invalidateQueries({
			predicate: (query) =>
				/^(tracking|watch-|watch$|my-)/.test(String(query.queryKey[0])),
		}),
	])
}

function useStoreImport() {
	const client = useQueryClient()
	return (response: ImportResponse) => {
		client.setQueryData(sourceImportKeys.detail(response.import.id), response)
		void client.invalidateQueries({ queryKey: sourceImportKeys.list })
		if (["done", "failed", "undone"].includes(response.import.status))
			void invalidateMemberData(client)
		return response
	}
}

export function usePreviewSourceImport() {
	const store = useStoreImport()
	return useMutation<
		ImportResponse,
		Error,
		{ source: ImportSource; file: File }
	>({
		mutationFn: ({ source, file }) =>
			request<ImportResponse>(`${API}/preview`, {
				method: "POST",
				body: buildSourceImportUpload(source, file),
			}),
		onSuccess: store,
	})
}

export function useConfirmSourceImport(id: string) {
	const store = useStoreImport()
	return useMutation<ImportResponse, Error, ImportOptions>({
		mutationFn: (options) =>
			request(`${API}/${encodeURIComponent(id)}/confirm`, post(options)),
		onSuccess: store,
	})
}

export function useUndoSourceImport(id: string) {
	const store = useStoreImport()
	return useMutation<ImportResponse, Error, void>({
		mutationFn: () =>
			request(`${API}/${encodeURIComponent(id)}/undo`, post({})),
		onSuccess: store,
	})
}

export function useRefreshAfterSourceImport(
	summary: ImportSummary | undefined,
) {
	const client = useQueryClient()
	const previous = useRef<ImportStatus | undefined>()
	const status = summary?.status
	useEffect(() => {
		const before = previous.current
		previous.current = status
		if (!before || !status || before === status) return
		void client.invalidateQueries({ queryKey: sourceImportKeys.list })
		if (["done", "failed", "undone"].includes(status))
			void invalidateMemberData(client)
	}, [client, status])
}
