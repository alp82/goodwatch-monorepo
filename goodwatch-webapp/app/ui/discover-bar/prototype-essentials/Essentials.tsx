// PROTOTYPE (throwaway, branch prototype/discover-essentials): On my services and Not seen yet both start off, and
// sit next to each other wherever the variant puts them. Route: /prototype/discover-essentials?variant=0|A|B|C|D|E.
//
//   0  Today's layout, defaults off (services in Watch > Services, Not seen yet in You > Taste and lists)
//   A  Status line pair: two switches right after the count (phones: their own row under the bar)
//   B  Bar strip: the two switches inside the Discover bar, on a strip under the segments
//   C  Ready to watch: one switch that turns on both, with each part tappable on its own
//   D  Heading row: the two switches on the title's row (phones: between the title and the bar)
//   E  Thumb bar: a floating bar at the bottom of the screen with the two switches, always in reach
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeSlashIcon,
	LockClosedIcon,
	PlusIcon,
} from "@heroicons/react/20/solid"
import { PlayCircleIcon as BoltIcon } from "@heroicons/react/24/solid"
import { useNavigate, useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { useEffect } from "react"
import type { FilterState } from "~/domain/filter-state"
import { ServiceStack, hiddenShort } from "~/ui/filter-bar/controls"
import { Knob, SHELL, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import type { StreamingProvider } from "~/ui/filter-bar/useFilterData"
import type { MainTab, SubTabId } from "../tabs"
import { listHides } from "../you/you-choices"

export const VARIANTS = [
	{ key: "0", name: "Today, defaults off" },
	{ key: "A", name: "Status line pair" },
	{ key: "B", name: "Bar strip" },
	{ key: "C", name: "Ready to watch" },
	{ key: "D", name: "Heading row" },
	{ key: "E", name: "Thumb bar" },
	{ key: "F", name: "Ready v2: corner" },
	{ key: "G", name: "Ready v2: one row, ends apart" },
	{ key: "H", name: "Ready v2: diagonal" },
	{ key: "I", name: "Ready v2: quiet shells" },
	{ key: "J", name: "Ready v2: count up top" },
] as const

/** The Ready to watch v2 family. */
export const READY_V2 = new Set(["F", "G", "H", "I", "J"])
export type Variant = (typeof VARIANTS)[number]["key"]

export const useVariant = (): Variant => {
	const [params] = useSearchParams()
	const v = params.get("variant") ?? "F"
	return (VARIANTS.find((x) => x.key === v)?.key ?? "F") as Variant
}

/** The chips the variant's switches stand in for. */
export const ESSENTIAL_CHIPS = new Set(["on-my-services", "not-seen-yet"])

export interface EssentialsProps {
	state: FilterState
	update: (change: (state: FilterState) => FilterState) => void
	mine: StreamingProvider[]
	counts: FilterBarCounts | null
	member: boolean
	open: (tab: MainTab, sub?: SubTabId) => void
}

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const EMERALD = "bg-emerald-600 shadow-[0_0_14px_rgba(5,150,105,.6)]"
const BLUE = "bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]"

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

function Pill({
	on,
	label,
	icon,
	knob,
	hint,
	onClick,
	size,
	dim,
	compact = false,
	tint = "",
	className = "",
}: {
	/** Phones: no knob; the on state fills with the tint. */
	compact?: boolean
	tint?: string
	on: boolean
	label: string
	icon: React.ReactNode
	knob: string | null
	hint?: string | null
	onClick: () => void
	size: "sm" | "md"
	dim?: boolean
	className?: string
}) {
	return (
		<motion.button
			type="button"
			role={knob ? "switch" : undefined}
			aria-checked={knob ? on : undefined}
			whileTap={TAP}
			onClick={onClick}
			className={`relative flex min-w-0 shrink-0 items-center gap-2 text-sm font-bold whitespace-nowrap cursor-pointer ${FOCUS} ${SHELL} ${size === "sm" ? "h-9 px-3" : "h-11 px-3.5"} ${dim ? "text-gray-500" : on ? "text-white" : "text-gray-400 hover:text-gray-200"} ${compact && on ? tint : ""} ${className}`}
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-amber-400/70 transition-opacity duration-200 ${on ? "opacity-100" : "opacity-0"}`}
			/>
			{icon}
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
			{hint && (
				<span className="shrink-0 text-xs tabular-nums text-blue-300/80">
					{hint}
				</span>
			)}
			{knob && !compact && <Knob on={on} onClass={knob} />}
		</motion.button>
	)
}

export function ServicesPill({
	p,
	size = "sm",
	className,
	compact = false,
}: {
	p: EssentialsProps
	size?: "sm" | "md"
	className?: string
	compact?: boolean
}) {
	const on = p.state.onMyServices
	if (!p.mine.length)
		return (
			<Pill
				on={false}
				label="Pick my services"
				icon={<PlusIcon className="h-4 w-4 shrink-0 text-emerald-400" />}
				knob={null}
				onClick={() => p.open("watch", "services")}
				size={size}
				className={className}
			/>
		)
	return (
		<Pill
			on={on}
			label="My services"
			icon={
				<ServiceStack
					providers={p.mine}
					on={on}
					size={compact ? 14 : 16}
					max={compact ? 2 : 3}
				/>
			}
			knob={EMERALD}
			compact={compact}
			tint="bg-emerald-500/15"
			onClick={() => p.update(on ? servicesOff : servicesOn)}
			size={size}
			className={className}
		/>
	)
}

export function UnseenPill({
	p,
	size = "sm",
	className,
	compact = false,
}: {
	p: EssentialsProps
	size?: "sm" | "md"
	className?: string
	compact?: boolean
}) {
	const on = p.state.notSeenYet
	if (!p.member)
		return (
			<Pill
				on={false}
				dim
				label="Not seen yet"
				icon={
					<LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
				}
				knob={null}
				onClick={() => p.open("you", "taste")}
				size={size}
				className={className}
			/>
		)
	const hides = on ? listHides(p.counts?.optionCounts, "notSeenYet") : null
	return (
		<Pill
			on={on}
			label="Not seen yet"
			icon={
				<EyeSlashIcon
					className={`h-4 w-4 shrink-0 ${on ? "text-blue-400" : ""}`}
				/>
			}
			knob={BLUE}
			compact={compact}
			tint="bg-blue-500/15"
			hint={hides ? hiddenShort(hides) : null}
			onClick={() => p.update((s) => unseen(s, !on))}
			size={size}
			className={className}
		/>
	)
}

/** A, B, D, E: the two switches side by side. */
export function PillPair({
	p,
	size = "sm",
	stretch = false,
}: { p: EssentialsProps; size?: "sm" | "md"; stretch?: boolean }) {
	const cls = stretch ? "flex-1 basis-0" : ""
	return (
		<div className={`flex min-w-0 items-center gap-2 ${stretch ? "w-full" : ""}`}>
			<ServicesPill p={p} size={size} className={cls} compact={stretch} />
			<UnseenPill p={p} size={size} className={cls} compact={stretch} />
		</div>
	)
}

/** B: the strip under the bar's segments. */
export function BarStrip({ p, phone }: { p: EssentialsProps; phone: boolean }) {
	return (
		<div
			className={`flex items-center gap-3 border-t border-white/[0.08] ${phone ? "px-2.5 py-2" : "px-6 py-2.5"}`}
		>
			{!phone && (
				<span className="text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">
					Only show
				</span>
			)}
			<PillPair p={p} stretch={phone} />
		</div>
	)
}

/** C: one switch for both, each part tappable on its own. */
export function ReadySwitch({
	p,
	phone,
	v2 = false,
	quiet = false,
}: { p: EssentialsProps; phone: boolean; v2?: boolean; quiet?: boolean }) {
	const canServices = p.mine.length > 0
	const canUnseen = p.member
	const s = canServices && p.state.onMyServices
	const u = canUnseen && p.state.notSeenYet
	const all = (!canServices || s) && (!canUnseen || u) && (canServices || canUnseen)
	const some = s || u
	const toggleAll = () => {
		if (!canServices && !canUnseen) return p.open("watch", "services")
		const next = !all
		p.update((st) => {
			let out = st
			if (canServices) out = next ? servicesOn(out) : servicesOff(out)
			if (canUnseen) out = unseen(out, next)
			return out
		})
	}
	const part = (
		label: string,
		on: boolean,
		can: boolean,
		toggle: () => void,
		dot: string,
	) => (
		<motion.button
			type="button"
			role="switch"
			aria-checked={on}
			whileTap={TAP}
			onClick={toggle}
			className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold whitespace-nowrap cursor-pointer ${FOCUS} ${on ? "bg-white/[0.12] text-white" : can ? "text-gray-400 hover:text-gray-200" : "text-gray-600"}`}
		>
			{can ? (
				<span
					className={`h-2 w-2 rounded-full ${on ? dot : "bg-gray-600"}`}
					aria-hidden
				/>
			) : (
				<LockClosedIcon className="h-3 w-3 text-amber-500/70" aria-hidden />
			)}
			{label}
		</motion.button>
	)
	const mini = (
		label: string,
		on: boolean,
		icon: React.ReactNode,
		tint: string,
		onClick: () => void,
		locked = false,
	) => (
		<motion.button
			type="button"
			role={locked ? undefined : "switch"}
			aria-checked={locked ? undefined : on}
			whileTap={TAP}
			onClick={onClick}
			className={`flex h-8 min-w-0 shrink items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-bold whitespace-nowrap cursor-pointer ring-1 ring-inset transition-colors duration-200 ${FOCUS} ${
				on
					? `${tint} text-white ring-transparent`
					: locked
						? "bg-white/[0.03] text-gray-500 ring-transparent"
						: "bg-white/[0.05] text-gray-400 ring-transparent hover:bg-white/[0.08] hover:text-gray-200"
			}`}
		>
			{icon}
			<span className="truncate">{label}</span>
		</motion.button>
	)
	const v2Parts = (
		<>
			{canServices
				? mini(
						"My services",
						s,
						<ServiceStack providers={p.mine} on={s} size={14} max={phone ? 2 : 3} />,
						"bg-emerald-500/20",
						() => p.update(s ? servicesOff : servicesOn),
					)
				: mini(
						"Pick services",
						false,
						<PlusIcon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />,
						"",
						() => p.open("watch", "services"),
					)}
			{canUnseen
				? mini(
						"Not seen yet",
						u,
						<EyeSlashIcon className={`h-3.5 w-3.5 shrink-0 ${u ? "text-blue-400" : ""}`} />,
						"bg-blue-500/20",
						() => p.update((st) => unseen(st, !u)),
					)
				: mini(
						"Not seen yet",
						false,
						<LockClosedIcon className="h-3 w-3 shrink-0 text-amber-500/70" />,
						"",
						() => p.open("you", "taste"),
						true,
					)}
		</>
	)
	if (v2 && phone)
		return (
			<div className={`flex w-full flex-col gap-1 p-1 ${SHELL}`}>
				<motion.button
					type="button"
					role="switch"
					aria-checked={all}
					whileTap={TAP}
					onClick={toggleAll}
					className={`flex h-10 items-center gap-2 rounded-xl pr-1.5 pl-2.5 text-sm font-bold cursor-pointer ${FOCUS} ${all || some ? "text-white" : "text-gray-400"}`}
				>
					<BoltIcon
						className={`h-4 w-4 shrink-0 ${all ? "text-amber-400" : some ? "text-amber-400/60" : ""}`}
					/>
					<span className="flex-1 text-left">Ready to watch</span>
					<Knob on={all} />
				</motion.button>
				<div className="grid grid-cols-2 gap-1 [&>button]:h-9 [&>button]:justify-center">
					{v2Parts}
				</div>
			</div>
		)
	return (
		<div
			className={`relative flex items-center gap-1 ${quiet ? "" : SHELL} ${phone ? "h-12 w-full pr-1.5 pl-1" : quiet ? "h-10" : "h-10 pr-1 pl-1"}`}
		>
			{!v2 && (
				<span
					aria-hidden
					className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-amber-400/70 transition-opacity duration-200 ${all ? "opacity-100" : "opacity-0"}`}
				/>
			)}
			<motion.button
				type="button"
				role="switch"
				aria-checked={all}
				whileTap={TAP}
				onClick={toggleAll}
				className={`flex h-full min-w-0 flex-1 items-center gap-2 ${quiet ? "rounded-xl bg-white/[0.04]" : "rounded-2xl"} pr-2 pl-2.5 text-sm font-bold whitespace-nowrap cursor-pointer ${FOCUS} ${all || some ? "text-white" : "text-gray-400 hover:text-gray-200"} ${phone && all && !v2 ? "bg-amber-500/15" : ""}`}
			>
				<BoltIcon
					className={`h-4 w-4 shrink-0 ${all ? "text-amber-400" : some ? "text-amber-400/60" : ""}`}
				/>
				<span className="flex-1 text-left">Ready to watch</span>
				{(v2 || !phone) && <Knob on={all} />}
			</motion.button>
			{!quiet && <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden />}
			{v2 ? (
				<div className="flex min-w-0 items-center gap-1">{v2Parts}</div>
			) : null}
			{!v2 && canServices
				? part(
						"My services",
						s,
						true,
						() => p.update(s ? servicesOff : servicesOn),
						"bg-emerald-400",
					)
				: !v2 && part("Services", false, true, () => p.open("watch", "services"), "")}
			{!v2 && part(
				phone ? "Unseen" : "Not seen yet",
				u,
				canUnseen,
				() => (canUnseen ? p.update((st) => unseen(st, !u)) : p.open("you", "taste")),
				"bg-blue-400",
			)}
		</div>
	)
}

/** E: a floating bar at the bottom of the screen, above the phone's bottom navigation. */
export function ThumbBar({ p }: { p: EssentialsProps }) {
	return (
		<div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-[900] flex justify-center px-3 lg:bottom-6">
			<div className="pointer-events-auto flex items-center gap-2 rounded-[22px] bg-gray-950/95 p-1.5 ring-1 ring-white/15 shadow-[0_20px_50px_-10px_rgba(0,0,0,.9)] max-lg:w-full max-lg:max-w-[420px]">
				<PillPair p={p} stretch />
			</div>
		</div>
	)
}

/** The prototype's variant switcher: bottom left, arrows and ← → keys. */
export function VariantSwitcher() {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const current = useVariant()
	const i = VARIANTS.findIndex((v) => v.key === current)
	const go = (d: number) => {
		const next = new URLSearchParams(params)
		next.set("variant", VARIANTS[(i + d + VARIANTS.length) % VARIANTS.length].key)
		navigate(`?${next}`, { replace: true, preventScrollReset: true })
	}
	// biome-ignore lint/correctness/useExhaustiveDependencies: prototype
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null
			if (t?.closest("input, textarea, [contenteditable]")) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [i, params])
	return (
		<div className="fixed bottom-3 left-3 z-[2000] flex items-center gap-1 rounded-full bg-fuchsia-700 px-1 py-1 text-xs font-bold text-white shadow-lg max-lg:bottom-[150px]">
			<button type="button" onClick={() => go(-1)} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Previous variant">
				<ChevronLeftIcon className="h-4 w-4" />
			</button>
			<span className="px-1 whitespace-nowrap">
				{current} · {VARIANTS[i].name}
			</span>
			<button type="button" onClick={() => go(1)} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Next variant">
				<ChevronRightIcon className="h-4 w-4" />
			</button>
		</div>
	)
}

