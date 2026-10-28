// PROTOTYPE - throwaway. Variant I, "Mood tabs": the moods are the page's own navigation. Under today's heading and
// real FilterBar, a tab row over the grid: All, then each mood in its hue (the app's underline tabs). One tab is one
// mood. A "+" after the active tab opens a small popover to combine it with another mood (either one), About and
// Style, each with what it would leave; the combination becomes the tab's label ("Funny + Crime"). While searching,
// the All tab carries the query's Read as. On phones the tabs scroll sideways and stick under the header.
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import { DiscoverHeading } from "~/ui/discover/DiscoverHeading"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, SLAB_CLEARANCE } from "~/ui/filter-bar"
import { compactCount } from "~/ui/filter-bar/labels"
import { MENU, TAP } from "~/ui/filter-bar/motion"
import { STICKY_BAR } from "~/ui/layers"
import { GROUP_LABEL, ProtoGrid, type ProtoDiscover, TAGS, type Tag, type TagGroup, tagId } from "../kit"

export const NAME = "Mood tabs"

const MOODS = TAGS.filter((t) => t.group === "moods")
const GROUPS: TagGroup[] = ["moods", "themes", "styles"]
const POP_WIDTH = 360
const SHOWN = 8

const Dot = ({ color, className = "h-2 w-2" }: { color: string; className?: string }) => (
	<span aria-hidden className={`shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />
)

/** "Funny or Scary + Crime + Talky": either within a group, and across groups. */
const comboLabel = (tags: Tag[]) =>
	GROUPS.map((g) => tags.filter((t) => t.group === g).map((t) => t.name))
		.filter((list) => list.length)
		.map((list) => list.join(" or "))
		.join(" + ")

// ---------------------------------------------------------------------------------------------------------------
// The combine popover: other moods (either one), About and Style, by titles left.

function PopChip({ d, tag }: { d: ProtoDiscover; tag: Tag }) {
	const on = d.isOn(tag)
	const n = d.countFor(tag)
	const widens = !on && d.picked.some((t) => t.group === tag.group)
	// In a group with a pick it widens the list: say what it adds. Otherwise what it leaves.
	const label =
		n === null || on ? "" : widens ? (d.total !== null ? `+${compactCount(Math.max(0, n - d.total))}` : "") : compactCount(n)
	const dead = !on && !widens && n === 0
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={dead ? undefined : TAP}
			disabled={dead}
			onClick={() => d.toggle(tag)}
			className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on
					? "bg-white font-semibold text-gray-950 cursor-pointer"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white cursor-pointer"
			}`}
		>
			<Dot color={tag.color} />
			{tag.name}
			{label && <span className="text-[11px] tabular-nums text-gray-500">{label}</span>}
			{on && <XMarkIcon className="h-3.5 w-3.5 text-gray-500" />}
		</motion.button>
	)
}

function PopGroup({ d, group, exclude }: { d: ProtoDiscover; group: TagGroup; exclude?: string }) {
	const [all, setAll] = useState(false)
	const tags = TAGS.filter((t) => t.group === group && t.key !== exclude)
		.map((t) => ({ t, on: d.isOn(t), n: d.countFor(t) ?? 0 }))
		.sort((a, b) => Number(b.on) - Number(a.on) || b.n - a.n)
		.map((x) => x.t)
	const widening = d.picked.some((t) => t.group === group && t.key !== exclude)
	const shown = all ? tags : tags.slice(0, SHOWN)
	return (
		<section className="px-1.5 pt-3 first:pt-1.5">
			<h4 className="mb-2 flex items-baseline gap-1.5 px-0.5 text-[12px] text-gray-500">
				<span className="font-semibold text-gray-300">{group === "moods" ? "Another mood" : GROUP_LABEL[group]}</span>
				{(group === "moods" || widening) && <span>either one</span>}
			</h4>
			<div className="flex flex-wrap gap-1.5">
				{shown.map((t) => (
					<PopChip key={tagId(t)} d={d} tag={t} />
				))}
				{tags.length > SHOWN && (
					<button
						type="button"
						onClick={() => setAll(!all)}
						aria-expanded={all}
						className="flex h-8 items-center rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{all ? "Show fewer" : `+${tags.length - SHOWN} more`}
					</button>
				)}
			</div>
		</section>
	)
}

function CombinePopover({
	d,
	mood,
	left,
	onClose,
	trigger,
}: {
	d: ProtoDiscover
	mood: Tag | null
	left: number
	onClose: () => void
	trigger: React.RefObject<HTMLElement>
}) {
	const root = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const down = (event: Event) => {
			const target = event.target as Node
			if (root.current?.contains(target) || trigger.current?.contains(target)) return
			onClose()
		}
		const key = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			onClose()
			trigger.current?.focus()
		}
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }))
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [onClose, trigger])
	const combined = d.picked.filter((t) => !(mood && t.group === "moods" && t.key === mood.key))
	return (
		<motion.div
			ref={root}
			role="dialog"
			aria-label="Combine"
			initial={{ opacity: 0, y: -6, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -4, scale: 0.98 }}
			transition={{ duration: 0.14 }}
			style={{ left, width: POP_WIDTH }}
			className={`absolute top-full z-40 mt-1.5 max-w-[calc(100vw-2rem)] origin-top-left p-1.5 ${MENU}`}
		>
			<div className="max-h-[42vh] lg:max-h-[min(60vh,520px)] overflow-y-auto pb-1">
				{mood && <PopGroup d={d} group="moods" exclude={mood.key} />}
				<PopGroup d={d} group="themes" />
				<PopGroup d={d} group="styles" />
			</div>
			<div className="mt-1 flex items-center gap-3 border-t border-white/[0.06] px-2 pt-2 pb-0.5">
				<span className="min-w-0 flex-1 truncate text-[13px] text-gray-400 tabular-nums">
					{d.total !== null && (
						<>
							<span className="font-bold text-white">{d.total.toLocaleString("en")}</span>{" "}
							{d.q ? (d.total === 1 ? "match" : "matches") : "showing"}
						</>
					)}
				</span>
				{combined.length > 0 && (
					<button
						type="button"
						onClick={() =>
							d.filters.update((s) => ({
								...s,
								moods: mood ? [mood.key as (typeof s.moods)[number]] : [],
								themes: [],
								styles: [],
							}))
						}
						className="rounded-md px-1.5 py-1 text-[13px] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
				<button
					type="button"
					onClick={onClose}
					className="h-8 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-white cursor-pointer outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					Done
				</button>
			</div>
		</motion.div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The tab row.

const TAB =
	"-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:text-base"

function MoodTabs({ d }: { d: ProtoDiscover }) {
	const active = d.picked.find((t) => t.group === "moods") ?? null
	const others = d.picked.filter((t) => t.group !== "moods")
	const [open, setOpen] = useState(false)
	const [left, setLeft] = useState(0)
	const bar = useRef<HTMLDivElement>(null)
	const strip = useRef<HTMLDivElement>(null)
	const plus = useRef<HTMLButtonElement>(null)
	const activeKey = active?.key ?? "all"

	// The active tab comes into view when it changes (phones).
	useLayoutEffect(() => {
		const tab = strip.current?.querySelector<HTMLElement>(`[data-tab="${activeKey}"]`)
		if (!tab || !strip.current) return
		const s = strip.current
		const end = (plus.current?.offsetLeft ?? 0) + (plus.current?.offsetWidth ?? 0)
		if (tab.offsetLeft < s.scrollLeft || end > s.scrollLeft + s.clientWidth)
			s.scrollTo({ left: Math.max(0, tab.offsetLeft - 16), behavior: "smooth" })
	}, [activeKey])

	const place = () => {
		const b = bar.current?.getBoundingClientRect()
		const p = plus.current?.getBoundingClientRect()
		if (!b || !p) return
		const width = Math.min(POP_WIDTH, b.width - 32)
		setLeft(Math.max(16, Math.min(p.left - b.left - 12, b.width - width - 16)))
	}
	useEffect(() => {
		if (!open) return
		const s = strip.current
		const close = () => setOpen(false)
		s?.addEventListener("scroll", close, { passive: true })
		window.addEventListener("resize", close)
		return () => {
			s?.removeEventListener("scroll", close)
			window.removeEventListener("resize", close)
		}
	}, [open])
	useEffect(() => setOpen(false), [activeKey])

	const go = (mood: Tag | null) => {
		if ((mood?.key ?? "all") === activeKey) return
		d.filters.update((s) => ({
			...s,
			moods: mood ? [mood.key as (typeof s.moods)[number]] : [],
			themes: [],
			styles: [],
		}))
	}
	const count = d.total !== null && (
		<span className="min-w-[3ch] text-xs font-normal tabular-nums text-gray-500">{compactCount(d.total)}</span>
	)
	const combinedCount = d.picked.length - (active ? 1 : 0)
	const plusButton = (hue: string) => (
		<motion.button
			ref={plus}
			type="button"
			whileTap={TAP}
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-label={active ? `Combine ${active.name}` : "Combine"}
			onClick={() => {
				place()
				setOpen(!open)
			}}
			className={`-ml-1.5 mr-2 grid h-7 w-7 shrink-0 place-items-center self-center rounded-full ring-1 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				open ? "bg-white text-gray-950 ring-white" : "bg-white/[0.06] text-gray-300 ring-white/15 hover:bg-white/[0.12] hover:text-white"
			}`}
			style={open ? undefined : { boxShadow: combinedCount ? `0 0 0 1px ${hue}66` : undefined }}
		>
			<PlusIcon className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} />
		</motion.button>
	)

	return (
		<div
			ref={bar}
			className={`sticky top-16 ${STICKY_BAR} -mx-4 border-b border-white/10 bg-gray-950/95 lg:-mx-8`}
		>
			<div
				ref={strip}
				role="tablist"
				aria-label="Mood"
				className="flex items-stretch overflow-x-auto px-2 [scrollbar-width:none] lg:px-5"
			>
				<button
					type="button"
					role="tab"
					data-tab="all"
					aria-selected={!active}
					onClick={() => go(null)}
					className={`${TAB} ${!active ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-100"}`}
				>
					{d.q && d.reading.length ? (
						<>
							<span className={active ? "text-gray-400" : "text-white"}>Read as</span>
							<ReadAsChips reading={d.reading} className="flex-nowrap!" />
						</>
					) : !active && others.length ? (
						comboLabel(others)
					) : (
						"All"
					)}
					{!active && count}
				</button>
				{!active && plusButton("#fbbf24")}
				{MOODS.map((t) => {
					const on = active?.key === t.key
					return (
						<Fragment key={t.key}>
						<button
							type="button"
							role="tab"
							data-tab={t.key}
							aria-selected={on}
							title={t.description}
							onClick={() => go(t)}
							className={`${TAB} ${on ? "text-white" : "border-transparent text-gray-400 hover:text-gray-100"}`}
							style={on ? { borderColor: t.color } : undefined}
						>
							<Dot color={t.color} className={on ? "h-2.5 w-2.5" : "h-2 w-2 opacity-80"} />
							{on ? comboLabel(d.picked) : t.name}
							{on && count}
						</button>
						{on && plusButton(t.color)}
						</Fragment>
					)
				})}
			</div>
			<AnimatePresence>
				{open && <CombinePopover d={d} mood={active} left={left} onClose={() => setOpen(false)} trigger={plus} />}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantI({ d }: { d: ProtoDiscover }) {
	return (
		<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
			<DiscoverHeading q={d.q} onSearch={(text) => d.setQ(text)} onClear={() => d.setQ(null)} explanation={null} />
			{/* The real bar, as today. On phones its quick-filter row makes way for the tabs; the slab stays. */}
			<div className="lg:mt-4 [&>div:nth-child(2)>div:first-child]:hidden">
				<FilterBar filters={d.filters} counts={d.counts} />
			</div>
			<div className="mt-3 lg:mt-4">
				<MoodTabs d={d} />
			</div>
			<div className="mt-4">
				<ProtoGrid d={d} />
			</div>
		</div>
	)
}
