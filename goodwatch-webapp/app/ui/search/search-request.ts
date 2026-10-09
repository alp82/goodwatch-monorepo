// One request to the combined search, for the search page and Discover's free-text search: what kind of answer came
// back, and the ranked stream read to its batch. Every failure is an Error whose message the page shows next to Retry.
// Nothing here retries.
//
// The search roles answer through the proxy. When no role is healthy, or for about a second after one stops, the proxy
// answers 502, 503, or 504 itself, without the busy answer's JSON body. That, and a request that never got an answer,
// read as the busy answer.
//
// The pages call this through search-client.ts, which loads this module with the first search.
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { SearchBatch } from "~/server/combined-search/search.server"

import { SEARCH_BUSY_MESSAGE } from "./search-client"

export type SearchAnswer =
	/** The ranked stream: newline-delimited JSON, the reading first and the batch last. */
	| { kind: "stream" }
	/** The search role's own 503 with its message. */
	| { kind: "busy"; message: string }
	/** A 502, 503, or 504 without that message: the proxy answered, not a search role. */
	| { kind: "gateway" }
	/** Any other refusal, with the server's message when it sent one. */
	| { kind: "other"; message: string | null }

const GATEWAY_STATUSES = new Set([502, 503, 504])

/** Reads the body of an answer that isn't the ranked stream, so call it once per response. */
export async function classifySearchResponse(
	response: Response,
): Promise<SearchAnswer> {
	if (response.ok) return { kind: "stream" }
	// The proxy's own answers have an empty, plain text, or HTML body.
	const body: unknown = await response.json().catch(() => null)
	const error = (body as { error?: unknown } | null)?.error
	const message = typeof error === "string" && error ? error : null
	if (response.status === 503 && message) return { kind: "busy", message }
	if (GATEWAY_STATUSES.has(response.status) && !message)
		return { kind: "gateway" }
	return { kind: "other", message }
}

export async function requestSearch({
	body,
	signal,
	onReading,
	unavailable,
}: {
	/** The JSON body of the search request. */
	body: unknown
	signal: AbortSignal
	/** The reading of the query, which arrives before the results. */
	onReading: (chips: ReadingChip[]) => void
	/** What the page says when the search failed and the server didn't say why. */
	unavailable: string
}): Promise<SearchBatch> {
	// A request that was cancelled keeps its own error. Any other request that got no answer, or lost it partway,
	// reads as busy.
	const lost = (error: unknown) =>
		signal.aborted ? error : new Error(SEARCH_BUSY_MESSAGE)
	let response: Response
	try {
		response = await fetch("/api/combined-search", {
			method: "POST",
			signal,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		})
	} catch (error) {
		throw lost(error)
	}
	const answer = await classifySearchResponse(response)
	if (answer.kind === "gateway") throw new Error(SEARCH_BUSY_MESSAGE)
	if (answer.kind !== "stream") throw new Error(answer.message ?? unavailable)
	const reader = response.body?.getReader()
	if (!reader) throw new Error(unavailable)
	const decoder = new TextDecoder()
	let buffered = ""
	let batch: SearchBatch | undefined
	const handle = (line: string) => {
		if (!line.trim()) return
		let message: {
			kind?: string
			reading?: ReadingChip[]
			batch?: SearchBatch
			error?: string
		} | null
		try {
			message = JSON.parse(line)
		} catch {
			// Not the stream's JSON: an answer some other server wrote, or a line that was cut off.
			throw new Error(unavailable)
		}
		if (message?.kind === "reading") onReading(message.reading ?? [])
		else if (message?.kind === "batch") batch = message.batch
		else if (message?.kind === "error")
			throw new Error(message.error ?? unavailable)
	}
	while (true) {
		let chunk: Awaited<ReturnType<typeof reader.read>>
		try {
			chunk = await reader.read()
		} catch (error) {
			throw lost(error)
		}
		if (chunk.done) break
		buffered += decoder.decode(chunk.value, { stream: true })
		const lines = buffered.split("\n")
		buffered = lines.pop() ?? ""
		for (const line of lines) handle(line)
	}
	handle(buffered + decoder.decode())
	if (!batch) throw new Error(unavailable)
	return batch
}
