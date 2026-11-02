import type { CSSProperties } from "react"
import type { DiscoverInterpretation } from "~/server/discover-query.server"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { tokens, type Token } from "./interpretation-labels"
import "./search-interpretation.css"
function Constraints({ items }: { items: Token[] }) {
	return (
		<div className="sq-row">
			<span className="sq-label">Filters</span>
			<div className="sq-values">
				{items.map((t, i) => (
					<span className="sq-filter" key={`${t.field}:${i}`} title={t.note}>
						<span>{t.field}</span> <strong>{t.value}</strong>
						{t.assumed && <small title={t.note}>≈</small>}
					</span>
				))}
			</div>
		</div>
	)
}
export default function SearchInterpretation({
	query,
	interpretation,
	reading,
	loading,
}: {
	query: string
	interpretation?: DiscoverInterpretation
	reading: ReadingChip[] | null
	loading: boolean
}) {
	const filters = tokens(
		Object.fromEntries(new URLSearchParams(interpretation?.params)),
		query,
		interpretation?.display,
	)
	const qualities = (reading ?? []).filter(
		(t) => (t.kind === "want" || t.kind === "avoid") && t.key,
	)
	const text = interpretation?.residual ?? ""
	if (!interpretation && !qualities.length)
		return loading ? (
			<div className="sq-reading" role="status">
				Reading your search…
			</div>
		) : null
	return (
		<div className="sq-readout search-private ph-no-capture sentry-mask">
			{text && (
				<div className="sq-row">
					<span className="sq-label">Search text</span>
					<span className="sq-text">“{text}”</span>
				</div>
			)}
			{qualities.length > 0 && (
				<div className="sq-row">
					<span className="sq-label">Fingerprint</span>
					<div className="sq-qualities">
						{qualities.map((t, i) => {
							const meta = getFingerprintMeta(t.key!)
							return (
								<span
									key={`${t.key}:${i}`}
									className={`sq-quality ${t.kind === "avoid" ? "sq-avoid" : ""}`}
									style={{ "--quality": meta.color } as CSSProperties}
									title={
										t.kind === "avoid"
											? "An avoided preference used in ranking."
											: "A wanted preference used in ranking."
									}
								>
									<i aria-hidden>{t.kind === "avoid" ? "−" : ""}</i>
									{t.kind === "avoid" && <small>Not</small>}
									<strong>{meta.label}</strong>
								</span>
							)
						})}
					</div>
				</div>
			)}
			{filters.length > 6 ? (
				<details className="sq-filter-details" key={JSON.stringify(filters)}>
					<summary>
						{filters.length} filters{" "}
						<span className="sq-show-all">Show all</span>
						<span className="sq-show-less">Show less</span>
					</summary>
					<Constraints items={filters} />
				</details>
			) : filters.length > 0 ? (
				<Constraints items={filters} />
			) : null}
		</div>
	)
}
