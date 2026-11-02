// PROTOTYPE (discover-easy): For you over Sort, split horizontally into two rows, right of the search bar in both
// modes and as tall as it. Styles: card (one box, a line between), labels (bar-style small caps labels), pills (two
// separate pills), attached (no box of its own: it sits inside the search bar, after a vertical line).
import { LockClosedIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import type { ComponentProps } from "react"
import { SortControl } from "~/ui/filter-bar/controls"
import { Knob } from "~/ui/filter-bar/motion"
import type { ForYouControl } from "~/ui/filter-bar/types"

export type StackStyle = "card" | "labels" | "pills" | "attached"

export interface StackProps {
	forYou?: ForYouControl
	sort: ComponentProps<typeof SortControl>
	locked: boolean
	onLocked: () => void
	phone: boolean
	style: StackStyle
}

const SORT_FILL =
	"flex min-w-0 flex-1 justify-end [&>div]:flex [&>div]:w-full [&_[data-sort-button]]:h-full [&_[data-sort-button]]:w-full [&_[data-sort-button]]:justify-end [&_[data-sort-button]]:rounded-none [&_[data-sort-button]]:bg-transparent [&_[data-sort-button]]:px-0"

export function ForYouStack({ forYou, sort, locked, onLocked, phone, style }: StackProps) {
	const lit = !!forYou && forYou.on && !forYou.disabled && !locked
	const labels = style === "labels"
	const pills = style === "pills"
	const row = `flex min-h-0 flex-1 items-center gap-2 ${phone ? "px-3" : "px-4"} ${pills ? "rounded-full bg-white/[0.045] ring-1 ring-white/10" : ""}`
	const forYouRow = forYou && (
		<button
			type="button"
			role={locked ? undefined : "switch"}
			aria-checked={locked ? undefined : lit}
			aria-label="For you"
			onClick={() => (locked ? onLocked() : !forYou.disabled && forYou.onChange(!forYou.on))}
			className={`${row} cursor-pointer text-left ${lit ? "text-white" : "text-gray-400 hover:text-gray-200"} ${pills ? "" : "hover:bg-white/[0.04]"}`}
		>
			{labels ? (
				<span className="w-14 shrink-0 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">For you</span>
			) : locked ? (
				<LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
			) : (
				<FingerPrintIcon className={`h-4 w-4 shrink-0 ${lit ? "text-amber-400" : "text-gray-500"}`} />
			)}
			{!labels && !phone && <span className="text-sm font-semibold">For you</span>}
			{labels && locked && <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />}
			<span className="ml-auto">
				<Knob on={lit} />
			</span>
		</button>
	)
	const sortRow = (
		<div className={`${row} ${pills ? "" : "hover:bg-white/[0.04]"}`}>
			{labels && <span className="w-14 shrink-0 text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase">Sort</span>}
			<div className={`${SORT_FILL} ${labels || phone ? "[&_[data-sort-button]>span.text-gray-400]:hidden" : ""}`}>
				<SortControl {...sort} bare short={phone} modeIcon align="right" />
			</div>
		</div>
	)
	const h = phone ? "h-[62px]" : "h-[76px]"
	const w = phone ? "w-[132px]" : labels ? "w-[236px]" : "w-[212px]"
	if (pills)
		return (
			<div className={`flex ${h} ${w} shrink-0 flex-col gap-1.5`}>
				{forYouRow}
				{sortRow}
			</div>
		)
	const boxed = style !== "attached"
	return (
		<div
			className={`flex ${h} ${w} shrink-0 flex-col ${
				boxed
					? `overflow-hidden ${phone ? "rounded-[22px]" : "rounded-[28px]"} bg-white/[0.045] ring-1 ring-white/10`
					: "border-l border-white/10"
			} [&>*:first-child]:border-b [&>*:first-child]:border-white/[0.07]`}
		>
			{forYouRow}
			{sortRow}
		</div>
	)
}
