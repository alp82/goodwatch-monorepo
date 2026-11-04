// PROTOTYPE - throwaway (discover search preferences, see README.md). Discover's search, answered by the local
// read-only V7 preview service instead of the combined search: the query and the manual filters go in, V7's full
// eligible order comes back, and the page's own results endpoint pages, filters and counts it as it does any ranked
// list. Top rated uses V7's tiered order as sent (original matches first, then the broader titles by rating), so the
// page asks the results endpoint to keep the order ("relevance") while the sort control says Top rated.
import { useSearchParams } from "@remix-run/react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { TitleKey } from "~/utils/title-key"
import { type Readout, type V7Answer, manualExisting, readout } from "./model"

export const PROTOTYPE_VARIANTS = {
	A: "Reading line pins",
	B: "Results ledger",
	C: "Words in the field",
} as const
export type PrototypeVariant = keyof typeof PROTOTYPE_VARIANTS

const ENDPOINT = "/__prototype-v7/api/search"

// The preview answers one request at a time (429 while busy). Every call goes through this queue; the selected
// search jumps ahead of count hints, and a call whose page moved on is dropped before it is sent.
interface Job {
	main: boolean
	run: () => Promise<void>
}
const queue: Job[] = []
let busy = false
function pump() {
	if (busy || !queue.length) return
	const at = queue.findIndex((job) => job.main)
	const [job] = queue.splice(at >= 0 ? at : 0, 1)
	busy = true
	job.run().finally(() => {
		busy = false
		pump()
	})
}
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The V7 policy answered, but its retrieval failed: unknown, not zero. */
export class RetrievalFailed extends Error {
	constructor(
		message: string,
		readonly detail: string,
	) {
		super(message)
	}
}

async function send(query: string, existing: string, signal?: AbortSignal): Promise<V7Answer> {
	for (let attempt = 0; ; attempt++) {
		signal?.throwIfAborted()
		const response = await fetch(ENDPOINT, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ query, existing }),
			signal,
		})
		if (response.status === 429 && attempt < 5) {
			await pause(250 * (attempt + 1))
			continue
		}
		const body = await response.json().catch(() => null)
		if (!response.ok || !body || body.error)
			throw new Error(body?.error ?? `The V7 preview answered ${response.status}`)
		// HTTP 200 can still carry a failed retrieval (policy error, total 0): that's not an empty result. The raw
		// error (vector search JSON, hosts) stays out of the page; the inspector shows the policy and the kind.
		const failed = (body as V7Answer).v7?.error
		if (failed) {
			const status = /HTTP (\d{3})/.exec(failed)?.[1]
			throw new RetrievalFailed(
				"Search couldn't finish for these words. Try again, or change the words.",
				`${(body as V7Answer).v7.policy}: retrieval failed${status ? ` (HTTP ${status})` : ""}`,
			)
		}
		return body as V7Answer
	}
}

export function askV7(query: string, existing: string, signal?: AbortSignal, main = false): Promise<V7Answer> {
	return new Promise((resolve, reject) => {
		queue.push({
			main,
			run: () =>
				signal?.aborted
					? Promise.resolve(reject(new DOMException("Aborted", "AbortError")))
					: send(query, existing, signal).then(resolve, reject),
		})
		pump()
	})
}

export function useV7(query: string | null, existing: string, enabled = true, main = false) {
	return useQuery({
		queryKey: ["prototype-v7", query, existing],
		queryFn: ({ signal }) => askV7(query ?? "", existing, signal, main),
		enabled: enabled && query !== null && query.trim().length > 0,
		placeholderData: keepPreviousData,
		retry: false,
		refetchOnWindowFocus: false,
	})
}

export interface PrototypeSearch {
	on: boolean
	variant: PrototypeVariant
	answer: V7Answer | null
	readout: Readout | null
	/** The keys the grid gets, in the order the chosen sort needs. */
	ranked: TitleKey[] | null
	/** Only exact matches (B's strict view): the original tier alone, in the same order. */
	strict: boolean
	/**
	 * Every word became a filter (V7's catalogue flow, which can be tens of thousands of titles): the page asks the
	 * results endpoint for Discover's list with these hard parameters instead of sending a ranked list. They join the
	 * request only, never the URL, so they stay "from your words" and leave with the words.
	 */
	catalogueParams: string | null
	loading: boolean
	error: string | null
	/** Short, for the inspector: the policy and the kind of failure, never the raw service error. */
	errorDetail: string | null
	retry: () => void
	existing: string
}

export function usePreferencePrototype(on: boolean, q: string | null): PrototypeSearch {
	const [params] = useSearchParams()
	const raw = params.get("variant")
	const variant: PrototypeVariant = raw === "B" || raw === "C" ? raw : "A"
	const existing = manualExisting(params)
	const query = useV7(q, existing, on, true)
	const fresh = query.data && !query.isPlaceholderData ? query.data : null
	const answer = on && q !== null ? (fresh ?? null) : null
	const sort = params.get("sort")
	const strict = variant === "B" && params.get("strict") === "1"
	const view = useMemo(() => (answer ? readout(answer, params) : null), [answer, params])
	const ranked = useMemo(() => {
		if (!answer || answer.catalogue) return null
		const keys = sort === "top" ? answer.v7.bestRated.keys : answer.v7.relevance.keys
		if (!strict) return keys
		const original = new Set(answer.baseline.relevance.keys)
		return keys.filter((k) => original.has(k))
	}, [answer, sort, strict])
	return {
		on,
		variant,
		answer,
		readout: view,
		ranked,
		strict,
		catalogueParams: answer?.catalogue ? answer.params.v7 : null,
		loading: on && q !== null && (query.isFetching || query.isPlaceholderData),
		error: query.isError && !query.isFetching ? (query.error as Error).message : null,
		errorDetail:
			query.isError && !query.isFetching && query.error instanceof RetrievalFailed ? query.error.detail : null,
		retry: () => void query.refetch(),
		existing,
	}
}

/** What the count would be after an action: the same service, asked with the action's URL. Exact for that service. */
export function useWhatIf(next: URLSearchParams | null, enabled: boolean) {
	const q = next?.get("q") ?? null
	const query = useV7(q, next ? manualExisting(next) : "", enabled && next !== null)
	if (!next) return null
	if (!q) return { total: null as number | null, loading: false, browse: true, failed: false }
	return {
		total: query.data && !query.isPlaceholderData ? query.data.v7.total : null,
		loading: query.isFetching,
		browse: false,
		failed: query.isError && !query.isFetching,
	}
}
