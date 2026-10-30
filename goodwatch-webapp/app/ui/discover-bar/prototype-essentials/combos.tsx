// PROTOTYPE: four ways to draw the two combined switches, Ready to watch (with My services and Not seen yet) and For
// you (with Sort), in the same style each time. `?combo=a|b|c|d`, on variant J.
//
//   a  Switch + parts: one shell, the switch, a divider, then the parts
//   b  Segmented: one pill cut into segments; each lit segment gets a colored base line
//   c  Labeled card: like the bar's segments, a small label with the switch over the parts
//   d  Rail: the switch and the parts sit on one line that lights amber when everything is on
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeSlashIcon,
	LockClosedIcon,
	PlusIcon,
} from "@heroicons/react/20/solid"
import { FingerPrintIcon, PlayCircleIcon } from "@heroicons/react/24/solid"
import { useNavigate, useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import type { ComponentProps, ReactNode } from "react"
import type { FilterState } from "~/domain/filter-state"
import { ServiceStack, SortControl } from "~/ui/filter-bar/controls"
import { Knob, TAP } from "~/ui/filter-bar/motion"
import type { ForYouControl } from "~/ui/filter-bar/types"
import type { EssentialsProps } from "./Essentials"

export const COMBOS = [
	{ key: "a", name: "Switch + parts" },
	{ key: "b", name: "Segmented" },
	{ key: "c", name: "Labeled card" },
	{ key: "d", name: "Rail" },
] as const
export type Combo = (typeof COMBOS)[number]["key"]

export const useCombo = (): Combo => {
	const [params] = useSearchParams()
	const c = params.get("combo")
	return (COMBOS.find((x) => x.key === c)?.key ?? "a") as Combo
}

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

const servicesOn = (s: FilterState): FilterState => ({
	...s,
	onMyServices: true,
	anyService: undefined,
	services: undefined,
})
const servicesOff = (s: FilterState): FilterState => ({
	...s,
	onMyServices: false,
	anyService: undefined,
	services: undefined,
})
const unseen = (s: FilterState, on: boolean): FilterState => ({
	...s,
	notSeenYet: on,
	seenBefore: on ? undefined : s.seenBefore,
})

function useReady(p: EssentialsProps) {
	const canS = p.mine.length > 0
	const canU = p.member
	const s = canS && p.state.onMyServices
	const u = canU && p.state.notSeenYet
	const all = (canS || canU) && (!canS || s) && (!canU || u)
	return {
		canS,
		canU,
		s,
		u,
		all,
		some: s || u,
		toggleAll: () => {
			if (!canS && !canU) return p.open("watch", "services")
			const next = !all
			p.update((st) => {
				let out = st
				if (canS) out = next ? servicesOn(out) : servicesOff(out)
				if (canU) out = unseen(out, next)
				return out
			})
		},
		toggleS: () =>
			canS ? p.update(s ? servicesOff : servicesOn) : p.open("watch", "services"),
		toggleU: () =>
			canU ? p.update((st) => unseen(st, !u)) : p.open("you", "taste"),
	}
}

interface PartDef {
	key: string
	label: string
	short: string
	on: boolean
	icon: ReactNode
	tint: string
	line: string
	locked?: boolean
	onClick: () => void
}

function partsOf(p: EssentialsProps, r: ReturnType<typeof useReady>): PartDef[] {
	return [
		r.canS
			? {
					key: "s",
					label: "My services",
					short: "Mine",
					on: r.s,
					icon: <ServiceStack providers={p.mine} on={r.s} size={14} max={3} />,
					tint: "bg-emerald-500/20",
					line: "bg-emerald-400",
					onClick: r.toggleS,
				}
			: {
					key: "s",
					label: "Pick services",
					short: "Services",
					on: false,
					icon: <PlusIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />,
					tint: "",
					line: "",
					onClick: r.toggleS,
				},
		{
			key: "u",
			label: "Not seen yet",
			short: "Unseen",
			on: r.u,
			icon: r.canU ? (
				<EyeSlashIcon className={`h-3.5 w-3.5 shrink-0 ${r.u ? "text-blue-400" : ""}`} />
			) : (
				<LockClosedIcon className="h-3 w-3 shrink-0 text-amber-500/70" />
			),
			tint: "bg-blue-500/20",
			line: "bg-blue-400",
			locked: !r.canU,
			onClick: r.toggleU,
		},
	]
}

/** A part as the small pill the owner liked: soft fill off, tinted fill on, no outline. */
function Pill({ part, phone, h = "h-8" }: { part: PartDef; phone: boolean; h?: string }) {
	return (
		<motion.button
			type="button"
			role={part.locked ? undefined : "switch"}
			aria-checked={part.locked ? undefined : part.on}
			aria-label={part.label}
			whileTap={TAP}
			onClick={part.onClick}
			className={`flex ${h} min-w-0 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors duration-200 ${FOCUS} ${
				part.on
					? `${part.tint} text-white`
					: part.locked
						? "bg-white/[0.03] text-gray-500"
						: "bg-white/[0.05] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200"
			}`}
		>
			{part.icon}
			<span className="truncate">{phone ? part.short : part.label}</span>
		</motion.button>
	)
}

function MainIcon({ kind, lit, some }: { kind: "ready" | "you"; lit: boolean; some?: boolean }) {
	const cls = `h-4 w-4 shrink-0 ${lit ? "text-amber-400" : some ? "text-amber-400/60" : "text-gray-500"}`
	return kind === "ready" ? <PlayCircleIcon className={cls} /> : <FingerPrintIcon className={cls} />
}

function MainSwitch({
	kind,
	label,
	on,
	some,
	onClick,
	className = "",
	showLabel = true,
}: {
	kind: "ready" | "you"
	label: string
	on: boolean
	some?: boolean
	onClick: () => void
	className?: string
	showLabel?: boolean
}) {
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={label}
			whileTap={TAP}
			onClick={onClick}
			className={`flex items-center gap-2 text-sm font-bold whitespace-nowrap cursor-pointer ${FOCUS} ${on || some ? "text-white" : "text-gray-400 hover:text-gray-200"} ${className}`}
		>
			<MainIcon kind={kind} lit={on} some={some} />
			{showLabel && <span>{label}</span>}
			<Knob on={on} />
		</motion.button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Ready to watch

export function ReadyCombo({
	p,
	combo,
	phone,
}: { p: EssentialsProps; combo: Combo; phone: boolean }) {
	const r = useReady(p)
	const parts = partsOf(p, r)
	const label = phone ? "Ready" : "Ready to watch"
	if (combo === "b")
		return (
			<div className="flex h-10 shrink-0 overflow-hidden rounded-full bg-white/[0.04] ring-1 ring-white/10">
				<div className="relative flex">
					<MainSwitch
						kind="ready"
						label={label}
						on={r.all}
						some={r.some}
						onClick={r.toggleAll}
						className="h-full pr-2.5 pl-3.5"
					/>
					<span
						className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-amber-400 transition-opacity ${r.all ? "opacity-100" : "opacity-0"}`}
						aria-hidden
					/>
				</div>
				{parts.map((part) => (
					<div key={part.key} className="relative flex border-l border-white/10">
						<motion.button
							type="button"
							role={part.locked ? undefined : "switch"}
							aria-checked={part.locked ? undefined : part.on}
							aria-label={part.label}
							whileTap={TAP}
							onClick={part.onClick}
							className={`flex h-full items-center gap-1.5 px-3 text-[13px] font-bold whitespace-nowrap cursor-pointer transition-colors ${FOCUS} ${part.on ? `${part.tint} text-white` : part.locked ? "text-gray-500" : "text-gray-400 hover:bg-white/[0.05] hover:text-gray-200"}`}
						>
							{part.icon}
							{phone ? part.short : part.label}
						</motion.button>
						<span
							className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full ${part.line} transition-opacity ${part.on ? "opacity-100" : "opacity-0"}`}
							aria-hidden
						/>
					</div>
				))}
			</div>
		)
	if (combo === "c")
		return (
			<div className="flex shrink-0 flex-col gap-1 rounded-2xl bg-white/[0.045] px-2 pt-1.5 pb-2 ring-1 ring-white/10">
				<motion.button
					type="button"
					role="switch"
					aria-checked={r.all}
					whileTap={{ scale: 0.98 }}
					onClick={r.toggleAll}
					className={`flex items-center gap-1.5 rounded-md px-1 text-[11px] font-bold tracking-[0.08em] uppercase cursor-pointer ${FOCUS} ${r.all ? "text-amber-300" : "text-gray-400"}`}
				>
					<PlayCircleIcon className={`h-3.5 w-3.5 ${r.all ? "text-amber-400" : r.some ? "text-amber-400/60" : ""}`} />
					<span className="flex-1 text-left">Ready to watch</span>
					<span className="origin-right scale-75">
						<Knob on={r.all} />
					</span>
				</motion.button>
				<div className="flex gap-1">
					{parts.map((part) => (
						<Pill key={part.key} part={part} phone={phone} h="h-7" />
					))}
				</div>
			</div>
		)
	if (combo === "d")
		return (
			<div className="relative flex shrink-0 items-center gap-2">
				<span
					aria-hidden
					className={`absolute top-1/2 right-4 left-4 h-0.5 -translate-y-1/2 rounded-full transition-colors duration-300 ${r.all ? "bg-amber-400/70" : r.some ? "bg-amber-400/25" : "bg-white/10"}`}
				/>
				<MainSwitch
					kind="ready"
					label={label}
					on={r.all}
					some={r.some}
					onClick={r.toggleAll}
					className="relative h-9 rounded-full bg-gray-900 pr-1.5 pl-3 ring-1 ring-white/10"
				/>
				{parts.map((part) => (
					<div key={part.key} className="relative rounded-xl bg-gray-900">
						<Pill part={part} phone={phone} />
					</div>
				))}
			</div>
		)
	// a
	return (
		<div className="flex h-10 shrink-0 items-center gap-1 rounded-2xl bg-white/[0.04] pr-1 pl-1 ring-1 ring-white/10">
			<MainSwitch
				kind="ready"
				label={label}
				on={r.all}
				some={r.some}
				onClick={r.toggleAll}
				className="h-full rounded-xl pr-2 pl-2.5"
			/>
			<span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden />
			{parts.map((part) => (
				<Pill key={part.key} part={part} phone={phone} />
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// For you + Sort

type SortProps = ComponentProps<typeof SortControl>

/** The sort as a bare button of fixed width, so it doesn't jump between sorts. */
function Sort({ sort, phone, extra = "" }: { sort: SortProps; phone: boolean; extra?: string }) {
	return (
		<div
			className={`flex max-lg:[&_[data-sort-button]>span.text-gray-400]:hidden [&_[data-sort-button]]:h-full ${phone ? "[&_[data-sort-button]]:w-[140px] [&_[data-sort-button]]:px-3" : "[&_[data-sort-button]]:w-[190px]"} ${extra}`}
		>
			<SortControl {...sort} bare />
		</div>
	)
}

export function OrderCombo({
	forYou,
	sort,
	combo,
	phone,
}: {
	forYou: ForYouControl
	sort: SortProps
	combo: Combo
	phone: boolean
}) {
	const lit = forYou.on && !forYou.disabled
	const flip = () => !forYou.disabled && forYou.onChange(!forYou.on)
	if (combo === "b")
		return (
			<div className="flex h-10 shrink-0 overflow-hidden rounded-full bg-white/[0.04] ring-1 ring-white/10">
				<div className="relative flex">
					<MainSwitch
						kind="you"
						label="For you"
						on={lit}
						onClick={flip}
						showLabel={!phone}
						className="h-full pr-2.5 pl-3.5"
					/>
					<span
						className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-amber-400 transition-opacity ${lit ? "opacity-100" : "opacity-0"}`}
						aria-hidden
					/>
				</div>
				<Sort sort={sort} phone={phone} extra="border-l border-white/10 [&_[data-sort-button]]:rounded-none" />
			</div>
		)
	if (combo === "c")
		return (
			<div className="flex shrink-0 rounded-2xl bg-white/[0.045] ring-1 ring-white/10">
				<motion.button
					type="button"
					role="switch"
					aria-checked={lit}
					whileTap={{ scale: 0.98 }}
					onClick={flip}
					className={`flex flex-col justify-center gap-1 rounded-l-2xl px-3 py-1.5 cursor-pointer ${FOCUS}`}
				>
					<span className={`flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase ${lit ? "text-amber-300" : "text-gray-400"}`}>
						<FingerPrintIcon className={`h-3.5 w-3.5 ${lit ? "text-amber-400" : ""}`} />
						{!phone && "For you"}
					</span>
					<span className="origin-left scale-75">
						<Knob on={lit} />
					</span>
				</motion.button>
				<span className="my-2 w-px bg-white/10" aria-hidden />
				<div className="flex flex-col justify-center pt-1.5 pl-1">
					<span className="px-3 text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">Sort</span>
					<Sort
						sort={sort}
						phone={phone}
						extra="h-8 [&_[data-sort-button]>span.text-gray-400]:hidden [&_[data-sort-button]>svg:first-child]:hidden"
					/>
				</div>
			</div>
		)
	if (combo === "d")
		return (
			<div className="relative flex h-10 shrink-0 items-center gap-2">
				<span
					aria-hidden
					className={`absolute top-1/2 right-4 left-4 h-0.5 -translate-y-1/2 rounded-full transition-colors duration-300 ${lit ? "bg-amber-400/70" : "bg-white/10"}`}
				/>
				<MainSwitch
					kind="you"
					label="For you"
					on={lit}
					onClick={flip}
					showLabel={!phone}
					className="relative h-9 rounded-full bg-gray-900 pr-1.5 pl-3 ring-1 ring-white/10"
				/>
				<Sort sort={sort} phone={phone} extra="relative h-9 rounded-xl bg-gray-900 ring-1 ring-white/10 [&_[data-sort-button]]:rounded-xl" />
			</div>
		)
	// a
	return (
		<div className="flex h-10 shrink-0 items-stretch rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
			<MainSwitch
				kind="you"
				label="For you"
				on={lit}
				onClick={flip}
				showLabel={!phone}
				className={`rounded-l-2xl pr-2.5 pl-3 ${lit ? "bg-amber-500/[0.12]" : ""}`}
			/>
			<span className="my-2 w-px bg-white/10" aria-hidden />
			<Sort sort={sort} phone={phone} />
		</div>
	)
}

/** A second switcher for the combo styles, above the variant switcher. */
export function ComboSwitcher() {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const current = useCombo()
	const i = COMBOS.findIndex((c) => c.key === current)
	const go = (d: number) => {
		const next = new URLSearchParams(params)
		next.set("combo", COMBOS[(i + d + COMBOS.length) % COMBOS.length].key)
		navigate(`?${next}`, { replace: true, preventScrollReset: true })
	}
	return (
		<div className="fixed bottom-14 left-3 z-[2000] flex items-center gap-1 rounded-full bg-sky-700 px-1 py-1 text-xs font-bold text-white shadow-lg max-lg:bottom-[192px]">
			<button type="button" onClick={() => go(-1)} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Previous style">
				<ChevronLeftIcon className="h-4 w-4" />
			</button>
			<span className="px-1 whitespace-nowrap">
				Style {current} · {COMBOS[i].name}
			</span>
			<button type="button" onClick={() => go(1)} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Next style">
				<ChevronRightIcon className="h-4 w-4" />
			</button>
		</div>
	)
}
