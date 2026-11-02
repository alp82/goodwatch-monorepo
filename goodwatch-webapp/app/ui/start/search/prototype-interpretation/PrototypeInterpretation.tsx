// THROWAWAY UI question: three structurally different interpretation readouts
// on the real start page, switchable by ?variant=A|B|C. No saved state/mutations.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "@remix-run/react"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { catalog, examples, tokens, type Token } from "./data"
import "./prototype.css"

const names: Record<string, string> = {
	A: "Typed chips",
	B: "Grouped readout",
	C: "Expandable summary",
}
const filterIcon = (
	<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
		<path
			d="M2 4h12M2 8h12M2 12h12M5 2v4M11 6v4M7 10v4"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
		/>
	</svg>
)
const fingerprintIcon = (
	<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
		<path
			d="M3 11V8a5 5 0 0110 0v3M5 13V8a3 3 0 016 0v5M7 14V8a1 1 0 012 0v6M1 7a7 7 0 0114 0"
			stroke="currentColor"
			strokeWidth="1.3"
			strokeLinecap="round"
		/>
	</svg>
)
function Capsule({
	token,
	onClick,
}: { token: Token; onClick?: (t: Token) => void }) {
	return (
		<button
			type="button"
			className={`ir-chip ir-${token.kind} ${token.avoid ? "ir-avoid" : ""}`}
			onClick={() => onClick?.(token)}
			title={
				token.note ??
				`${token.kind === "filter" ? "Applied filter" : "Fingerprint reading"}: ${token.field} ${token.value}`
			}
		>
			{token.kind === "filter" ? (
				filterIcon
			) : token.kind === "fingerprint" ? (
				fingerprintIcon
			) : (
				<span>⌕</span>
			)}
			{token.kind === "filter" && <span className="ir-key">{token.field}</span>}
			<strong>{token.value}</strong>
			{token.assumed && (
				<span className="ir-assumption" aria-label="Assumed">
					≈
				</span>
			)}
		</button>
	)
}
export function VariantA({
	items,
	open,
}: { items: Token[]; open: (t: Token) => void }) {
	return (
		<div className="ir-variant-a">
			<span className="ir-lead">Understood</span>
			<div className="ir-chip-line">
				{items.map((t, i) => (
					<Capsule key={i} token={t} onClick={open} />
				))}
			</div>
		</div>
	)
}
export function VariantB({
	items,
	open,
}: { items: Token[]; open: (t: Token) => void }) {
	const groups = [
		["Filters", "filter"],
		["Fingerprint", "fingerprint"],
		["Search text", "text"],
	]
	return (
		<div className="ir-variant-b">
			{groups.map(([label, kind]) => {
				const row = items.filter((t) => t.kind === kind)
				if (!row.length) return null
				return (
					<div className="ir-reading-row" key={kind}>
						<span className="ir-row-label">
							{kind === "filter"
								? filterIcon
								: kind === "fingerprint"
									? fingerprintIcon
									: null}
							{label}
						</span>
						<div className="ir-plain-values">
							{row.map((t, i) => (
								<button
									type="button"
									className={`ir-plain ir-${t.kind} ${t.avoid ? "ir-avoid" : ""}`}
									key={i}
									onClick={() => open(t)}
								>
									<span>{t.kind === "filter" ? t.field : ""}</span>{" "}
									<strong>{t.value}</strong>
									{t.assumed && <span className="ir-assumption">≈</span>}
								</button>
							))}
						</div>
					</div>
				)
			})}
		</div>
	)
}
export function VariantC({
	items,
	open,
	expandedByDefault = false,
}: { items: Token[]; open: (t: Token) => void; expandedByDefault?: boolean }) {
	const [expanded, setExpanded] = useState(expandedByDefault)
	const f = items.filter((t) => t.kind === "filter"),
		s = items.filter((t) => t.kind === "fingerprint"),
		q = items.find((t) => t.kind === "text")
	return (
		<div className="ir-variant-c">
			<button
				type="button"
				className="ir-summary"
				onClick={() => setExpanded(!expanded)}
				aria-expanded={expanded}
			>
				{filterIcon}
				<strong>
					{f.length ? `${f.length} filters applied` : "No filters"}
				</strong>
				{s.length > 0 && <span> + {s.length} fingerprint qualities</span>}
				{q && <span> · Search “{q.value}”</span>}
				<span className="ir-summary-more">
					{expanded ? "Hide details ↑" : "Show interpretation ↓"}
				</span>
			</button>
			{expanded && (
				<div className="ir-summary-panel">
					{items.map((t, i) => (
						<button
							type="button"
							className="ir-receipt-row"
							key={i}
							onClick={() => open(t)}
						>
							<span>
								{t.kind === "filter"
									? filterIcon
									: t.kind === "fingerprint"
										? fingerprintIcon
										: "⌕"}{" "}
								{t.kind === "filter"
									? t.field
									: t.kind === "fingerprint"
										? "Fingerprint"
										: "Search text"}
							</span>
							<strong>
								{t.value}
								{t.assumed ? " ≈" : ""}
							</strong>
							<small>
								{t.note ??
									(t.kind === "filter"
										? "Applied constraint"
										: t.kind === "fingerprint"
											? "Soft preference"
											: "Literal query")}
							</small>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
export default function PrototypeInterpretation({
	query,
	reading,
	onExample,
}: {
	query: string
	reading: ReadingChip[] | null
	onExample: (q: string) => void
}) {
	const [params, setParams] = useSearchParams()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	const variant = params.get("variant") ?? "A"
	const [gallery, setGallery] = useState(false),
		[inspect, setInspect] = useState(false),
		[selected, setSelected] = useState<Token | null>(null),
		[gallerySearch, setGallerySearch] = useState("")
	const example =
		examples.find((e) => e.query.toLowerCase() === query.toLowerCase()) ??
		examples[0]
	const result = useQuery<{
		params: string
		residual: string
		labels: string[]
	}>({
		queryKey: ["prototype-interpretation", query],
		enabled: query.length > 1,
		queryFn: async ({ signal }) => {
			const existing = new URLSearchParams(params)
			existing.delete("q")
			existing.delete("variant")
			const r = await fetch("/api/discover/interpret", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query, existing: existing.toString() }),
				signal,
			})
			if (!r.ok) throw Error("Using review fixtures")
			return r.json()
		},
		retry: false,
	})
	const fallback =
		query && query.toLowerCase() !== example.query.toLowerCase()
			? { filters: {}, residual: query, fingerprint: [] }
			: example
	const fields = result.data
		? Object.fromEntries(new URLSearchParams(result.data.params))
		: fallback.filters
	const remaining = result.data?.residual ?? fallback.residual ?? ""
	const filterTokens = tokens(fields, query)
	const actual = (reading ?? []).filter(
		(t) => (t.kind === "want" || t.kind === "avoid") && t.key,
	)
	const fingerprint: Token[] = actual.length
		? actual.map((t) => ({
				kind: "fingerprint",
				field: "Fingerprint",
				value: getFingerprintMeta(t.key!).label,
				avoid: t.kind === "avoid",
				note:
					t.kind === "avoid"
						? "An avoided fingerprint quality, not a verified hard exclusion."
						: "A soft fingerprint preference used in ranking.",
			}))
		: ("fingerprint" in fallback ? (fallback.fingerprint ?? []) : []).map(
				(value) => ({
					kind: "fingerprint",
					field: "Fingerprint",
					value: value.replace("Avoid ", ""),
					avoid: value.startsWith("Avoid "),
				}),
			)
	const items = [
		...filterTokens,
		...fingerprint,
		...(remaining
			? [
					{
						kind: "text",
						field: "Search",
						value: remaining,
						note:
							remaining === "100"
								? "100 stays a literal title/text query; no minimum-score filter is applied."
								: "Text that remains for semantic/title search.",
					} as Token,
				]
			: []),
	]
	const state = {
		variant,
		query,
		source: result.data
			? "Live interpretation + available fingerprint read"
			: "Review fixture",
		filters: fields,
		remaining,
		fingerprint,
		fingerprintSource: actual.length
			? "Live reading"
			: "Illustrative review fixture",
		display: items,
	}
	function cycle(step: number) {
		const keys = ["A", "B", "C"]
		const next = new URLSearchParams(params)
		next.set("variant", keys[(keys.indexOf(variant) + step + 3) % 3])
		setParams(next, { replace: true, preventScrollReset: true })
	}
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement
			if (el.closest("input,textarea,select,[contenteditable=true]")) return
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault()
				cycle(e.key === "ArrowRight" ? 1 : -1)
			}
		}
		window.addEventListener("keydown", handler)
		return () => window.removeEventListener("keydown", handler)
	}, [variant, params])
	const open = (t: Token) => {
		setSelected(t)
		setInspect(true)
	}
	const Component =
		variant === "B" ? VariantB : variant === "C" ? VariantC : VariantA
	const portaled = !mounted
		? null
		: createPortal(
				<div className="ir-prototype">
					<div className="ir-switcher">
						<span className="ir-prototype-mark">PROTOTYPE</span>
						<button
							type="button"
							aria-label="Previous variant"
							onClick={() => cycle(-1)}
						>
							←
						</button>
						<span className="ir-current">
							{variant} · {names[variant]}
						</span>
						<button
							type="button"
							aria-label="Next variant"
							onClick={() => cycle(1)}
						>
							→
						</button>
						<span className="ir-switch-divider" />
						<select
							aria-label="Example phrase"
							value={examples.some((e) => e.query === query) ? query : ""}
							onChange={(e) => onExample(e.target.value)}
						>
							<option value="" disabled>
								Try an example
							</option>
							{examples.map((e) => (
								<option key={e.name} value={e.query}>
									{e.name}
								</option>
							))}
						</select>
						<button
							type="button"
							className="ir-switch-action"
							onClick={() => setGallery(true)}
						>
							All filter types
						</button>
						<button
							type="button"
							className="ir-switch-action"
							onClick={() => {
								setSelected(null)
								setInspect(!inspect)
							}}
						>
							State
						</button>
					</div>
					{inspect && (
						<aside className="ir-inspector">
							<div className="ir-panel-head">
								<strong>
									{selected
										? `${selected.field} · ${selected.value}`
										: "Interpretation state"}
								</strong>
								<button type="button" onClick={() => setInspect(false)}>
									Close ×
								</button>
							</div>
							{selected && (
								<p>
									{selected.note ??
										"The displayed value is the interpreted filter, not the original search phrase."}
									{selected.assumed ? " This involves an assumption." : ""}
								</p>
							)}
							<pre>{JSON.stringify(state, null, 2)}</pre>
						</aside>
					)}
					{gallery && (
						<div
							className="ir-overlay"
							role="dialog"
							aria-modal="true"
							aria-label="All filter and reading types"
						>
							<div className="ir-gallery">
								<div className="ir-panel-head">
									<div>
										<span className="ir-eyebrow">THROWAWAY · UI REVIEW</span>
										<h2>Every interpretation, in one vocabulary.</h2>
										<p>
											Filters are constraints. Fingerprint qualities are
											preferences. Remaining text is a search.
										</p>
									</div>
									<button type="button" onClick={() => setGallery(false)}>
										Close ×
									</button>
								</div>
								<input
									className="ir-gallery-search"
									placeholder="Find a filter, phrase, or value…"
									aria-label="Find a filter type"
									value={gallerySearch}
									onChange={(e) => setGallerySearch(e.target.value)}
								/>
								<div className="ir-gallery-labels">
									<span>Written phrase</span>
									<span>Proposed display · {names[variant]}</span>
								</div>
								{catalog
									.filter((c) =>
										`${c.group} ${c.query} ${JSON.stringify(c.filters)}`
											.toLowerCase()
											.includes(gallerySearch.toLowerCase()),
									)
									.map((c, i) => {
										const ts = [
											...tokens(c.filters, c.query),
											...(c.fingerprint ?? []).map((value) => ({
												kind: "fingerprint" as const,
												field: "Fingerprint",
												value: value.replace("Avoid ", ""),
												avoid: value.startsWith("Avoid "),
											})),
											...(c.residual
												? [
														{
															kind: "text" as const,
															field: "Search",
															value: c.residual,
														},
													]
												: []),
										]
										return (
											<div className="ir-gallery-row" key={i}>
												<div>
													<small>{c.group}</small>
													<p>“{c.query}”</p>
												</div>
												<div>
													{variant === "C" ? (
														<VariantC
															items={ts}
															open={open}
															expandedByDefault
														/>
													) : (
														<Component items={ts} open={open} />
													)}
												</div>
											</div>
										)
									})}
								<details className="ir-gallery-state">
									<summary>Current relevant state</summary>
									<pre>{JSON.stringify(state, null, 2)}</pre>
								</details>
							</div>
						</div>
					)}
				</div>,
				document.body,
			)
	return (
		<div className="ir-prototype ir-inline">
			<Component items={items} open={open} />
			{portaled}
		</div>
	)
}
