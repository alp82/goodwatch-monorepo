// PROTOTYPE - throwaway (discover search preferences, see README.md). Three ways to show and control what the search
// read, in the reading line's place under Discover's search field (`?variant=A|B|C`). All three switch the same state
// (`off=<phrase>`), show your own filters, and leave the full list of read parts in the Matches popout.
// - A, Read strip: everything on one line in both modes. Read items, then the fingerprint qualities, then your own
//   filters; Clear stays at the end, outside the scrolling part.
// - B, Summary: one short sentence of what was read (each part still a switch), with Details to unfold the
//   fingerprint qualities, words set aside by your choices, and your filters, wrapped, not scrolled. Easy starts folded,
//   Advanced unfolded (`read=open|shut` overrides).
// - C, Adaptive: each read part as a marked token (a mood's color, a calendar for years, a speech mark for words); the
//   fingerprint qualities sit behind the fingerprint mark, with their descriptions. In Advanced, what the bar above
//   already shows (Mood, Watch) leaves the line, so it keeps only what the bar can't show.
import { ChevronDownIcon, FingerPrintIcon } from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import { useEffect, useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { BarChip } from "~/ui/discover-bar/chips"
import { Divider, Filter } from "~/ui/discover-bar/ReadingLine"
import type { Item } from "./interpretation"
import { ClearRead, ItemMarker, QualityMark, ReadToggle, itemTitle, qualitiesOf } from "./read-parts"

export const VARIANTS = { A: "Read strip", B: "Summary + details", C: "Adaptive tokens" } as const
export type ReadVariant = keyof typeof VARIANTS

export interface ReadProps {
	variant: ReadVariant
	items: readonly Item[]
	reading: readonly ReadingChip[]
	chips: readonly BarChip[]
	pending: boolean
	advanced: boolean
	onToggle: (item: Item) => void
	onAll: (off: boolean) => void
	onRemoveChip: (chip: BarChip) => void
	onOpenChip?: (chip: BarChip) => void
}

function manualChips(items: readonly Item[], chips: readonly BarChip[]) {
	const read = new Set(items.filter((item) => item.on).flatMap((item) => item.chipKeys))
	return chips.filter((chip) => chip.kind !== "query" && !read.has(chip.key))
}

function Mark({ pending }: { pending?: boolean }) {
	return (
		<span className="flex shrink-0 items-center" title="How your search was read">
			<FingerPrintIcon className={`h-4 w-4 text-amber-300/80 ${pending ? "animate-pulse" : ""}`} aria-hidden />
			<span className="sr-only">How your search was read:</span>
		</span>
	)
}

function Manual({ chips, onRemoveChip, onOpenChip }: Pick<ReadProps, "onRemoveChip" | "onOpenChip"> & { chips: BarChip[] }) {
	return (
		<>
			{chips.map((chip) => (
				<Filter key={chip.key} chip={chip} onOpen={onOpenChip && (() => onOpenChip(chip))} onRemove={() => onRemoveChip(chip)} />
			))}
		</>
	)
}

function Toggles({ items, onToggle, marker = false }: { items: readonly Item[]; onToggle: (item: Item) => void; marker?: boolean }) {
	return (
		<>
			{items.map((item, i) => (
				<ReadToggle
					key={item.phrase}
					item={item}
					marker={marker}
					showField={!marker && (i === 0 || items[i - 1].field !== item.field)}
					onToggle={() => onToggle(item)}
					className="h-7 text-[13px]"
				/>
			))}
		</>
	)
}

// A: one line, scrolling sideways when long; Clear outside the scroll so it reads as the whole line's.
function Strip(p: ReadProps) {
	const qualities = qualitiesOf(p.reading)
	const manual = manualChips(p.items, p.chips)
	return (
		<div className="search-private ph-no-capture sentry-mask flex h-9 min-w-0 flex-1 items-center gap-2">
			<Mark pending={p.pending} />
			<div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none]">
				{p.items.length > 0 && (
					<span className="flex shrink-0 items-center gap-0.5">
						<Toggles items={p.items} onToggle={p.onToggle} />
					</span>
				)}
				{qualities.length > 0 && p.items.length > 0 && <Divider />}
				{qualities.length > 0 && (
					<span className="flex shrink-0 items-center gap-x-3.5" title="What the words switched on read as">
						{qualities.map((chip, i) => (
							<QualityMark key={`${chip.key}:${i}`} chip={chip} />
						))}
					</span>
				)}
				{manual.length > 0 && <Divider />}
				<span className="flex shrink-0 items-center gap-x-2">
					<Manual chips={manual} onRemoveChip={p.onRemoveChip} onOpenChip={p.onOpenChip} />
				</span>
			</div>
			<ClearRead items={p.items} onAll={p.onAll} />
		</div>
	)
}

// B: a folded sentence; Details unfolds the rest, wrapped onto lines of its own.
function Summary(p: ReadProps) {
	const [params, setParams] = useSearchParams()
	const read = params.get("read")
	const open = read ? read === "open" : p.advanced
	const toggleOpen = () => {
		const next = new URLSearchParams(params)
		next.set("read", open ? "shut" : "open")
		setParams(next, { replace: true, preventScrollReset: true })
	}
	const qualities = qualitiesOf(p.reading)
	const manual = manualChips(p.items, p.chips)
	const main = p.items.filter((item) => !item.aside)
	const aside = p.items.filter((item) => item.aside)
	const more = qualities.length + aside.length + manual.length
	return (
		<div className="search-private ph-no-capture sentry-mask min-w-0 flex-1">
			<div className="flex min-h-9 min-w-0 items-center gap-2">
				<Mark pending={p.pending} />
				<p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-1 text-[13px] leading-none text-gray-400">
					<span className="mr-1 shrink-0">Read as</span>
					{main.map((item, i) => (
						<span key={item.phrase} className="inline-flex items-center">
							<ReadToggle item={item} showField={false} onToggle={() => p.onToggle(item)} className="h-7 text-[13px]" />
							{i < main.length - 1 && <span className="text-gray-600" aria-hidden>·</span>}
						</span>
					))}
					{!main.length && <span>nothing yet</span>}
				</p>
				{more > 0 && (
					<button
						type="button"
						aria-expanded={open}
						onClick={toggleOpen}
						className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-gray-400 hover:bg-white/[0.06] hover:text-white"
					>
						Details
						<ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
					</button>
				)}
				<ClearRead items={p.items} onAll={p.onAll} />
			</div>
			{open && more > 0 && (
				<div className="mt-1 mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-amber-300/25 pl-3 text-[13px]">
					{qualities.length > 0 && (
						<span className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
							{qualities.map((chip, i) => (
								<QualityMark key={`${chip.key}:${i}`} chip={chip} />
							))}
						</span>
					)}
					{aside.map((item) => (
						<ReadToggle key={item.phrase} item={item} onToggle={() => {}} className="h-7 text-[13px]" />
					))}
					{manual.length > 0 && (
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<Manual chips={manual} onRemoveChip={p.onRemoveChip} onOpenChip={p.onOpenChip} />
						</span>
					)}
				</div>
			)}
		</div>
	)
}

function FingerprintButton({ qualities, pending }: { qualities: ReadingChip[]; pending: boolean }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", down)
		window.addEventListener("keydown", key)
		return () => {
			window.removeEventListener("pointerdown", down)
			window.removeEventListener("keydown", key)
		}
	}, [open])
	return (
		<div ref={ref} className="relative shrink-0">
			<button
				type="button"
				aria-expanded={open}
				aria-label={`Fingerprint read, ${qualities.length} qualities`}
				onClick={() => setOpen(!open)}
				className="flex h-8 cursor-pointer items-center gap-1 rounded-full bg-amber-300/[0.08] pr-2.5 pl-2 text-[12px] font-bold text-amber-200 ring-1 ring-amber-300/20 hover:bg-amber-300/[0.14]"
			>
				<FingerPrintIcon className={`h-4 w-4 ${pending ? "animate-pulse" : ""}`} aria-hidden />
				<span className="tabular-nums">{qualities.length}</span>
			</button>
			{open && (
				<div className="fixed inset-x-2 bottom-24 z-[60] rounded-2xl bg-gray-900 p-3.5 shadow-2xl ring-1 ring-white/15 lg:absolute lg:inset-x-auto lg:bottom-auto lg:left-0 lg:top-full lg:mt-2 lg:w-[340px]">
					<p className="text-[13px] font-bold text-white">What the words read as</p>
					<p className="mt-0.5 text-[12px] text-gray-500">From the words switched on. They change together when you switch words off.</p>
					<ul className="mt-2.5 flex flex-col gap-2">
						{qualities.map((chip, i) => (
							<li key={`${chip.key}:${i}`} className="flex items-start gap-3">
								<span className="w-[132px] shrink-0 pt-px"><QualityMark chip={chip} /></span>
								<span className="text-[12px] leading-snug text-gray-400">{chip.description}</span>
							</li>
						))}
						{!qualities.length && <li className="text-[12px] text-gray-500">Nothing read: every word is switched off.</li>}
					</ul>
				</div>
			)}
		</div>
	)
}

// C: marked tokens to scan; the fingerprint behind its mark; Advanced keeps only what the bar can't show.
function Adaptive(p: ReadProps) {
	const qualities = qualitiesOf(p.reading)
	const manual = manualChips(p.items, p.chips)
	const inBar = (item: Item) => p.advanced && !item.words && !item.aside && item.group !== null
	const tokens = p.items.filter((item) => !inBar(item))
	const hidden = p.items.filter(inBar)
	return (
		<div className="search-private ph-no-capture sentry-mask flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1.5">
			<FingerprintButton qualities={qualities} pending={p.pending} />
			{tokens.map((item) => (
				<ReadToggle
					key={item.phrase}
					item={item}
					marker
					onToggle={() => p.onToggle(item)}
					className="h-8 rounded-full bg-white/[0.045] px-3 text-[13px] ring-1 ring-white/10"
				/>
			))}
			{hidden.length > 0 && (
				<span className="px-1 text-[12px] text-gray-500" title={hidden.map(itemTitle).join("\n")}>
					+{hidden.length} in the bar above
				</span>
			)}
			{manual.length > 0 && !p.advanced && (
				<span className="flex flex-wrap items-center gap-x-2 pl-1">
					<Manual chips={manual} onRemoveChip={p.onRemoveChip} onOpenChip={p.onOpenChip} />
				</span>
			)}
			<ClearRead items={p.items} onAll={p.onAll} className="ml-auto" />
		</div>
	)
}

export function ReadView(p: ReadProps) {
	if (!p.items.length && !p.reading.length && !manualChips(p.items, p.chips).length && !p.pending)
		return <div className="h-9 flex-1" />
	if (p.variant === "B") return <Summary {...p} />
	if (p.variant === "C") return <Adaptive {...p} />
	return <Strip {...p} />
}

export { ItemMarker }
