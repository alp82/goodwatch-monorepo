// THROWAWAY: relax a constraint in the current start-page query.
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "@remix-run/react"
import { denseExample } from "./data"
import "./prototype.css"
export default function PrototypeEmpty({
	query,
	preview,
}: { query: string; preview: boolean }) {
	const [params, setParams] = useSearchParams()
	const interpretation = useQuery<{
		params: string
		residual: string
		appliedPhrases?: { parameter: string; phrase: string }[]
	}>({
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
	const dense = query === denseExample.query
	const fields = new URLSearchParams(
		dense ? denseExample.filters : (interpretation.data?.params ?? ""),
	)
	const phrases = dense
		? [
				{ parameter: "years", phrase: "from the 90s" },
				{ parameter: "services", phrase: "Netflix or Prime" },
				{ parameter: "budget", phrase: "budget under $20m" },
				{ parameter: "age", phrase: "for my kids" },
				{ parameter: "runtime", phrase: "under 2 hours" },
				{ parameter: "sources", phrase: "IMDb 7+" },
				{ parameter: "sources", phrase: "Letterboxd 3.5+" },
			]
		: (interpretation.data?.appliedPhrases ?? [])
	const relaxations = [
		{ label: "Any release year", keys: ["years", "minYear", "maxYear"] },
		{ label: "Any service", keys: ["services"] },
		{ label: "Any budget", keys: ["budget"] },
		{ label: "Any age rating", keys: ["age"] },
		{ label: "Any runtime", keys: ["runtime", "minRuntime", "maxRuntime"] },
		{ label: "Any score", keys: ["score", "sources", "minScore", "maxScore"] },
	]
		.filter(
			(option) =>
				option.keys.some((k) => fields.has(k)) &&
				phrases.some(
					(p) =>
						option.keys.includes(p.parameter) &&
						query.toLowerCase().includes(p.phrase.toLowerCase()),
				),
		)
		.slice(0, 4)
	return (
		<div className="ir-prototype ir-empty" aria-live="polite">
			{preview && <small>EMPTY-STATE PREVIEW</small>}
			<h3>No matches with these filters</h3>
			<p>Try loosening one constraint, or edit your search.</p>
			<div className="ir-relaxations">
				{relaxations.map((option) => (
					<button
						type="button"
						key={option.label}
						onClick={() => {
							const remove = phrases
								.filter((p) => option.keys.includes(p.parameter))
								.map((p) => p.phrase.trim())
								.filter(Boolean)
								.sort((a, b) => b.length - a.length)
							let text = query
							for (const phrase of new Set(remove)) {
								const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
								const quoted = [...text.matchAll(/"[^"]*"|“[^”]*”/g)]
								text = text.replace(
									new RegExp(
										`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
										"giu",
									),
									(match, offset: number) =>
										quoted.some(
											(q) =>
												offset >= q.index! && offset < q.index! + q[0].length,
										)
											? match
											: " ",
								)
							}
							text = text
								.replace(/\b(?:and|or)\s+(?=(?:and|or)\b)/gi, "")
								.replace(/^\s*(?:(?:and|or|but)\b[\s,;]*)+/i, "")
								.replace(/(?:[\s,;]*\b(?:and|or|but))+\s*$/i, "")
								.replace(/\s+/g, " ")
								.trim()
							const next = new URLSearchParams(params)
							next.delete("preview")
							next.delete("example")
							if (text) next.set("q", text)
							else next.delete("q")
							setParams(next, { replace: true, preventScrollReset: true })
						}}
					>
						{option.label}
					</button>
				))}
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
