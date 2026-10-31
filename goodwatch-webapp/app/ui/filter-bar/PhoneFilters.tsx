// Phones' filters on pages with a few filter groups (My movies, Watch next, a profile's Tropes), the B3 way: one quiet
// line of text in the page naming only the filters in use and the count ("No filters" with none), and one sheet
// holding every group, with Clear all on top and a Show button at the bottom. The groups are the page's own controls.
import { AdjustmentsHorizontalIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode, RefObject } from "react"
import { SnapSheet } from "./SnapSheet"
import { TAP } from "./motion"

/** The quiet line: "Filters · Tense, Funny · My services · 23 movies". Opens the sheet. */
export function FilterSummaryRow({
	active,
	count,
	open,
	onOpen,
	disabled,
}: {
	/** The filters in use, as short words; none says "No filters". */
	active: string[]
	/** What the filters leave, such as "23 movies". */
	count?: string
	open: boolean
	onOpen: () => void
	disabled?: boolean
}) {
	const words = active.length ? active.join(" · ") : "No filters"
	return (
		<div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:hidden">
			<button
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				disabled={disabled}
				onClick={onOpen}
				data-filter-summary
				className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer items-center gap-2 rounded-xl px-2 text-left text-sm active:bg-white/[0.05] disabled:cursor-default disabled:opacity-60"
			>
				<AdjustmentsHorizontalIcon
					className={`size-4 shrink-0 ${active.length ? "text-amber-300" : "text-gray-500"}`}
					aria-hidden
				/>
				<span
					className={`min-w-0 flex-1 truncate ${active.length ? "font-semibold text-gray-100" : "text-gray-400"}`}
				>
					{words}
				</span>
				{count && (
					<span className="shrink-0 tabular-nums text-gray-500">{count}</span>
				)}
			</button>
		</div>
	)
}

/** One group's heading inside the sheet, with an optional note or control at its end. */
export function FilterGroup({
	title,
	end,
	children,
}: {
	title: ReactNode
	end?: ReactNode
	children: ReactNode
}) {
	return (
		<section className="border-t border-white/[0.06] pt-3 first:border-t-0 first:pt-0">
			<div className="flex min-h-9 items-center gap-3 px-4 pb-2">
				<h3 className="min-w-0 flex-1 text-sm font-bold text-white">{title}</h3>
				{end}
			</div>
			{children}
		</section>
	)
}

/** The one sheet with all of a page's filter groups. */
export function FilterSheet({
	open,
	setOpen,
	canClear,
	onClear,
	show,
	initialFocus,
	children,
}: {
	open: boolean
	setOpen: (open: boolean) => void
	canClear: boolean
	onClear: () => void
	/** The bottom button's words: "Show 23 movies", or "Done". */
	show: string
	initialFocus?: RefObject<HTMLElement>
	children: ReactNode
}) {
	return (
		<SnapSheet
			index={open ? 0 : -1}
			onIndex={(index) => setOpen(index >= 0)}
			label="Filters"
			snaps={[0.78, 0.94]}
			initialFocus={initialFocus}
			header={
				<div className="flex min-h-11 items-center gap-3 px-4 pb-1">
					<h2 className="min-w-0 flex-1 text-base font-bold text-white">
						Filters
					</h2>
					{canClear && (
						<button
							type="button"
							onClick={onClear}
							data-clear-all
							className="min-h-11 shrink-0 cursor-pointer rounded-full px-2.5 text-sm font-semibold text-gray-200 hover:bg-white/10"
						>
							Clear all
						</button>
					)}
				</div>
			}
			footer={
				<div className="shrink-0 border-t border-white/10 bg-gray-950/95 px-4 pt-3 pb-4">
					<motion.button
						type="button"
						whileTap={TAP}
						onClick={() => setOpen(false)}
						data-drawer-done
						className="h-12 w-full cursor-pointer rounded-2xl bg-white text-base font-bold text-black outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{show}
					</motion.button>
				</div>
			}
		>
			<div className="flex flex-col gap-4 pt-1 pb-4">{children}</div>
		</SnapSheet>
	)
}
