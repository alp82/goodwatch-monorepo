// PROTOTYPE - throwaway. The real Discover page (ui/discover/DiscoverPage.tsx) on fixture results, so the global Feedback
// tab's fix mode can be shown on Discover in the sandbox, where the catalog isn't reachable. The loader sends no first
// page (as right after a restart), so the page asks /api/discover/results; on this address only, the browser answers that
// request from app/ui/prototype-feedback/fixture-discover.json (popular titles from the GoodWatch MCP, 2026-10-25).
// Filters and sort change the URL and the count line as usual, but the cards stay the same.
import { json } from "@remix-run/node"
import type { MetaFunction, ShouldRevalidateFunction } from "@remix-run/react"
import { useLoaderData } from "@remix-run/react"
import {
	FILTER_NAMES,
	filterStateFromParams,
	sortFromParams,
} from "~/domain/filter-state"
import type { BrowseLoaderData } from "~/routes/discover.($type)"
import { DiscoverPage } from "~/ui/discover/DiscoverPage"
import fixture from "~/ui/prototype-feedback/fixture-discover.json"

const PATH = "/prototype/feedback-discover"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	const data: BrowseLoaderData = {
		browse: {
			initial: null,
			member: false,
			hasServices: false,
			savedForYou: true,
			searchScope: { country: "US", services: [] },
		},
	}
	return json(data)
}

export const meta: MetaFunction = () => [
	{ title: "Discover | GoodWatch (prototype)" },
	{ name: "robots", content: "noindex" },
]

// As on the real route: filter changes only touch the URL; the results come from the (answered) results request.
export const shouldRevalidate: ShouldRevalidateFunction = () => false

/** One page of fixture results for a results request's query, shaped like DiscoverResults. */
function resultsFor(search: string) {
	const params = new URLSearchParams(search)
	const state = filterStateFromParams(params, {
		onMyServices: false,
		notSeenYet: false,
	})
	const sort = sortFromParams(params, false)
	const cards = fixture.cards
	const total = cards.length
	const n = (part: number) => Math.max(1, Math.round(total * part))
	const optionCounts = Object.fromEntries(
		FILTER_NAMES.map((name) => [name, {}]),
	) as Record<string, Record<string, number>>
	optionCounts.services = { all: total, any: n(0.4), mine: total }
	optionCounts.notSeenYet = { on: total, off: total }
	optionCounts.type = {
		all: total,
		movie: cards.filter((c) => c.media_type === "movie").length,
		show: cards.filter((c) => c.media_type === "show").length,
	}
	optionCounts.anime = { any: total, only: 1, none: total - 1 }
	optionCounts.minScore = {
		"0": total,
		"60": cards.filter(
			(c) => c.goodwatch_overall_score_normalized_percent >= 60,
		).length,
		"70": cards.filter(
			(c) => c.goodwatch_overall_score_normalized_percent >= 70,
		).length,
		"80": cards.filter(
			(c) => c.goodwatch_overall_score_normalized_percent >= 80,
		).length,
	}
	optionCounts.minMatch = { "0": total, "70": total, "80": total, "90": total }
	optionCounts.legacy = { on: total, off: total }
	return {
		listId: null,
		page: Number(params.get("page") ?? "1") || 1,
		pageSize: 40,
		sort,
		sortUsed: sort === "match" || sort === "relevance" ? "popular" : sort,
		state,
		keys: cards.map((c) => c.key),
		cards,
		matches: cards.map(() => null),
		moved: [],
		forYou: {
			on: params.get("foryou") !== "0",
			applied: false,
			status: "signUp",
			ratings: 0,
		},
		explanation: null,
		searching: false,
		sides: null,
		hasTaste: false,
		total,
		hidden: 0,
		recoveries: [],
		optionCounts,
		approximate: false,
		ladder: null,
	}
}

// Installed once in the browser, before the page's first query runs; it only answers on this prototype's address.
if (typeof window !== "undefined") {
	const w = window as Window & { __feedbackDiscoverFetch?: boolean }
	if (!w.__feedbackDiscoverFetch) {
		w.__feedbackDiscoverFetch = true
		const real = window.fetch.bind(window)
		window.fetch = (input, init) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url
			const u = new URL(url, window.location.origin)
			if (
				window.location.pathname === PATH &&
				u.origin === window.location.origin &&
				u.pathname === "/api/discover/results"
			)
				return new Promise((resolve) =>
					setTimeout(
						() =>
							resolve(
								new Response(JSON.stringify(resultsFor(u.search)), {
									headers: { "Content-Type": "application/json" },
								}),
							),
						120,
					),
				)
			return real(input, init)
		}
	}
}

export default function DiscoverPrototype() {
	const data = useLoaderData<BrowseLoaderData>()
	return <DiscoverPage {...data.browse} />
}
