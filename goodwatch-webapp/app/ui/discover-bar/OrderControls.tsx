// Ready to watch, For you and Sort. Ready to watch is one switch: on it means My services, and Not seen yet for members.
// It only ever toggles. For you joins Sort in Advanced, sliding in where it sits.
import { LockClosedIcon, PlayCircleIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type { ComponentProps, ReactNode } from "react"
import type { FilterState } from "~/domain/filter-state"
import { SortControl } from "~/ui/filter-bar/controls"
import type { SortOption } from "~/ui/filter-bar/labels"
import { Knob } from "~/ui/filter-bar/motion"
import type { ForYouControl } from "~/ui/filter-bar/types"

export interface SortChoice {
	options: SortOption[]
	value: string
	onChange: (sort: string) => void
	footnote?: string
	/** The way in to the sorts that need taste, for a viewer without an account. */
	signUp?: ReactNode
}

export const isReady = (state: FilterState, member: boolean) =>
	state.onMyServices && (!member || state.notSeenYet)

export function readyTo(on: boolean, member: boolean) {
	return (state: FilterState): FilterState => {
		const services = {
			...state,
			onMyServices: on,
			anyService: undefined,
			services: undefined,
		}
		if (!member) return services
		return {
			...services,
			notSeenYet: on,
			seenBefore: on ? undefined : services.seenBefore,
		}
	}
}

const SWITCH =
	"flex shrink-0 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** `field`: in the search field on desktop; otherwise in the row with Sort, as "Ready". */
export function ReadySwitch({
	on,
	onChange,
	field = false,
}: {
	on: boolean
	onChange: (on: boolean) => void
	field?: boolean
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label="Ready to watch"
			onClick={() => onChange(!on)}
			className={`${SWITCH} ${field ? "h-full gap-2.5 px-4 hover:bg-white/[0.04]" : "h-8 gap-1.5 px-2 hover:bg-white/[0.06]"}`}
		>
			<PlayCircleIcon
				className={`shrink-0 max-[380px]:hidden ${field ? "h-5 w-5" : "h-4 w-4"} ${on ? "text-amber-400" : "text-gray-500"}`}
				aria-hidden
			/>
			<span
				className={`font-semibold whitespace-nowrap ${field ? "text-[15px]" : "text-[13px]"} ${on ? "text-white" : "text-gray-400"}`}
			>
				{field ? "Ready to watch" : "Ready"}
			</span>
			<Knob on={on} size={field ? "lg" : "md"} />
		</button>
	)
}

export function ForYouSwitch({
	forYou,
	locked,
	onLocked,
	shown,
}: {
	forYou: ForYouControl
	/** A guest: For you needs an account. */
	locked: boolean
	onLocked: () => void
	shown: boolean
}) {
	const lit = forYou.on && !forYou.disabled && !locked
	return (
		<motion.div
			className="flex h-full shrink-0 items-center overflow-hidden"
			initial={false}
			animate={{ width: shown ? "auto" : 0, opacity: shown ? 1 : 0 }}
			transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
			aria-hidden={!shown}
			{...(shown ? {} : { inert: "" })}
		>
			<button
				type="button"
				role={locked ? undefined : "switch"}
				aria-checked={locked ? undefined : lit}
				aria-disabled={forYou.disabled || undefined}
				aria-label="For you"
				title={forYou.disabled ? forYou.hint : undefined}
				onClick={() =>
					locked
						? onLocked()
						: !forYou.disabled && forYou.onChange(!forYou.on)
				}
				className={`${SWITCH} h-8 gap-1.5 px-2 lg:h-full lg:gap-2 lg:px-4 ${forYou.disabled ? "cursor-not-allowed" : "hover:bg-white/[0.06]"}`}
			>
				{locked ? (
					<LockClosedIcon
						className="h-3.5 w-3.5 shrink-0 text-amber-500/70"
						aria-hidden
					/>
				) : (
					<FingerPrintIcon
						className={`h-4 w-4 shrink-0 ${lit ? "text-amber-400" : "text-gray-500"}`}
						aria-hidden
					/>
				)}
				<span
					className={`text-[13px] font-semibold whitespace-nowrap lg:text-sm ${lit ? "text-white" : "text-gray-400"}`}
				>
					For you
				</span>
				<Knob on={lit} />
			</button>
		</motion.div>
	)
}

/** The sort in the pill: on phones its short name, without an icon. */
export function SortInPill({
	sort,
	short,
}: {
	sort: ComponentProps<typeof SortControl>
	short: boolean
}) {
	return (
		<div className="flex h-8 shrink-0 items-center px-2 text-[13px] lg:h-full lg:px-4 lg:text-sm [&_[data-sort-button]]:h-full [&_[data-sort-button]]:rounded-none [&_[data-sort-button]]:bg-transparent [&_[data-sort-button]]:px-0 [&_[data-sort-button]:hover]:bg-transparent max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden max-lg:[&_[data-sort-button]>svg:first-child]:hidden">
			<SortControl
				{...sort}
				bare
				modeIcon={!short}
				short={short}
				align="right"
				portal
			/>
		</div>
	)
}
