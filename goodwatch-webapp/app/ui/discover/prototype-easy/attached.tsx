// PROTOTYPE (discover-easy) round 8: Ready to watch, Sort and (Advanced only) For you as parts of the search bar.
// Looks: inline (icon, words and switch in the bar), segment (the Advanced bar's small caps label over a value), lip
// (small, in the strip along the bar's bottom edge).
import { LockClosedIcon, PlayCircleIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type { ComponentProps, ReactNode } from "react"
import { SortControl } from "~/ui/filter-bar/controls"
import { Knob } from "~/ui/filter-bar/motion"
import type { ForYouControl } from "~/ui/filter-bar/types"

export type AttachLook = "inline" | "segment" | "lip"
export type Attach = "end" | "segments" | "lip" | "prefix" | "rowsort"

const LABEL = "text-[10px] font-bold tracking-[0.08em] text-gray-500 uppercase"

function Shell({ look, children, onClick, label, role, checked }: {
	look: AttachLook
	children: ReactNode
	onClick?: () => void
	label?: string
	role?: string
	checked?: boolean
}) {
	const cls =
		look === "segment"
			? "flex h-full min-w-0 shrink-0 cursor-pointer flex-col justify-center gap-0.5 px-5 text-left hover:bg-white/[0.04]"
			: look === "inline"
				? "flex h-full shrink-0 cursor-pointer items-center gap-2.5 rounded-full px-4 hover:bg-white/[0.04]"
				: "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 hover:bg-white/[0.06]"
	return onClick ? (
		<button type="button" role={role} aria-checked={checked} aria-label={label} onClick={onClick} className={cls}>
			{children}
		</button>
	) : (
		<div className={cls}>{children}</div>
	)
}

export function AttReady({ on, toggle, member, look, short, big }: { on: boolean; toggle: () => void; member: boolean; look: AttachLook; short?: boolean; big?: boolean }) {
	const icon = <PlayCircleIcon className={`${big ? "h-5 w-5" : "h-4 w-4"} shrink-0 ${on ? "text-amber-400" : "text-gray-500"}`} />
	const knob = <Knob on={on} size={big ? "lg" : "md"} />
	if (look === "segment")
		return (
			<Shell look={look} onClick={toggle} role="switch" checked={on} label="Ready to watch">
				<span className={LABEL}>Ready to watch</span>
				<span className="flex items-center gap-2.5">
					<span className={`text-[15px] font-semibold ${on ? "text-white" : "text-gray-500"}`}>
						{on ? (member ? "Mine, unseen" : "My services") : "Everything"}
					</span>
					{knob}
				</span>
			</Shell>
		)
	return (
		<Shell look={look} onClick={toggle} role="switch" checked={on} label="Ready to watch">
			{icon}
			<span className={`${look === "lip" ? "text-[13px]" : big ? "text-[15px]" : "text-sm"} font-semibold whitespace-nowrap ${on ? "text-white" : "text-gray-400"}`}>
				{short ? "Ready" : "Ready to watch"}
			</span>
			{knob}
		</Shell>
	)
}

export function AttSort({ sort, look, short }: { sort: ComponentProps<typeof SortControl>; look: AttachLook; short?: boolean }) {
	const fill =
		"[&_[data-sort-button]]:h-full [&_[data-sort-button]]:rounded-none [&_[data-sort-button]]:bg-transparent [&_[data-sort-button]]:px-0 [&_[data-sort-button]:hover]:bg-transparent"
	if (look === "segment")
		return (
			<Shell look={look}>
				<span className={LABEL}>Sort</span>
				<span className={`flex text-[15px] ${fill} [&_[data-sort-button]>span.text-gray-400]:hidden [&_[data-sort-button]]:h-auto`}>
					<SortControl {...sort} bare align="right" portal />
				</span>
			</Shell>
		)
	return (
		<Shell look={look}>
			<span className={`flex h-full items-center ${fill} ${look === "lip" ? "text-[13px] [&_[data-sort-button]]:h-8" : ""} ${short ? "[&_[data-sort-button]>span.text-gray-400]:hidden" : ""}`}>
				<SortControl {...sort} bare modeIcon short={short} align="right" portal />
			</span>
		</Shell>
	)
}

/** For you, only in Advanced: it slides in where it sits. */
export function AttForYou({ forYou, locked, onLocked, look, shown, short }: {
	short?: boolean
	forYou?: ForYouControl
	locked: boolean
	onLocked: () => void
	look: AttachLook
	shown: boolean
}) {
	const lit = !!forYou && forYou.on && !forYou.disabled && !locked
	const toggle = () => (locked ? onLocked() : forYou && !forYou.disabled && forYou.onChange(!forYou.on))
	const icon = locked ? (
		<LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
	) : (
		<FingerPrintIcon className={`h-4 w-4 shrink-0 ${lit ? "text-amber-400" : "text-gray-500"}`} />
	)
	const body =
		look === "segment" ? (
			<Shell look={look} onClick={toggle} role={locked ? undefined : "switch"} checked={lit} label="For you">
				<span className={LABEL}>For you</span>
				<span className="flex items-center gap-2.5">
					{locked ? icon : <span className={`text-[15px] font-semibold ${lit ? "text-white" : "text-gray-500"}`}>{lit ? "On" : "Off"}</span>}
					<Knob on={lit} />
				</span>
			</Shell>
		) : (
			<Shell look={look} onClick={toggle} role={locked ? undefined : "switch"} checked={lit} label="For you">
				{icon}
				{!short && <span className={`${look === "lip" ? "text-[13px]" : "text-sm"} font-semibold whitespace-nowrap ${lit ? "text-white" : "text-gray-400"}`}>For you</span>}
				<Knob on={lit} />
			</Shell>
		)
	return (
		<motion.div
			className="flex h-full shrink-0 items-center overflow-hidden"
			initial={false}
			animate={{ width: shown ? "auto" : 0, opacity: shown ? 1 : 0 }}
			transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
			aria-hidden={!shown}
			{...(!shown ? { inert: "" } : {})}
		>
			{look !== "lip" && <span className="h-8 w-px shrink-0 bg-white/10" />}
			{body}
		</motion.div>
	)
}

export const Divider = ({ tall = true }: { tall?: boolean }) => (
	<span className={`${tall ? "h-8" : "h-4"} w-px shrink-0 bg-white/10`} aria-hidden />
)
