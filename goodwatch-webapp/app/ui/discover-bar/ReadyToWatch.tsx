// Ready to watch: On my services and Not seen yet as one segmented pill. The first segment turns both on or off; each
// part toggles on its own. A lit segment gets a colored base line (amber for the switch, emerald for services, blue for
// Not seen yet). Three sizes (ControlSize): full labels, short labels, icons only with tooltips.
//
// Without saved services, the services part says "Pick services" and opens Watch > Services. Not seen yet needs an
// account: a guest's part shows a lock and opens You.
import {
	EyeSlashIcon,
	LockClosedIcon,
	PlusIcon,
} from "@heroicons/react/20/solid"
import { PlayCircleIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import type { FilterState } from "~/domain/filter-state"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { Knob, TAP } from "~/ui/filter-bar/motion"
import type { StreamingProvider } from "~/ui/filter-bar/useFilterData"
import { Tip, TipText } from "./Tip"
import type { ControlSize } from "./control-size"
import type { MainTab, SubTabId } from "./tabs"

export const PILL_FOCUS =
	"outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
export const SEGMENT =
	"relative flex h-full items-center gap-1.5 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors"

/** A lit segment's colored line along its bottom edge. */
export function BaseLine({ on, color }: { on: boolean; color: string }) {
	return (
		<span
			aria-hidden
			className={`pointer-events-none absolute inset-x-2.5 bottom-0 h-0.5 rounded-full ${color} transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
		/>
	)
}

export interface ReadyToWatchProps {
	state: FilterState
	update: (change: (state: FilterState) => FilterState) => void
	/** The viewer's saved services. */
	mine: StreamingProvider[]
	member: boolean
	open: (tab: MainTab, sub?: SubTabId) => void
}

const servicesSet =
	(on: boolean) =>
	(s: FilterState): FilterState => ({
		...s,
		onMyServices: on,
		anyService: undefined,
		services: undefined,
	})
const notSeenSet = (s: FilterState, on: boolean): FilterState => ({
	...s,
	notSeenYet: on,
	seenBefore: on ? undefined : s.seenBefore,
})

interface Part {
	key: "services" | "notSeen"
	label: string
	short: string
	on: boolean
	icon: ReactNode
	tint: string
	line: string
	locked: boolean
	tip: string
	onClick: () => void
}

export function ReadyToWatch({
	ready,
	size,
}: {
	ready: ReadyToWatchProps
	size: ControlSize
}) {
	const { state, update, mine, member, open } = ready
	const canServices = mine.length > 0
	const services = canServices && state.onMyServices
	const notSeen = member && state.notSeenYet
	const all =
		(canServices || member) &&
		(!canServices || services) &&
		(!member || notSeen)
	const some = services || notSeen
	const toggleAll = () => {
		if (!canServices && !member) return open("watch", "services")
		const next = !all
		update((s) => {
			let out = s
			if (canServices) out = servicesSet(next)(out)
			if (member) out = notSeenSet(out, next)
			return out
		})
	}
	const parts: Part[] = [
		canServices
			? {
					key: "services",
					label: "My services",
					short: "Mine",
					on: services,
					icon: <ServiceStack providers={mine} on={services} size={14} />,
					tint: "bg-emerald-500/20",
					line: "bg-emerald-400",
					locked: false,
					tip: mine.map((p) => p.name).join(", "),
					onClick: () => update(servicesSet(!services)),
				}
			: {
					key: "services",
					label: "Pick services",
					short: "Services",
					on: false,
					icon: <PlusIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />,
					tint: "",
					line: "",
					locked: false,
					tip: "Pick the services you have",
					onClick: () => open("watch", "services"),
				},
		{
			key: "notSeen",
			label: "Not seen yet",
			short: "Unseen",
			on: notSeen,
			icon: member ? (
				<EyeSlashIcon
					className={`h-3.5 w-3.5 shrink-0 ${notSeen ? "text-blue-400" : ""}`}
				/>
			) : (
				<LockClosedIcon className="h-3 w-3 shrink-0 text-amber-500/70" />
			),
			tint: "bg-blue-500/20",
			line: "bg-blue-400",
			locked: !member,
			tip: member
				? "Hides what you've seen or passed on"
				: "Sign up to hide what you've seen",
			onClick: () =>
				member ? update((s) => notSeenSet(s, !notSeen)) : open("you", "taste"),
		},
	]
	const iconTone = all
		? "text-amber-400"
		: some
			? "text-amber-400/60"
			: "text-gray-500"
	return (
		<div className="flex h-10 shrink-0 rounded-xl bg-white/[0.04] ring-1 ring-white/10">
			<Tip
				off={size === 2}
				align="start"
				tip={
					<TipText
						name="Ready to watch"
						on={all}
						line="My services and Not seen yet in one switch"
					/>
				}
			>
				<motion.button
					type="button"
					role="switch"
					aria-checked={all}
					aria-label="Ready to watch"
					whileTap={TAP}
					onClick={toggleAll}
					className={`${SEGMENT} rounded-l-xl ${PILL_FOCUS} ${size === 0 ? "pr-2 pl-3" : "pr-2.5 pl-3.5"} ${all || some ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
				>
					<PlayCircleIcon className={`h-4 w-4 shrink-0 ${iconTone}`} />
					{size === 2 && <span className="text-sm">Ready to watch</span>}
					{size === 1 && <span className="text-sm">Ready</span>}
					<Knob on={all} />
					<BaseLine on={all} color="bg-amber-400" />
				</motion.button>
			</Tip>
			{parts.map((part, i) => (
				<Tip
					key={part.key}
					off={size === 2}
					align="start"
					tip={
						<TipText
							name={part.label}
							on={part.locked ? undefined : part.on}
							line={part.tip}
						/>
					}
				>
					<motion.button
						type="button"
						role={part.locked ? undefined : "switch"}
						aria-checked={part.locked ? undefined : part.on}
						aria-label={part.label}
						whileTap={TAP}
						onClick={part.onClick}
						className={`${SEGMENT} border-l border-white/10 ${PILL_FOCUS} ${size === 0 ? "px-2.5" : "px-3"} ${i === parts.length - 1 ? "rounded-r-xl pr-3.5" : ""} ${part.on ? `${part.tint} text-white` : part.locked ? "text-gray-500" : "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200"}`}
					>
						{part.icon}
						{size === 2 && part.label}
						{size === 1 && part.short}
						<BaseLine on={part.on} color={part.line} />
					</motion.button>
				</Tip>
			))}
		</div>
	)
}
