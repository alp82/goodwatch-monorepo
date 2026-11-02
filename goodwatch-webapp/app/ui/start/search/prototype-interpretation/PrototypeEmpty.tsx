// THROWAWAY: explicit, reversible constraint relaxation opens Discover.
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "@remix-run/react"
import { denseExample } from "./data"
import "./prototype.css"
export default function PrototypeEmpty({
	query,
	preview,
}: { query: string; preview: boolean }) {
	const [params] = useSearchParams()
	const interpretation = useQuery<{ params: string; residual: string }>({
		queryKey: ["prototype-interpretation", query],
		enabled: query.length > 1 && query !== denseExample.query,
		queryFn: async ({ signal }) => {
			const existing = new URLSearchParams(params)
			for (const key of ["q", "variant", "example", "preview"])
				existing.delete(key)
			const r = await fetch("/api/discover/interpret", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query, existing: existing.toString() }),
				signal,
			})
			if (!r.ok) throw Error("Interpretation unavailable")
			return r.json()
		},
		retry: false,
	})
	const fields = new URLSearchParams(
		query === denseExample.query
			? denseExample.filters
			: (interpretation.data?.params ?? ""),
	)
	if (interpretation.data?.residual)
		fields.set("q", interpretation.data.residual)
	const relaxations = [
		{ label: "Any release year", keys: ["years", "minYear", "maxYear"] },
		{ label: "Any service", keys: ["services"] },
		{ label: "Any budget", keys: ["budget"] },
		{ label: "Any age rating", keys: ["age"] },
		{ label: "Any runtime", keys: ["runtime", "minRuntime", "maxRuntime"] },
		{ label: "Any score", keys: ["score", "sources", "minScore", "maxScore"] },
	]
		.filter((option) => option.keys.some((k) => fields.has(k)))
		.slice(0, 4)
	return (
		<div className="ir-prototype ir-empty" aria-live="polite">
			{preview && <small>EMPTY-STATE PREVIEW</small>}
			<h3>No matches with these filters</h3>
			<p>Try loosening one constraint, or edit your search.</p>
			<div className="ir-relaxations">
				{relaxations.map((option) => {
					const next = new URLSearchParams(fields)
					option.keys.forEach((k) => next.delete(k))
					return (
						<a
							key={option.label}
							href={`/discover?${next}`}
							title="Open Discover with this constraint removed"
						>
							{option.label} <span aria-hidden>→</span>
						</a>
					)
				})}
			</div>
			<button
				type="button"
				onClick={() => {
					const el = document.getElementById("start-search-input") as
						| HTMLInputElement
						| HTMLTextAreaElement
						| null
					el?.focus()
					el?.scrollIntoView({ block: "center", behavior: "smooth" })
				}}
			>
				Edit search
			</button>
		</div>
	)
}
