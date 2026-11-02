// Ready to watch, For you and Sort. Ready to watch is one switch: on it means My services, and Not seen yet for members.
// It only ever toggles. For you joins Sort in Advanced, sliding in where it sits.
import {
	CheckIcon,
	LockClosedIcon,
	PlayCircleIcon,
} from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import {
	type ComponentProps,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
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
	member,
	field = false,
}: {
	on: boolean
	onChange: (on: boolean) => void
	member: boolean
	field?: boolean
}) {
	// Touch has no hover: the card shows for a moment after a tap.
	const tip = useId()
	const touched = useRef(false)
	const [peek, setPeek] = useState(false)
	useEffect(() => {
		if (!peek) return
		const timer = setTimeout(() => setPeek(false), 2800)
		return () => clearTimeout(timer)
	}, [peek])
	return (
		<div className={`group relative flex ${field ? "h-full" : ""}`}>
			<button
				type="button"
				role="switch"
				aria-checked={on}
				aria-label="Ready to watch"
				aria-describedby={tip}
				onPointerDown={(event) => {
					touched.current = event.pointerType === "touch"
				}}
				onClick={() => {
					if (touched.current) setPeek(true)
					onChange(!on)
				}}
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
			<ReadyTip id={tip} on={on} member={member} peek={peek} field={field} />
		</div>
	)
}

function ReadyTip({
	id,
	on,
	member,
	peek,
	field,
}: {
	id: string
	on: boolean
	member: boolean
	peek: boolean
	field: boolean
}) {
	return (
		<div
			id={id}
			role="tooltip"
			className={`pointer-events-none absolute z-50 w-[272px] rounded-2xl bg-gray-900 p-3.5 shadow-xl shadow-black/50 ring-1 ring-white/10 transition duration-150 ${field ? "top-full right-0 mt-2" : "top-full left-0 mt-2"} ${
				peek
					? "translate-y-0 opacity-100"
					: "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-200 group-has-[:focus-visible]:translate-y-0 group-has-[:focus-visible]:opacity-100"
			}`}
		>
			<p className="text-[13px] font-semibold text-white">
				{on
					? "Showing only what you can start now"
					: "Show only what you can start now"}
			</p>
			<ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-gray-300">
				<li className="flex items-center gap-2">
					<CheckIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
					On your streaming services
				</li>
				<li
					className={`flex items-center gap-2 ${member ? "" : "text-gray-500"}`}
				>
					{member ? (
						<CheckIcon
							className="h-4 w-4 shrink-0 text-amber-400"
							aria-hidden
						/>
					) : (
						<LockClosedIcon
							className="h-4 w-4 shrink-0 p-0.5 text-amber-500/70"
							aria-hidden
						/>
					)}
					{member ? "Not seen yet" : "Not seen yet, with an account"}
				</li>
			</ul>
		</div>
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
					locked ? onLocked() : !forYou.disabled && forYou.onChange(!forYou.on)
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
