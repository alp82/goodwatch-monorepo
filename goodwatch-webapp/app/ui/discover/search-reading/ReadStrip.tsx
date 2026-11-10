// The read strip under Discover's search field while searching (docs/implementation/search-preferences.md).
//
// One row, in groups:
// 1. What was read from the words, grouped by field. The field's label ("Mood") stands outside the values, so a
//    hover or focus lights only the value; it's dimmed only once every value of the group is switched off. Plain words
//    ("epic") have no label.
// 2. The fingerprint group: the fingerprint mark is its label, then at most three qualities. Exactly four show two and
//    "+2 more" (a "+1" would hide almost nothing); five or more show three and "+N more". "+N more" lays every quality
//    across the whole row, with Back; a press outside the row or Escape also goes back.
// 3. Your own filters, with their ×.
// Clear (or Restore) stays at the row's end, outside the part that scrolls.
import { ArrowLeftIcon, FingerPrintIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { BarChip } from "~/ui/discover-bar/chips"
import { Divider, Filter } from "~/ui/discover-bar/ReadingLine"
import type { ReadItem as Item } from "./read-items"
import { ClearRead, QualityMark, ReadToggle, qualitiesOf } from "./read-parts"
// prototype: search loading states (?loading=).
import { PrototypeStripStep, usePrototypeLoading } from "../prototype-search-loading/PrototypeSearchLoading"

export interface ReadProps {
	items: readonly Item[]
	reading: readonly ReadingChip[]
	chips: readonly BarChip[]
	pending: boolean
	onToggle: (item: Item) => void
	onAll: (off: boolean) => void
	onRemoveChip: (chip: BarChip) => void
	onOpenChip?: (chip: BarChip) => void
}

function manualChips(items: readonly Item[], chips: readonly BarChip[]) {
	const read = new Set(items.filter((item) => item.on).flatMap((item) => item.chipKeys))
	return chips.filter((chip) => chip.kind !== "query" && !read.has(chip.key))
}

/** How many qualities show folded: never a "+1". */
export function foldedCount(n: number): number {
	if (n <= 3) return n
	if (n === 4) return 2
	return 3
}

/** Consecutive items of one field, under one label. */
function groupsOf(items: readonly Item[]) {
	const groups: { field: string; items: Item[] }[] = []
	for (const item of items) {
		const last = groups.at(-1)
		if (last && last.field === item.field && item.field) last.items.push(item)
		else groups.push({ field: item.field, items: [item] })
	}
	return groups
}

function ReadGroup({ field, items, onToggle }: { field: string; items: Item[]; onToggle: (item: Item) => void }) {
	const live = items.some((item) => item.on && !item.aside)
	return (
		<span className="flex shrink-0 items-center gap-0.5" role="group" aria-label={field || undefined}>
			{field && (
				<span className={`pr-0.5 pl-1.5 text-[13px] leading-none ${live ? "text-[#92a5bf]" : "text-gray-600"}`} aria-hidden>
					{field}
				</span>
			)}
			{items.map((item) => (
				<ReadToggle key={item.phrase} item={item} showField={false} onToggle={() => onToggle(item)} className="h-7 text-[13px]" />
			))}
		</span>
	)
}

function FingerprintLabel() {
	return (
		<span className="flex shrink-0 items-center" title="Fingerprint: what the words switched on read as">
			<FingerPrintIcon className="h-4 w-4 text-amber-300/80" aria-hidden />
			<span className="sr-only">Fingerprint read:</span>
		</span>
	)
}

export function ReadStrip(p: ReadProps) {
	const qualities = qualitiesOf(p.reading)
	// prototype: variant D's step, null when nothing loads; undefined for the other variants.
	const prototypeLoading = usePrototypeLoading()
	const prototypeStep = prototypeLoading?.variant === "D" ? prototypeLoading.phase : undefined
	const manual = manualChips(p.items, p.chips)
	const [expanded, setOpen] = useState(false)
	// Animate only a switch between the two rows, never the first paint: a quick fade and a short slide (transform and
	// opacity only; MotionConfig's reducedMotion="user" on the page drops the slide for reduced motion).
	const switched = useRef(false)
	const setExpanded = (open: boolean) => {
		switched.current = true
		setOpen(open)
	}
	const enter = (from: number) =>
		switched.current ? { opacity: 0, x: from } : false
	const SWAP = { duration: 0.14, ease: [0.22, 1, 0.36, 1] } as const
	const row = useRef<HTMLDivElement>(null)
	const back = useRef<HTMLButtonElement>(null)
	const more = useRef<HTMLButtonElement>(null)
	const folded = foldedCount(qualities.length)
	const hidden = qualities.length - folded
	// Back to the grouped row: a press outside the row, or Escape. The press that opened it is already over when this
	// listens, so it can't close it again.
	useEffect(() => {
		if (!expanded) return
		back.current?.focus({ preventScroll: true })
		const down = (e: PointerEvent) => {
			if (!row.current?.contains(e.target as Node)) setExpanded(false)
		}
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setExpanded(false)
				requestAnimationFrame(() => more.current?.focus({ preventScroll: true }))
			}
		}
		window.addEventListener("pointerdown", down)
		window.addEventListener("keydown", key)
		return () => {
			window.removeEventListener("pointerdown", down)
			window.removeEventListener("keydown", key)
		}
	}, [expanded])
	// Fewer qualities than the fold (words switched off): nothing to unfold.
	useEffect(() => {
		if (expanded && hidden <= 0) setOpen(false)
	}, [expanded, hidden])
	if (!p.items.length && !qualities.length && !manual.length && !p.pending && !prototypeStep) return <div className="h-9 flex-1" />

	if (expanded)
		return (
			<motion.div
				key="expanded"
				initial={enter(12)}
				animate={{ opacity: 1, x: 0 }}
				transition={SWAP}
				ref={row}
				id="fingerprint-read"
				role="region"
				aria-label="Fingerprint read, all qualities"
				className="search-private ph-no-capture sentry-mask flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-x-3.5 gap-y-2 py-1"
			>
				<button
					ref={back}
					type="button"
					onClick={() => {
						setExpanded(false)
						requestAnimationFrame(() => more.current?.focus({ preventScroll: true }))
					}}
					className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md pr-2 pl-1 text-[13px] font-semibold text-gray-300 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<ArrowLeftIcon className="h-4 w-4" aria-hidden />
					Back
				</button>
				<FingerprintLabel />
				{qualities.map((chip, i) => (
					<QualityMark key={`${chip.key}:${i}`} chip={chip} />
				))}
			</motion.div>
		)

	return (
		<motion.div
			key="folded"
			initial={enter(-12)}
			animate={{ opacity: 1, x: 0 }}
			transition={SWAP}
			ref={row}
			className="search-private ph-no-capture sentry-mask flex h-9 min-w-0 flex-1 items-center gap-2"
		>
			{/* relative: the scroller is the containing block of the marks' sr-only labels (absolute), so they are
			    clipped with the strip; otherwise a long strip's labels widened the whole page on phones. */}
			<div className="relative flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none]">
				{/* prototype: variant D says the step at the strip's end instead. */}
				{prototypeStep === undefined && p.pending && !p.items.length && !qualities.length && (
					<span className="flex shrink-0 items-center gap-2 text-[12px] text-gray-500">
						<FingerPrintIcon className="h-4 w-4 animate-pulse text-amber-300/60" aria-hidden />
						Reading…
					</span>
				)}
				{groupsOf(p.items).map((group, i) => (
					<ReadGroup key={`${group.field}:${i}`} field={group.field} items={group.items} onToggle={p.onToggle} />
				))}
				{qualities.length > 0 && p.items.length > 0 && <Divider />}
				{qualities.length > 0 && (
					<span className="flex shrink-0 items-center gap-x-3.5" role="group" aria-label="Fingerprint read">
						<FingerprintLabel />
						{qualities.slice(0, folded).map((chip, i) => (
							<QualityMark key={`${chip.key}:${i}`} chip={chip} />
						))}
						{hidden > 0 && (
							<button
								ref={more}
								type="button"
								aria-expanded={false}
								aria-controls="fingerprint-read"
								onClick={() => setExpanded(true)}
								className="h-7 shrink-0 cursor-pointer rounded-md px-1.5 text-[13px] font-[650] text-gray-400 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								+{hidden} more
							</button>
						)}
					</span>
				)}
				{prototypeStep && <PrototypeStripStep phase={prototypeStep} />}
				{manual.length > 0 && <Divider />}
				{manual.length > 0 && (
					<span className="flex shrink-0 items-center gap-x-2">
						{manual.map((chip) => (
							<Filter key={chip.key} chip={chip} onOpen={p.onOpenChip && (() => p.onOpenChip?.(chip))} onRemove={() => p.onRemoveChip(chip)} />
						))}
					</span>
				)}
			</div>
			<ClearRead items={p.items} onAll={p.onAll} />
		</motion.div>
	)
}
