// PROTOTYPE - throwaway. Variant B, "Results ledger": the results explain themselves. Above the grid one panel says how
// many titles there are and lets the person view only the titles tagged with the filters the words were read as (the
// tighter reading the search used before: a view of the same list, not a filter, and not a check of every word).
// Below it, one row per word with Prefer | Require, the count each gives, and Remove. The grid is
// sectioned under Top rated (two shelves) and marks tagged titles under Relevance. The reading line stays Discover's.
import { CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { GROUP_FIELD, type Readout, type Word, relaxWord, removeWord, requireWord, resetToWords } from "./model"
import { NotChip, PREF, REQUIRED, WhatIf, useGo, useParams, wordKey } from "./parts"
import { tagged } from "./VariantA"

function Segmented({
	value,
	options,
	label,
}: {
	value: string
	label: string
	options: { key: string; label: string; count?: React.ReactNode; onPick: () => void; disabled?: boolean }[]
}) {
	return (
		<span role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-full bg-white/[0.04] p-0.5 ring-1 ring-white/10">
			{options.map((o) => (
				<button
					key={o.key}
					type="button"
					role="radio"
					aria-checked={value === o.key}
					disabled={o.disabled}
					onClick={o.onPick}
					className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold disabled:cursor-default disabled:opacity-40 ${value === o.key ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
				>
					{o.label}
					{o.count !== undefined && <span className="font-normal text-gray-400 tabular-nums">{o.count}</span>}
				</button>
			))}
		</span>
	)
}

function WordRow({ w, kind, r }: { w: Word; kind: "pref" | "pinned" | "strict"; r: Readout }) {
	const params = useParams()
	const go = useGo()
	const field = w.group ? GROUP_FIELD[w.group].field : "Filter"
	const prefer = kind === "pref"
	const canSwitch = kind !== "strict" && w.group !== null
	const where =
		kind === "pinned"
			? w.phrase
				? "Required by you · stays when the search changes"
				: `Picked in ${GROUP_FIELD[w.group ?? "genres"].tab} · stays when the search changes`
			: kind === "strict"
				? w.why
				: "Lifts titles that fit · removes none"
	return (
		<li className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t border-white/[0.06] py-2.5 first:border-t-0 sm:grid-cols-[minmax(7rem,10rem)_1fr_auto_auto]">
			<span className="text-[13px] text-gray-300">{w.phrase ? `“${w.phrase}”` : <span className="text-gray-500">{kind === "pinned" ? "not in your words" : "read from your words"}</span>}</span>
			<span className="order-3 col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 sm:order-none sm:col-span-1">
				<span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-[650] ${prefer ? PREF : REQUIRED}`}>
					<span className="font-normal opacity-70">{field}</span> {w.label}
				</span>
				<span className="text-[12px] text-gray-500">{where}</span>
			</span>
			{canSwitch ? (
				<Segmented
					label={`${w.label}: prefer or require`}
					value={prefer ? "prefer" : "require"}
					options={[
						{ key: "prefer", label: "Prefer", count: prefer ? undefined : <WhatIf next={relaxWord(params, w)} />, onPick: () => !prefer && go(relaxWord(params, w)) },
						{ key: "require", label: "Require", count: prefer ? <WhatIf next={requireWord(params, w)} /> : undefined, onPick: () => prefer && go(requireWord(params, w)) },
					]}
				/>
			) : (
				<span className="text-[12px] font-semibold text-gray-400">Required</span>
			)}
			<span className="hidden sm:block">
				{w.phrase && kind !== "pinned" ? (
					<button type="button" aria-label={`Remove “${w.phrase}” from the search`} title="Remove the word" onClick={() => go(removeWord(params, w.phrase as string))} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-white/10 hover:text-white">
						<XMarkIcon className="h-4 w-4" aria-hidden />
					</button>
				) : (
					<span className="block w-7" />
				)}
			</span>
		</li>
	)
}

export function VariantBLedger({ r, sort }: { r: Readout; sort: string }) {
	const params = useParams()
	const go = useGo()
	const [open, setOpen] = useState(true)
	const strict = params.get("strict") === "1"
	const tiers = r.branch === "positive" && !r.catalogue && r.prefs.length > 0
	const setStrict = (on: boolean) => {
		const next = new URLSearchParams(params)
		if (on) next.set("strict", "1")
		else next.delete("strict")
		go(next, true)
	}
	const rows = [
		...r.prefs.map((w) => ({ w, kind: "pref" as const })),
		...r.pinned.map((w) => ({ w, kind: "pinned" as const })),
		...r.searchStrict.map((w) => ({ w, kind: "strict" as const })),
	]
	const shown = strict ? r.originalInList : r.total
	return (
		<section aria-label="How your search is used" className="search-private mt-4 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/10 lg:px-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-[15px] text-white">
					<strong className="tabular-nums">{shown.toLocaleString("en")}</strong> {shown === 1 ? "title" : "titles"} for “{r.query}”
					{tiers && !strict && (
						<span className="text-gray-400">
							{" "}
							· {r.originalInList.toLocaleString("en")} {tagged(r)}
						</span>
					)}
				</p>
				{tiers && (
					<Segmented
						label="Which titles"
						value={strict ? "strict" : "broad"}
						options={[
							{ key: "broad", label: "Fits your words", count: r.total.toLocaleString("en"), onPick: () => setStrict(false) },
							{ key: "strict", label: `Tagged ${r.prefs.map((p) => p.label).join(" + ")}`, count: r.originalInList.toLocaleString("en"), onPick: () => setStrict(true), disabled: r.originalInList === 0 },
						]}
					/>
				)}
			</div>
			<p className="mt-1 text-[12px] leading-snug text-gray-400">
				{strict
					? `Only the ${r.originalInList.toLocaleString("en")} titles ${tagged(r)}: the tighter reading this search used before. Tags come from title data, so a tagged title isn't always what you meant. Nothing is required; your words stay preferences.`
					: r.how}
				{sort === "top" && tiers && !strict && " Top rated lists the tagged titles first, then the rest by rating."}
			</p>
			{(rows.length > 0 || r.negative.length > 0 || r.setAside.length > 0) && (
				<>
					<button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-gray-300 hover:text-white">
						How each word is used
						<ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
					</button>
					{open && (
						<ul className="mt-1">
							{rows.map(({ w, kind }) => (
								<WordRow key={`${kind}:${wordKey(w)}`} w={w} kind={kind} r={r} />
							))}
							{r.negative.map((n) => (
								<li key={n} className="flex items-center gap-3 border-t border-white/[0.06] py-2.5">
									<NotChip clause={n} />
									<span className="text-[12px] text-gray-500">Handled as before, from title data, so it isn't guaranteed.</span>
								</li>
							))}
							{r.setAside.map((s) => (
								<li key={s.phrase} className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] py-2.5">
									<span className="text-[13px] text-gray-500 line-through">“{s.phrase}”</span>
									<span className="text-[12px] text-gray-500">Not used: your {GROUP_FIELD[s.by.group ?? "genres"].field} {s.by.label} choice wins.</span>
								</li>
							))}
						</ul>
					)}
					{r.pinned.some((w) => w.phrase) && (
						<button type="button" onClick={() => go(resetToWords(params, r))} className="mt-1 cursor-pointer text-[12px] font-semibold text-amber-400 hover:text-amber-300">
							Turn required words back into preferences
						</button>
					)}
				</>
			)}
		</section>
	)
}

/** Relevance: a small mark on the tagged titles. */
export function VariantBMark({ tagged }: { tagged: boolean }) {
	if (!tagged) return null
	return (
		<span className="pointer-events-none absolute top-1.5 left-1.5 z-20 flex h-6 items-center gap-0.5 rounded-full bg-gray-950/85 px-1.5 text-[11px] font-bold text-sky-100 ring-1 ring-sky-300/40">
			<CheckIcon className="h-3.5 w-3.5" aria-hidden />
			<span className="sr-only">Tagged with your preferences</span>
			<span aria-hidden className="hidden sm:inline">Tags</span>
		</span>
	)
}

export function VariantBShelf({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="mt-6 mb-3 flex flex-wrap items-baseline gap-x-3 first:mt-0">
			<h2 className="text-[17px] font-bold text-white">{title}</h2>
			<span className="text-[13px] text-gray-400">{detail}</span>
		</div>
	)
}
