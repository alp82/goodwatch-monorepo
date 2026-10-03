// The desktop Filters sheet: 480 px from the right, a search field focused on open, the active filters (each one
// scrolls to its group, or comes off), the groups with live counts, and a footer with Clear all, the hidden count, and
// a live "Show N titles".
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useRef, useState } from "react"
import {
	FilterGroups,
	type FilterGroupsData,
	FilterSearchField,
} from "./FilterGroups"
import { type ActiveChip, FILTER_ACCENTS } from "./labels"
import { RollingNumber, TAP } from "./motion"
import type { FilterBarCounts } from "./types"
import { useModalDialog } from "./useModalDialog"

/** "Show N titles", counting as the state changes; it closes the sheet. */
export function ShowTitlesButton({
	counts,
	onClick,
	className = "",
}: {
	counts: FilterBarCounts | null
	onClick: () => void
	className?: string
}) {
	const n = counts?.total ?? null
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			className={`flex h-12 items-center justify-center gap-1.5 rounded-xl px-6 font-bold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${
				n === 0
					? "bg-gray-800"
					: "bg-linear-to-b from-amber-500 to-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_30px_-10px_rgba(217,119,6,.7)]"
			} ${className}`}
		>
			{n === null ? (
				"Show titles"
			) : n === 0 ? (
				"No titles match"
			) : (
				<>
					Show <RollingNumber value={n} /> {n === 1 ? "title" : "titles"}
				</>
			)}
		</motion.button>
	)
}

export function FiltersSheet({
	open,
	onClose,
	data,
	chips = [],
	onClear,
}: {
	open: boolean
	onClose: () => void
	data: FilterGroupsData
	/** The active filters, shown above the groups. */
	chips?: ActiveChip[]
	onClear: () => void
}) {
	const panel = useRef<HTMLElement>(null)
	const search = useRef<HTMLInputElement>(null)
	const titleId = useId()
	useModalDialog({ open, onClose, container: panel, initialFocus: search })
	return (
		<AnimatePresence>
			{open && (
				<>
					<motion.div
						aria-hidden
						className="fixed inset-0 z-[1001] bg-black/60 backdrop-blur-[3px]"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>
					<motion.aside
						// biome-ignore lint/a11y/useSemanticElements: an animated sheet with its own focus trap; <dialog> can't animate out
						ref={panel}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ type: "spring", stiffness: 380, damping: 40 }}
						className="fixed inset-y-0 right-0 z-[1002] flex w-full max-w-[480px] flex-col bg-gray-950 ring-1 ring-white/10 shadow-[-30px_0_80px_-20px_rgba(0,0,0,.9)]"
					>
						<SheetContent
							titleId={titleId}
							onClose={onClose}
							data={data}
							chips={chips}
							onClear={onClear}
							searchRef={search}
						/>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	)
}

// The group a chip's filter is set in. Content is part of the Age & content group, which the age limit names.
const groupOf = (chip: ActiveChip) =>
	chip.group === "content" ? "ageLimit" : chip.group

function SheetContent({
	titleId,
	onClose,
	data,
	chips,
	onClear,
	searchRef,
}: {
	titleId: string
	onClose: () => void
	data: FilterGroupsData
	chips: ActiveChip[]
	onClear: () => void
	searchRef: React.RefObject<HTMLInputElement>
}) {
	const [query, setQuery] = useState("")
	const scroller = useRef<HTMLDivElement>(null)
	// The group a chip was tapped for; it is scrolled to once the groups show it (a search may have hidden it).
	const [target, setTarget] = useState<{ group: string } | null>(null)
	useEffect(() => {
		if (!target) return
		const section = scroller.current
			?.querySelector(`#filter-group-${target.group}`)
			?.closest("section")
		if (!section) return
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		section.scrollIntoView({
			block: "start",
			behavior: still ? "auto" : "smooth",
		})
		section.animate(
			[
				{ backgroundColor: "rgba(255,255,255,.1)" },
				{ backgroundColor: "rgba(255,255,255,0)" },
			],
			{ duration: 1200, easing: "ease-out" },
		)
	}, [target])
	const goTo = (chip: ActiveChip) => {
		setQuery("")
		setTarget({ group: groupOf(chip) })
	}
	return (
		<>
			<header className="px-6 pt-6 pb-4">
				<div className="flex items-center justify-between">
					<h2 id={titleId} className="brand-header text-2xl text-white">
						Filters
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close filters"
						className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-gray-300 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
				<FilterSearchField
					value={query}
					onChange={setQuery}
					inputRef={searchRef}
					className="mt-4"
				/>
				{chips.length > 0 && (
					<ul
						aria-label="Active filters"
						// Three rows exactly (3 × 32 px + 2 × 6 px), so a fourth row never peeks in half.
						className="mt-3 flex max-h-[6.75rem] flex-wrap gap-1.5 overflow-y-auto"
					>
						{chips.map((chip) => (
							<li
								key={chip.key}
								className="flex h-8 items-center rounded-full bg-white/[0.06] text-sm text-gray-100 ring-1 ring-white/10"
							>
								<button
									type="button"
									onClick={() => goTo(chip)}
									aria-label={`Go to ${chip.label}`}
									className="flex h-8 items-center gap-2 rounded-l-full pr-1 pl-3 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<span
										className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`}
									/>
									{chip.label}
								</button>
								<button
									type="button"
									onClick={() => data.onChange(chip.remove(data.state))}
									aria-label={`Remove ${chip.label}`}
									className="grid h-8 w-7 place-items-center rounded-r-full text-gray-500 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<XMarkIcon className="h-3.5 w-3.5" />
								</button>
							</li>
						))}
					</ul>
				)}
			</header>
			<div
				ref={scroller}
				className="flex-1 scroll-pt-2 overflow-y-auto px-6 pt-2 pb-8"
			>
				<FilterGroups data={data} query={query} />
			</div>
			<footer className="flex items-center gap-4 border-t border-white/5 bg-gray-950/90 px-6 py-4 backdrop-blur">
				<button
					type="button"
					onClick={onClear}
					className="text-sm text-gray-400 cursor-pointer hover:text-white"
				>
					Clear all
				</button>
				<span className="flex-1 text-right text-xs tabular-nums text-gray-500">
					{data.counts?.hidden
						? `${data.counts.hidden.toLocaleString("en")} hidden`
						: ""}
				</span>
				<ShowTitlesButton counts={data.counts} onClick={onClose} />
			</footer>
		</>
	)
}
