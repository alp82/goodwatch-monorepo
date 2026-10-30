// For you and Sort as one pill, in Ready to watch's style. The pill keeps one width per size (ControlSize), so another
// sort moves nothing but the divider: both halves take their content plus half the free space, For you's content stays
// at the left end and the sort's at the right end, both halves' active states reach the divider, and the divider sits in
// the middle of the free space. The moved count isn't reserved; when it shows (full size, For you on), the pill grows
// by its slot. Below full size the sort shows its own icon and short name.
//
// A guest's For you shows a lock and opens You; a member without enough taste sees it disabled with the reason.
import { LockClosedIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type { ComponentProps } from "react"
import { SortControl } from "~/ui/filter-bar/controls"
import { compactCount } from "~/ui/filter-bar/labels"
import { Knob, TAP } from "~/ui/filter-bar/motion"
import type { ForYouControl } from "~/ui/filter-bar/types"
import { BaseLine, PILL_FOCUS, SEGMENT } from "./ReadyToWatch"
import { Tip, TipText } from "./Tip"
import type { ControlSize } from "./control-size"

/** The pill's width per size without the moved count (0: as wide as its content), fitting the longest sort name. */
const WIDTH: Record<ControlSize, number> = { 2: 349, 1: 225, 0: 0 }
/** The moved count's room when it shows: its text and the gap after it. */
const MOVED_SLOT = 46

export function ForYouSort({
	forYou,
	sort,
	size,
	locked,
	onLocked,
}: {
	forYou: ForYouControl
	sort: ComponentProps<typeof SortControl>
	size: ControlSize
	/** A guest: For you needs an account. */
	locked: boolean
	onLocked: () => void
}) {
	const lit = forYou.on && !forYou.disabled && !locked
	const moved = lit && size === 2 ? forYou.movedUp : 0
	const chosen = sort.options.find((o) => o.key === sort.value)?.label ?? ""
	const width = WIDTH[size] ? WIDTH[size] + (moved ? MOVED_SLOT : 0) : undefined
	const tip = locked
		? "Sign up to rank titles by your taste"
		: forYou.disabled
			? (forYou.hint ?? "Rate a few more titles you love")
			: "Titles that fit your taste rise; nothing is hidden"
	return (
		<div
			className="flex h-10 shrink-0 rounded-xl bg-white/[0.04] ring-1 ring-white/10"
			style={width ? { width } : undefined}
		>
			<Tip
				off={size === 2 && !locked && !forYou.disabled}
				grow
				tip={
					<TipText name="For you" on={locked ? undefined : lit} line={tip} />
				}
			>
				<motion.button
					type="button"
					role={locked ? undefined : "switch"}
					aria-checked={locked ? undefined : lit}
					aria-disabled={forYou.disabled || undefined}
					aria-label="For you"
					whileTap={forYou.disabled ? undefined : TAP}
					onClick={() =>
						locked
							? onLocked()
							: !forYou.disabled && forYou.onChange(!forYou.on)
					}
					className={`${SEGMENT} flex-auto justify-start gap-2 rounded-l-xl ${PILL_FOCUS} ${size === 0 ? "pr-2 pl-3" : "pr-2.5 pl-3.5"} ${
						forYou.disabled
							? "cursor-not-allowed text-gray-500"
							: lit
								? "text-white"
								: "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200"
					}`}
				>
					{locked ? (
						<LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
					) : (
						<FingerPrintIcon
							className={`h-4 w-4 shrink-0 ${lit ? "text-amber-400" : "text-gray-500"}`}
						/>
					)}
					{size === 2 && <span className="text-sm">For you</span>}
					{moved > 0 && (
						<span
							className="text-xs tabular-nums text-amber-300"
							style={{ width: MOVED_SLOT - 8 }}
							title={`${moved.toLocaleString("en")} moved up`}
						>
							<span aria-hidden>↑{compactCount(moved)}</span>
							<span className="sr-only">
								{moved.toLocaleString("en")} moved up
							</span>
						</span>
					)}
					<Knob on={lit} />
					<BaseLine on={lit} color="bg-amber-400" />
				</motion.button>
			</Tip>
			<span className="my-2.5 w-px shrink-0 bg-white/10" aria-hidden />
			<Tip
				off={size > 0}
				grow
				align="end"
				tip={<TipText name={`Sort: ${chosen}`} />}
			>
				<div
					className={`flex flex-auto [&>div]:flex [&>div]:w-full [&_[data-sort-button]]:h-10 [&_[data-sort-button]]:w-full [&_[data-sort-button]]:justify-end [&_[data-sort-button]]:rounded-l-none [&_[data-sort-button]]:rounded-r-xl [&_[data-sort-button]>span.relative]:flex-none ${
						size === 2
							? "[&_[data-sort-button]]:pl-2.5"
							: size === 1
								? "[&_[data-sort-button]>span.text-gray-400]:hidden [&_[data-sort-button]]:pr-3 [&_[data-sort-button]]:pl-2.5"
								: "[&_[data-sort-button]>span]:hidden [&_[data-sort-button]]:px-3"
					}`}
				>
					<SortControl {...sort} bare short={size === 1} modeIcon={size < 2} />
				</div>
			</Tip>
		</div>
	)
}
