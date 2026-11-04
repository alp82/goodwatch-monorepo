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
		if (!response.ok || !body || body.error) {
			const message: string = body?.error ?? `The V7 preview answered ${response.status}`
			// The preview's index or catalog refreshed more often than it retries: say so plainly, keep Retry.
			if (/refreshed during|index drift|snapshot is unavailable|still loading/i.test(message))
				throw new RetrievalFailed("The catalog just updated. Try again in a moment.", message.slice(0, 160))
			throw new Error(message)
		}
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
	/** The answer for the words the search reads (the query without switched-off phrases): the results. */
	answer: V7Answer | null
	/** The answer for the whole query: what it read, so switched-off items stay visible. */
	full: V7Answer | null
	readout: Readout | null
	/** The keys the grid gets, in the order the chosen sort needs. */
	ranked: TitleKey[] | null
	/**
	 * Every word became a filter (V7's catalogue flow, which can be tens of thousands of titles): the page asks the
	 * results endpoint for Discover's list with these hard parameters instead of sending a ranked list. They join the
	 * request only, never the URL, so they stay "read from your words" and leave with the words.
	 */
	catalogueParams: string | null
	loading: boolean
	/** The whole query's reading is still on its way. */
	reading: boolean
	error: string | null
	/** Short, for the inspector: the policy and the kind of failure, never the raw service error. */
	errorDetail: string | null
	retry: () => void
	existing: string
}

/** `typed`: the query as typed; `read`: the words the search reads (null when every read item is off). */
export function usePreferencePrototype(on: boolean, typed: string | null, read: string | null): PrototypeSearch {
	const [params] = useSearchParams()
	const existing = manualExisting(params)
	const fullQuery = useV7(typed, existing, on, true)
	const query = useV7(read, existing, on && read !== null, true)
	const fresh = query.data && !query.isPlaceholderData ? query.data : null
	const answer = on && read !== null ? (fresh ?? null) : null
	const full = on && typed !== null && fullQuery.data && !fullQuery.isPlaceholderData ? fullQuery.data : null
	const sort = params.get("sort")
	const view = useMemo(() => (answer ? readout(answer, params) : null), [answer, params])
	const ranked = useMemo(() => {
		if (!answer || answer.catalogue) return null
		return sort === "top" ? answer.v7.bestRated.keys : answer.v7.relevance.keys
	}, [answer, sort])
	const failed = query.isError && !query.isFetching ? query.error : null
	return {
		on,
		answer,
		full,
		readout: view,
		ranked,
		catalogueParams: answer?.catalogue ? answer.params.v7 : null,
		loading: on && read !== null && (query.isFetching || query.isPlaceholderData),
		reading: on && typed !== null && (fullQuery.isFetching || fullQuery.isPlaceholderData),
		error: failed ? (failed as Error).message : null,
		errorDetail: failed instanceof RetrievalFailed ? failed.detail : null,
		retry: () => void query.refetch(),
		existing,
	}
}
