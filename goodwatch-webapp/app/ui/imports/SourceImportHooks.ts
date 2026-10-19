import {
	useInfiniteQuery,
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import type {
	FileImportSource,
	ImportItem,
	ImportMediaType,
	ImportOptions,
	ImportOutcome,
	ImportStatus,
	ImportSummary,
	WishlistMatchGroup,
	WishlistSuggestionProposal,
	WishlistSuggestions,
} from "~/domain/imports"
import { wishlistMatchErrorMessage } from "~/domain/wishlist-match-copy"
import { sourceImportNeedsPolling } from "./SourceImportPreviewModel"
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
	matches: (id: string) => [KEY, "matches", id] as const,
	matchEntry: (id: string, entry: number) =>
		[KEY, "match-entry", id, entry] as const,
	matchCandidates: (id: string, search: WishlistMatchSearch) =>
		[KEY, "match-candidates", id, search] as const,
	suggestions: (id: string, offset: number, round: number) =>
		[KEY, "suggestions", id, offset, round] as const,
}

export const sourceSkippedDownloadUrl = (id: string) =>
	`${API}/${encodeURIComponent(id)}/skipped`

/** A failed request. `status` is 0 when GoodWatch couldn't be reached; `code` is set for errors that carry one. */
export class ImportRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string | null,
	) {
		super(message)
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	let response: Response
	try {
		response = await fetch(url, init)
	} catch {
		throw new ImportRequestError(
			"We couldn't reach GoodWatch. Check your connection and try again.",
			0,
			null,
		)
	}
	const body = await response.json().catch(() => null)
	if (!response.ok || body === null) {
		const code = typeof body?.code === "string" ? body.code : null
		// A code this app knows gets its own words, so a member never reads a code or another wording.
		throw new ImportRequestError(
			(code && wishlistMatchErrorMessage(code)) ||
				(typeof body?.error === "string" && body.error
					? body.error
					: "Something went wrong on our side. Please try again."),
			response.status,
			code,
		)
	}
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
			sourceImportNeedsPolling(query.state.data?.import)
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

// Matching wishlist titles by hand. These shapes follow the backend's list, search, and resolve answers.
export type { WishlistMatchGroup }
export type WishlistMatchTarget = {
	mediaType: ImportMediaType
	tmdbId: number
}
export type WishlistMatchCandidate = WishlistMatchTarget & {
	title: string
	year: number | null
	posterPath: string | null
}
type WishlistMatchGroupsResponse = {
	groups: WishlistMatchGroup[]
	total: number
	offset: number
	hasMore: boolean
}
export type WishlistMatchSearch = {
	index: number
	query: string
	mediaType: ImportMediaType | null
}
type WishlistMatchCandidatesResponse = {
	index: number
	candidates: WishlistMatchCandidate[]
}
/** One change to the preview's choices. Null clears a choice; rows left out keep theirs. */
export type WishlistMatchChange = {
	index: number
	target: WishlistMatchTarget | null
}
/** The most changes the server takes in one request. */
export const WISHLIST_MATCH_MAX_CHANGES = 100

/** The entries a member can match, grouped by the server, a page at a time once `enabled`. */
export function useWishlistMatchGroups(id: string, enabled: boolean) {
	return useInfiniteQuery({
		queryKey: sourceImportKeys.matches(id),
		enabled,
		initialPageParam: 0,
		queryFn: ({ pageParam }) =>
			request<WishlistMatchGroupsResponse>(
				`${API}/${encodeURIComponent(id)}/matches?offset=${pageParam}`,
			),
		getNextPageParam: (last) =>
			last.hasMore && last.groups.length > 0
				? last.offset + last.groups.length
				: undefined,
	})
}

/** The entry that holds row `entry`, even a repeated row or one on a page that isn't loaded. Runs only for a number. */
export function useWishlistMatchEntry(id: string, entry: number | null) {
	return useQuery({
		queryKey:
			entry === null
				? [KEY, "match-entry", id, null]
				: sourceImportKeys.matchEntry(id, entry),
		enabled: entry !== null,
		queryFn: () =>
			request<{ group: WishlistMatchGroup }>(
				`${API}/${encodeURIComponent(id)}/matches?entry=${entry}`,
			),
	})
}

/** GoodWatch catalog titles for one entry. Runs only for a search the member sent. */
export function useWishlistMatchCandidates(
	id: string,
	search: WishlistMatchSearch | null,
) {
	return useQuery({
		queryKey: search
			? sourceImportKeys.matchCandidates(id, search)
			: [KEY, "match-candidates", id, null],
		enabled: search !== null,
		queryFn: () => {
			if (!search) throw new Error("No search")
			const params = new URLSearchParams({
				index: String(search.index),
				q: search.query,
			})
			if (search.mediaType) params.set("type", search.mediaType)
			return request<WishlistMatchCandidatesResponse>(
				`${API}/${encodeURIComponent(id)}/matches?${params}`,
			)
		},
	})
}

/** The server answers suggestions for this many entries at a time, in the order of the match list. */
const SUGGESTIONS_PAGE_SIZE = 10

/** What GoodWatch suggests for one shown entry, or where finding that out stands. */
export type WishlistRowSuggestion =
	| {
			state:
				| "loading"
				| "failed"
				| "unavailable"
				| "manual"
				| "already_resolved"
	  }
	| { state: "suggested"; proposal: WishlistSuggestionProposal }

/**
 * GoodWatch's suggestions for the entries shown, in the match list's order. It asks for one page of 10 at a time and
 * only for entries already loaded, so a long file never sends a burst of requests. A page that failed, or an entry the
 * server couldn't check, stays unknown until `retry`, which asks for just those pages again, one at a time.
 */
export function useWishlistSuggestions(
	id: string,
	shown: readonly { representativeIndex: number }[],
) {
	const client = useQueryClient()
	const offsets = Array.from(
		{ length: Math.ceil(shown.length / SUGGESTIONS_PAGE_SIZE) },
		(_, at) => at * SUGGESTIONS_PAGE_SIZE,
	)
	// A retried page gets a new key, so it starts from nothing and waits for its turn like any other page.
	const [rounds, setRounds] = useState<ReadonlyMap<number, number>>(new Map())
	const keys = offsets.map((offset) =>
		sourceImportKeys.suggestions(id, offset, rounds.get(offset) ?? 0),
	)
	// A page is asked for once every page before it has answered or failed, so a retry of pages apart still goes one
	// at a time. A page that answered or failed stays enabled, so a retry of an earlier page doesn't ask for it again.
	const settled = (at: number) =>
		["success", "error"].includes(client.getQueryState(keys[at])?.status ?? "")
	const pages = useQueries({
		queries: offsets.map((offset, at) => ({
			queryKey: keys[at],
			enabled:
				settled(at) || keys.slice(0, at).every((_, before) => settled(before)),
			// A preview never changes, so its suggestions don't either. Refetching on focus, reconnect, or mount would
			// ask for every loaded page at once; Try again is the only way to ask again, one page at a time.
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			refetchOnMount: false,
			// A failed page in the cache isn't asked for again on mount either.
			retryOnMount: false,
			queryFn: ({ signal }: { signal: AbortSignal }) =>
				request<WishlistSuggestions>(
					`${API}/${encodeURIComponent(id)}/suggestions?offset=${offset}`,
					{ signal },
				),
		})),
	})
	const rows = new Map<number, WishlistRowSuggestion>()
	shown.forEach((group, position) => {
		const page = pages[Math.floor(position / SUGGESTIONS_PAGE_SIZE)]
		if (page.isError) rows.set(group.representativeIndex, { state: "failed" })
		else if (!page.isSuccess)
			rows.set(group.representativeIndex, { state: "loading" })
		else {
			const found = page.data.groups.find(
				(item) => item.representativeIndex === group.representativeIndex,
			)
			rows.set(
				group.representativeIndex,
				!found
					? { state: "unavailable" }
					: found.state === "suggested"
						? found.proposal
							? { state: "suggested", proposal: found.proposal }
							: { state: "manual" }
						: { state: found.state },
			)
		}
	})
	const unchecked = (offset: number, at: number) =>
		pages[at].isError ||
		shown
			.slice(offset, offset + SUGGESTIONS_PAGE_SIZE)
			.some(
				(group) => rows.get(group.representativeIndex)?.state === "unavailable",
			)
	return {
		rows,
		loading: pages.some((page) => page.isPending),
		retry: () =>
			setRounds((current) => {
				const next = new Map(current)
				offsets.forEach((offset, at) => {
					if (unchecked(offset, at))
						next.set(offset, (current.get(offset) ?? 0) + 1)
				})
				return next
			}),
	}
}

/** Sends the member's changes. The server answers with a new preview; this one stays as it was. */
export function useResolveWishlistImport(id: string) {
	const store = useStoreImport()
	return useMutation<
		ImportResponse & { parentImportId: string },
		ImportRequestError,
		WishlistMatchChange[]
	>({
		mutationFn: (choices) =>
			request(`${API}/${encodeURIComponent(id)}/resolve`, post({ choices })),
		onSuccess: store,
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
		{ source: FileImportSource; file: File; wishlist?: File }
	>({
		mutationFn: ({ source, file, wishlist }) =>
			request<ImportResponse>(`${API}/preview`, {
				method: "POST",
				body: buildSourceImportUpload(source, file, wishlist),
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
