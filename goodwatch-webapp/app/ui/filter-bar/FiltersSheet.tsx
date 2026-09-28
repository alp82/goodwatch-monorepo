// The desktop Filters sheet: 480 px from the right, a search field focused on open, the groups with live counts, and
// a footer with Clear all, the hidden count, and a live "Show N titles".
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useId, useRef, useState } from "react"
import {
	FilterGroups,
	type FilterGroupsData,
	FilterSearchField,
} from "./FilterGroups"
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
	onClear,
}: {
	open: boolean
	onClose: () => void
	data: FilterGroupsData
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
							onClear={onClear}
							searchRef={search}
						/>
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	)
}

function SheetContent({
	titleId,
	onClose,
	data,
	onClear,
	searchRef,
}: {
	titleId: string
	onClose: () => void
	data: FilterGroupsData
	onClear: () => void
	searchRef: React.RefObject<HTMLInputElement>
}) {
	const [query, setQuery] = useState("")
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
			</header>
			<div className="flex-1 overflow-y-auto px-6 pt-2 pb-8">
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
