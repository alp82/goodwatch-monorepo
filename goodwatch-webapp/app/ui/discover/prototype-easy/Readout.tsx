// PROTOTYPE (discover-easy): how the search was read, under the shared search field in both modes. The typed words
// with the phrases that became filters marked, the text left to search by meaning, the fingerprint qualities the
// ranking wants or avoids, and every filter as a chip: × removes it, a tap opens it in Advanced.
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import type { CSSProperties, ReactNode } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { BarChip } from "~/ui/discover-bar/chips"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { interpreted } from "./ProtoSearch"

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-1 items-start gap-1 lg:grid-cols-[104px_1fr] lg:gap-3">
			<span className="lg:pt-1.5 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">{label}</span>
			<div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
		</div>
	)
}

/** The typed sentence, with each phrase the interpreter used marked. */
function Asked({ typed, phrases }: { typed: string; phrases: string[] }) {
	const lower = typed.toLowerCase()
	const marks: [number, number][] = []
	for (const p of phrases) {
		const at = lower.indexOf(p.toLowerCase())
		if (at >= 0 && !marks.some(([a, b]) => at < b && at + p.length > a)) marks.push([at, at + p.length])
	}
	marks.sort((a, b) => a[0] - b[0])
	const parts: ReactNode[] = []
	let i = 0
	for (const [a, b] of marks) {
		if (a > i) parts.push(<span key={`t${i}`}>{typed.slice(i, a)}</span>)
		parts.push(
			<mark key={`m${a}`} className="rounded bg-amber-400/15 px-0.5 text-amber-200 underline decoration-amber-400/60 underline-offset-4" title="Became a filter">
				{typed.slice(a, b)}
			</mark>,
		)
		i = b
	}
	if (i < typed.length) parts.push(<span key="end">{typed.slice(i)}</span>)
	return <span className="search-private text-[15px] text-gray-200">{parts}</span>
}

export function Readout({
	query,
	reading,
	chips,
	onRemove,
	onOpen,
	onCustomize,
	easy,
}: {
	query: string | null
	reading: ReadingChip[] | undefined
	chips: readonly BarChip[]
	onRemove: (chip: BarChip) => void
	onOpen: (chip: BarChip) => void
	onCustomize: () => void
	easy: boolean
}) {
	const filters = chips.filter((c) => c.kind !== "query")
	const words = query !== null ? interpreted.get(query) : undefined
	const phrases = words?.result.appliedPhrases.map((p) => p.phrase) ?? []
	const qualities = (reading ?? []).filter((t) => (t.kind === "want" || t.kind === "avoid") && t.key)
	if (query === null && !filters.length) return null
	return (
		<div className="mt-3 rounded-[22px] bg-white/[0.025] px-4 py-3.5 ring-1 ring-white/[0.07] lg:px-6">
			<div className="grid gap-2.5">
				{words && phrases.length > 0 && (
					<Row label="You asked">
						<Asked typed={words.typed} phrases={phrases} />
					</Row>
				)}
				{query !== null && (
					<Row label="Looks for">
						<span className="search-private text-[15px] font-semibold text-white">“{query}”</span>
						<span className="text-xs text-gray-500">by meaning, in plots and reviews</span>
					</Row>
				)}
				{query !== null && (
					<Row label="Fingerprint">
						{qualities.length ? (
							qualities.map((t, i) => {
								const meta = getFingerprintMeta(t.key!)
								const avoid = t.kind === "avoid"
								return (
									<span
										key={`${t.key}:${i}`}
										title={avoid ? "Ranked lower" : "Ranked higher"}
										className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold ring-1 ${
											avoid ? "text-gray-400 ring-white/10" : "text-white ring-[var(--q)]/40"
										}`}
										style={{ "--q": meta.color, background: avoid ? undefined : `color-mix(in srgb, ${meta.color} 16%, transparent)` } as CSSProperties}
									>
										<span className="h-2 w-2 rounded-full" style={{ background: avoid ? "transparent" : meta.color, boxShadow: avoid ? `inset 0 0 0 1.5px ${meta.color}` : undefined }} />
										{avoid && <span className="font-normal text-gray-500">less</span>}
										{meta.label}
									</span>
								)
							})
						) : (
							<span className="text-[13px] text-gray-500">{reading ? "No strong qualities in these words" : "Reading…"}</span>
						)}
					</Row>
				)}
				<Row label="Filters">
					{filters.map((chip) => (
						<span key={chip.key} className="inline-flex items-center rounded-full bg-white/[0.06] ring-1 ring-white/10 transition hover:bg-white/[0.1]">
							<button
								type="button"
								onClick={() => onOpen(chip)}
								title="Change in Advanced"
								className="flex cursor-pointer items-center gap-1.5 py-1 pr-1 pl-3 text-[13px] font-semibold text-white"
							>
								{chip.hue && <span className="h-2 w-2 rounded-full" style={{ background: chip.hue }} />}
								{chip.image && <img src={chip.image} alt="" className="h-5 w-5 rounded-full object-cover" />}
								{chip.prefix && <span className="font-normal text-gray-400">{chip.prefix}</span>}
								{chip.label}
							</button>
							<button
								type="button"
								aria-label={`Remove ${chip.label}`}
								onClick={() => onRemove(chip)}
								className="mr-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
							>
								<XMarkIcon className="h-3.5 w-3.5" />
							</button>
						</span>
					))}
					{!filters.length && <span className="text-[13px] text-gray-500">None</span>}
					<button
						type="button"
						onClick={onCustomize}
						className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
					>
						<PlusIcon className="h-4 w-4" />
						{easy ? "Customize" : "Add filter"}
					</button>
				</Row>
			</div>
		</div>
	)
}
