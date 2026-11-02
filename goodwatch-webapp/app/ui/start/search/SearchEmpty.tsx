import type { DiscoverInterpretation } from "~/server/discover-query.server"
import { relaxQuery } from "./relax-query"
import { START_SEARCH_INPUT } from "./StartSearchBar"
import "./search-interpretation.css"
const options = [
	{ label: "Any release year", keys: ["years", "minYear", "maxYear"] },
	{ label: "Any service", keys: ["services"] },
	{ label: "Any budget", keys: ["budget"] },
	{ label: "Any age rating", keys: ["age"] },
	{ label: "Any runtime", keys: ["runtime", "minRuntime", "maxRuntime"] },
	{ label: "Any score", keys: ["score", "sources", "maxScore"] },
]
export default function SearchEmpty({
	query,
	interpretation,
	onSearch,
	onClearPicks,
}: {
	query: string
	interpretation?: DiscoverInterpretation
	onSearch: (text: string) => void
	onClearPicks?: () => void
}) {
	const fields = new URLSearchParams(interpretation?.params),
		phrases = interpretation?.appliedPhrases ?? []
	const choices = options
		.filter(
			(o) =>
				o.keys.some((k) => fields.has(k)) &&
				phrases.some(
					(p) =>
						o.keys.includes(p.parameter) &&
						query.toLowerCase().includes(p.phrase.toLowerCase()),
				),
		)
		.slice(0, 4)
	return (
		<div className="sq-empty" aria-live="polite">
			<h3>No matches with these filters</h3>
			<p>Try loosening one constraint, or edit your search.</p>
			<div className="sq-relaxations">
				{onClearPicks && (
					<button type="button" onClick={onClearPicks}>
						Clear mood picks
					</button>
				)}
				{choices.map((option) => (
					<button
						type="button"
						key={option.label}
						onClick={() =>
							onSearch(
								relaxQuery(
									query,
									phrases
										.filter((p) => option.keys.includes(p.parameter))
										.map((p) => p.phrase),
								),
							)
						}
					>
						{option.label}
					</button>
				))}
			</div>
			<button
				type="button"
				className="sq-edit"
				onClick={() => {
					const el = document.getElementById(START_SEARCH_INPUT)
					el?.focus()
					el?.scrollIntoView({
						block: "center",
						behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
							? "instant"
							: "smooth",
					})
				}}
			>
				Edit search
			</button>
		</div>
	)
}
