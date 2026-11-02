import { getStreamingProviders } from "./streaming-providers.server"
import { interpret, type Proposal } from "~/domain/discover-query"
import { createEntityResolver } from "./discover-query-entities.server.js"
import { getCast } from "./cast.server"
import { getPaletteTitles } from "./command-palette.server"
import { getSearchResults } from "./search.server"

// Reuse the lab's tested resolver with direct server lookups rather than self HTTP.
const resolveEntity = createEntityResolver(async (input: URL) => {
	const url = new URL(input)
	let data: unknown
	if (url.pathname === "/api/cast")
		data = await getCast({
			text: url.searchParams.get("text") ?? "",
			withCast: "",
			withoutCast: "",
		})
	else if (url.pathname === "/api/command-palette")
		data = await getPaletteTitles(url.searchParams.get("q") ?? "")
	else if (url.pathname === "/api/search")
		data = {
			searchResults: await getSearchResults({
				query: url.searchParams.get("query") ?? "",
				language: "en",
			}),
		}
	else throw Error("Unknown entity lookup")
	return Response.json(data)
}, "http://discover.internal")

let providerCatalog:
	| { at: number; rows: Awaited<ReturnType<typeof getStreamingProviders>> }
	| undefined
async function queryProviders() {
	if (providerCatalog && Date.now() - providerCatalog.at < 300_000)
		return providerCatalog.rows
	try {
		const rows = await getStreamingProviders({ country: "" })
		providerCatalog = { at: Date.now(), rows }
		return rows
	} catch {
		return []
	}
}
export async function interpretDiscoverQuery(
	query: string,
	existing = "",
	now = new Date(),
) {
	const additions: Proposal[] = []
	const warnings: string[] = []
	const attempted = new Set<string>()
	const providers = await queryProviders()
	let view = interpret(query, existing, now, [], providers)
	for (let pass = 0; pass < 8; pass++) {
		const key = (e: (typeof view.entities)[number]) =>
			JSON.stringify([e.parameter, e.name, e.start, e.end, Boolean(e.bare)])
		const pending = view.entities.filter((e) => !attempted.has(key(e)))
		if (!pending.length) break
		pending.forEach((e) => attempted.add(key(e)))
		const resolved = await Promise.allSettled(
			pending.map((e) => resolveEntity(e)),
		)
		for (const [index, outcome] of resolved.entries()) {
			if (outcome.status === "rejected")
				warnings.push(`Lookup unavailable for ${pending[index].name}`)
			else if (outcome.value) {
				additions.push(outcome.value)
				if (outcome.value.format)
					additions.push({
						parameter: "type",
						value: outcome.value.format,
						phrase: "format qualifier",
						source: "entity lookup",
						reason: "Format separated from the resolved reference",
					})
			}
		}
		view = interpret(query, existing, now, additions, providers)
	}
	const params = new URLSearchParams(view.filters)
	const explicit = new URLSearchParams(existing)
	// The lab's neutral defaults are useful for judging fixtures, but the start
	// page must retain the viewer's saved defaults unless they ask to change them.
	for (const key of ["services", "unseen"])
		if (
			!explicit.has(key) &&
			!view.proposals.some((p) => p.parameter === key && p.status === "applied")
		)
			params.delete(key)
	if (view.semanticQuery) params.set("q", view.semanticQuery)
	const labels = view.proposals
		.filter((p) => p.status === "applied")
		.map(proposalLabel)

	return {
		residual: view.residual,
		semanticQuery: view.semanticQuery,
		params: params.toString(),
		href: `/discover?${params}`,
		labels: [...new Set(labels)],
		appliedPhrases: view.proposals
			.filter((p) => p.status === "applied")
			.map((p) => ({ parameter: p.parameter, phrase: p.phrase })),
		warnings: [...view.warnings, ...warnings],
	}
}
export type DiscoverInterpretation = Awaited<
	ReturnType<typeof interpretDiscoverQuery>
>

function proposalLabel(p: Proposal): string {
	if (p.source === "entity lookup")
		return `${p.parameter === "similar" ? "Like " : ""}${p.reason.split(";")[0]}${/guess/i.test(p.reason) ? " (guess)" : ""}`
	const guess = /guess/i.test(p.reason) ? " (guess)" : ""
	switch (p.parameter) {
		case "age":
			return `Age ≤ ${p.value}${guess}`
		case "score":
			return `Score ≥ ${p.value}`
		case "minRuntime":
			return `At least ${p.value} min`
		case "maxRuntime":
			return `Up to ${p.value} min`
		case "minYear":
			return `From ${p.value}`
		case "maxYear":
			return `Through ${p.value}`
		case "services":
			return (
				(
					{
						"8": "Netflix",
						"9": "Prime Video",
						"337": "Disney+",
						mine: "My services",
						all: "All services",
					} as Record<string, string>
				)[p.value] ?? p.phrase
			)
		case "gap":
			return (
				(
					{
						agree: "Critics and audiences agree",
						critics: "Critics liked it more",
						audience: "Audiences liked it more",
					} as Record<string, string>
				)[p.value] + guess
			)
		default:
			return p.phrase + guess
	}
}
