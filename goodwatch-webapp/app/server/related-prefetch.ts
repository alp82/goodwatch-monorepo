import { QueryClient, dehydrate } from "@tanstack/react-query"
import { counter } from "~/server/metrics/registry.server"
import {
	type RelatedPanel,
	getQueryKeyRelatedPanel,
} from "~/utils/related-panel"

const outcomes = counter(
	"goodwatch_related_prefetch_total",
	"Related title prefetch outcomes",
	["source", "result"],
)

/** A timed-out lookup keeps filling its data cache; only the document stops waiting. */
export async function prefetchRelatedState(
	{
		tmdbId,
		sourceMediaType,
		budgetMs,
	}: { tmdbId: number; sourceMediaType: "movie" | "show"; budgetMs?: number },
	lookup: () => Promise<RelatedPanel>,
) {
	const empty = () => dehydrate(new QueryClient())
	if (!Number.isSafeInteger(tmdbId)) {
		outcomes.inc([sourceMediaType, "error"])
		return empty()
	}
	const client = new QueryClient()
	let timer: ReturnType<typeof setTimeout> | undefined
	const pending = Promise.resolve()
		.then(lookup)
		.then((panel) => {
			client.setQueryData(
				getQueryKeyRelatedPanel({ tmdbId, sourceMediaType }),
				panel,
			)
			return "embedded" as const
		})
		.catch((error: unknown) => {
			console.error("Related titles prefetch failed", {
				tmdbId,
				sourceMediaType,
				error: error instanceof Error ? error.message : error,
			})
			return "error" as const
		})
	try {
		const result =
			budgetMs === undefined
				? await pending
				: await Promise.race([
						pending,
						new Promise<"budget">((resolve) => {
							// A timer that fires late, after a long render of another request, runs before the
							// answers that arrived in the meantime. setImmediate lets those answers win.
							timer = setTimeout(
								() => setImmediate(() => resolve("budget")),
								budgetMs,
							)
						}),
					])
		outcomes.inc([sourceMediaType, result])
		return result === "embedded" ? dehydrate(client) : empty()
	} finally {
		clearTimeout(timer)
	}
}
