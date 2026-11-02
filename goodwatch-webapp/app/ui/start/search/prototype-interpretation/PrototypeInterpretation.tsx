// THROWAWAY UI question: three structurally different interpretation readouts
// on the real start page, switchable by ?variant=B1|B2|B3. No saved state/mutations.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "@remix-run/react"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { catalog, examples, denseExample, tokens, type Token } from "./data"
import { SoftChips, ColorNotes, TwoDirections } from "./GroupedStyles"
import "./prototype.css"

const names: Record<string, string> = {
	B1: "Soft color chips",
	B2: "Color notes",
	B3: "Two directions",
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
	const rawVariant = params.get("variant") ?? "B1"
	const variant =
		({ A: "B1", B: "B1", C: "B3" } as Record<string, string>)[rawVariant] ??
		rawVariant
	const dense = query === denseExample.query
	useEffect(() => {
		if (params.get("example") === "dense" && !params.has("q"))
			onExample(denseExample.query)
	}, [])
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
		enabled: query.length > 1 && !dense,
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
		!query || query.toLowerCase() !== example.query.toLowerCase()
			? { filters: {}, residual: query, fingerprint: [] }
			: example
	const fields = dense
		? denseExample.filters
		: result.data
			? Object.fromEntries(new URLSearchParams(result.data.params))
			: fallback.filters
	const remaining = dense
		? ""
		: (result.data?.residual ?? fallback.residual ?? "")
	const filterTokens = tokens(fields, query)
	const actual = (dense ? [] : (reading ?? [])).filter(
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
		source: dense
			? "Dense review fixture"
			: result.data
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
		const keys = ["B1", "B2", "B3"]
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
		variant === "B2" ? ColorNotes : variant === "B3" ? TwoDirections : SoftChips
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
										(selected.kind === "fingerprint"
											? selected.avoid
												? "An avoided fingerprint preference, not a verified hard exclusion."
												: "A soft fingerprint preference used in ranking."
											: "The displayed value is the interpreted filter, not the original search phrase.")}
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
													<Component items={ts} open={open} />
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
			{dense && (
				<div className="ir-density-note">
					Density example{" "}
					<span>
						{filterTokens.length} filters · {fingerprint.length} fingerprint
						qualities
					</span>
				</div>
			)}
			<Component items={items} open={open} />
			{portaled}
		</div>
	)
}
