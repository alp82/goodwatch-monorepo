// The rail's "On this page" (ProgressIndex.tsx's look: icon, name, muted gist, the line that fills as the section is
// read) where an entry can carry indented children: a thin guide line under the entry's icon, quieter type, and one
// amber mark on the guide line. A child is a line (a part of a sub-page) or a small shelf card (a poster pile, the
// reason and the shelf's name). The same component is the title page's rail (TitleRail.tsx) and the sub-pages'
// (SubPageRail.tsx), so going into a sub-page only selects an entry and opens its children.
// - An entry with a sub-page shows the way in while its section is on screen: a chevron-right tab slides out from
//   under the entry's right end, past the column's edge (transform only, the entries keep their places), and slides
//   back when the section leaves. Where the page's right margin has no room for it (a narrow desktop window,
//   measured), the tab slides in over the entry's own right end instead.
// - The amber mark sits on the active child; where the children are blocks on the page (NavChild.target) it is one
//   continuous line over the part of the list that is on screen, following the scroll.
// - A sub-page's rail starts with a "Back to details" row.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	type ComponentType,
	type MouseEvent,
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"

export interface NavChild {
	id: string
	label: string
	/** A count or a short note at the right. */
	meta?: string | null
	/** A small caption above the label (a shelf's reason). */
	kind?: string | null
	/** A shelf's first posters: the child shows as a small shelf card. */
	pile?: (string | null)[] | null
	href?: string
	onSelect?: () => void
	/** What sits under the child (the tropes' letters). */
	extra?: ReactNode
	/** The child's block on the page: the amber line spans the part of the list that is on screen. */
	target?: () => Element | null
}

export interface NavEntry {
	id: string
	label: string
	icon: ComponentType<{ className?: string }>
	peek?: string | null
	/** On screen (the title page's highlight). */
	on?: boolean
	/** The entry this page is (a sub-page's own): highlighted, its children open. */
	selected?: boolean
	/** The section whose read progress the entry's line shows (null: no line). */
	progress?: string | null
	href?: string
	onSelect?: (e?: MouseEvent<HTMLElement>) => void
	children?: NavChild[]
	showChildren?: boolean
	activeChild?: string | null
	/** With children's targets, where the screen starts below the sticky bars (px from the top). */
	spanTop?: () => number
	/** The way into the entry's sub-page (or expanded view): a tab out to its right while `on`. */
	wayIn?: { label: string; href?: string; onSelect?: () => void } | null
}

/** The first row of a sub-page's rail: back to the title page, exactly where it was left. */
export interface NavBack {
	label: string
	href?: string
	onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
	onSelect?: () => void
}

export const NAV_STYLE = /* css */ `
@keyframes rail-children-in { from { opacity: 0; transform: translateY(-4px); } }
.rail-children { animation: rail-children-in 200ms cubic-bezier(.2,.8,.2,1) both; }
.rail-entry { transition: background-color 150ms, color 150ms, border-top-right-radius 0s 240ms, border-bottom-right-radius 0s 240ms; }
.rail-entry[data-tabbed=out] { border-top-right-radius: 0; border-bottom-right-radius: 0; transition-delay: 0s; }
.rail-tab { transition: transform 260ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease-out; }
@media (prefers-reduced-motion: reduce) { .rail-children { animation: none; } .rail-mark, .rail-tab, .rail-entry { transition: none !important; } }
`

const reduced = () =>
	typeof window !== "undefined" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Entries that moved since the last layout glide from where they were (transform only). */
function useGlide(sig: string) {
	const box = useRef<HTMLUListElement>(null)
	const tops = useRef(new Map<string, number>())
	useLayoutEffect(() => {
		const ul = box.current
		if (!ul) return
		const next = new Map<string, number>()
		for (const li of ul.querySelectorAll<HTMLElement>(
			":scope > li[data-entry]",
		)) {
			const id = li.dataset.entry ?? ""
			const top = li.offsetTop
			next.set(id, top)
			const was = tops.current.get(id)
			if (was === undefined || was === top || reduced()) continue
			li.animate(
				[{ transform: `translateY(${was - top}px)` }, { transform: "none" }],
				{
					duration: 220,
					easing: "cubic-bezier(.2,.8,.2,1)",
				},
			)
		}
		tops.current = next
	}, [sig])
	return box
}

export function RailNav({
	entries,
	label = "On this page",
	back,
}: { entries: NavEntry[]; label?: string; back?: NavBack }) {
	const sig = entries
		.map(
			(e) =>
				`${e.id}:${e.showChildren !== false ? (e.children?.length ?? 0) : 0}`,
		)
		.join("|")
	const box = useGlide(sig)
	const nav = useRef<HTMLElement>(null)
	const room = useTabRoom(
		nav,
		entries.some((e) => e.wayIn),
	)
	return (
		<nav ref={nav} aria-label={label} data-rail-nav="" data-tab-room={room}>
			<style>{NAV_STYLE}</style>
			{back && <BackRow back={back} />}
			<ul ref={box} className="flex flex-col gap-0.5">
				{entries.map((e) => {
					const out = !!(e.wayIn && e.on)
					return (
						<li key={e.id} data-entry={e.id}>
							<div className="relative">
								<EntryRow
									entry={e}
									tab={e.wayIn ? (out ? room : "off") : null}
								/>
								{e.wayIn && <SideTab wayIn={e.wayIn} shown={out} room={room} />}
							</div>
							{e.children &&
								e.children.length > 0 &&
								e.showChildren !== false && (
									<Children
										key={`${e.id}-kids`}
										items={e.children}
										active={e.activeChild ?? null}
										spanTop={e.spanTop}
									/>
								)}
						</li>
					)
				})}
			</ul>
		</nav>
	)
}

function BackRow({ back }: { back: NavBack }) {
	const className =
		"group mb-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-gray-300 transition-colors duration-150 hover:bg-white/[.04] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
	const body = (
		<>
			<ChevronLeftIcon
				aria-hidden="true"
				className="h-4 w-4 shrink-0 text-gray-500 transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:text-amber-300"
			/>
			<span className="truncate">{back.label}</span>
		</>
	)
	if (back.href)
		return (
			<Link
				to={back.href}
				prefetch="intent"
				onClick={back.onClick}
				data-rail-back=""
				className={className}
			>
				{body}
			</Link>
		)
	return (
		<button
			type="button"
			onClick={back.onSelect}
			data-rail-back=""
			className={className}
		>
			{body}
		</button>
	)
}

/** The tab's width, and the page's margin it needs right of the column to sit there (else it goes inside). */
const TAB_W = 28
const TAB_ROOM = TAB_W + 4 // 4 px clearance, so the page's 32 px margin below 88rem still fits the tab outside

type Room = "out" | "in"

/** Whether the window has room for the tab right of the rail's column. */
function useTabRoom(nav: RefObject<HTMLElement | null>, any: boolean): Room {
	const [room, setRoom] = useState<Room>("out")
	useLayoutEffect(() => {
		if (!any) return
		const read = () => {
			const el = nav.current
			if (!el) return
			const r = el.getBoundingClientRect()
			if (!r.width) return
			// The page's right edge: the body's (html's clientWidth can count a stable scrollbar gutter as room).
			const edge = Math.min(
				document.documentElement.clientWidth,
				document.body.clientWidth,
			)
			const next: Room = edge - r.right >= TAB_ROOM ? "out" : "in"
			setRoom((now) => (now === next ? now : next))
		}
		read()
		window.addEventListener("resize", read)
		return () => window.removeEventListener("resize", read)
	}, [any])
	return room
}

/**
 * The way into the entry's sub-page while its section is on screen: a chevron-right tab that slides out from under
 * the entry's right end, past the column (`out`), or over the entry's own right end where there is no room (`in`).
 * Hidden, it stays put behind its clip (no focus, no pointer), so it slides both ways.
 */
function SideTab({
	wayIn,
	shown,
	room,
}: { wayIn: NonNullable<NavEntry["wayIn"]>; shown: boolean; room: Room }) {
	const out = room === "out"
	const className = `rail-tab group/tab flex h-full w-full cursor-pointer items-center justify-center text-amber-300/80 hover:text-amber-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 ${
		out
			? "rounded-r-lg border-l border-white/[.06] bg-white/[.06] hover:bg-amber-300/[.12]"
			: "rounded-r-lg border-l border-white/[.08] bg-white/[.07] hover:bg-amber-300/[.12]"
	}`
	const style = {
		transform: shown ? "none" : out ? "translateX(-100%)" : "translateX(100%)",
		opacity: shown ? 1 : 0,
	}
	const body = (
		<ChevronRightIcon
			aria-hidden="true"
			className="h-5 w-5 transition-transform duration-150 group-hover/tab:translate-x-0.5"
		/>
	)
	const hidden = shown ? {} : { tabIndex: -1, "aria-hidden": true as const }
	return (
		<span
			className={`absolute inset-y-0 overflow-hidden ${out ? "left-full" : "right-0 rounded-r-lg"} ${shown ? "" : "pointer-events-none"}`}
			style={{ width: TAB_W }}
		>
			{wayIn.href ? (
				<Link
					to={wayIn.href}
					prefetch="intent"
					aria-label={wayIn.label}
					title={wayIn.label}
					data-rail-way-in=""
					className={className}
					style={style}
					{...hidden}
				>
					{body}
				</Link>
			) : (
				<button
					type="button"
					onClick={wayIn.onSelect}
					aria-label={wayIn.label}
					title={wayIn.label}
					data-rail-way-in=""
					className={className}
					style={style}
					{...hidden}
				>
					{body}
				</button>
			)}
		</span>
	)
}

function ReadLine({ id }: { id: string | null | undefined }) {
	return (
		<span
			aria-hidden="true"
			className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-white/[.06]"
		>
			<span
				{...(id ? { "data-read-progress": id } : {})}
				className="block h-full origin-left bg-amber-500/70"
				style={{ transform: "scaleX(0)" }}
			/>
		</span>
	)
}

function EntryRow({
	entry: e,
	tab = null,
}: { entry: NavEntry; tab?: Room | "off" | null }) {
	const Icon = e.icon
	const lit = e.on || e.selected
	// With the tab inside (no room right of the column), the entry's text leaves the tab its place.
	const className = `rail-entry group flex w-full cursor-pointer items-start gap-3 rounded-lg py-2 pl-2.5 text-left ${tab === "in" ? "pr-9" : "pr-2.5"} focus-visible:outline-2 focus-visible:outline-amber-300 ${
		lit
			? "bg-white/[.06] text-white"
			: "text-gray-400 hover:bg-white/[.03] hover:text-gray-100"
	}`
	const body = (
		<>
			<Icon
				className={`mt-0.5 h-4 w-4 shrink-0 ${lit ? "text-amber-400" : "text-gray-500 group-hover:text-gray-300"}`}
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium">{e.label}</span>
				{e.peek && (
					<span className="mt-0.5 block truncate text-xs text-gray-500">
						{e.peek}
					</span>
				)}
				{e.progress !== null && <ReadLine id={e.progress ?? e.id} />}
			</span>
		</>
	)
	const current = e.selected
		? ("page" as const)
		: e.on
			? ("location" as const)
			: undefined
	const tabbed = tab && tab !== "off" ? { "data-tabbed": tab } : {}
	if (e.href)
		return (
			<Link
				to={e.href}
				prefetch="intent"
				aria-current={current}
				onClick={e.onSelect}
				className={className}
				{...tabbed}
			>
				{body}
			</Link>
		)
	return (
		<button
			type="button"
			aria-current={current}
			onClick={e.onSelect}
			className={className}
			{...tabbed}
		>
			{body}
		</button>
	)
}

function Children({
	items,
	active,
	spanTop,
}: { items: NavChild[]; active: string | null; spanTop?: () => number }) {
	const box = useRef<HTMLUListElement>(null)
	const mark = useRef<HTMLSpanElement>(null)
	const placed = useRef(false)
	const spans = items.some((c) => c.target)
	const itemsRef = useRef(items)
	itemsRef.current = items
	const topRef = useRef(spanTop)
	topRef.current = spanTop
	// The mark goes to the active child: translate and scale only, from a 100 px tall bar.
	useLayoutEffect(() => {
		if (spans) return
		const ul = box.current
		const m = mark.current
		if (!ul || !m) return
		const li = active
			? ul.querySelector<HTMLElement>(`[data-kid="${CSS.escape(active)}"]`)
			: null
		if (!li) {
			m.style.opacity = "0"
			return
		}
		const h =
			(li.firstElementChild as HTMLElement | null)?.offsetHeight ??
			li.offsetHeight
		const inset = Math.min(6, h / 4)
		const transform = `translateY(${li.offsetTop + inset}px) scaleY(${Math.max(0.08, (h - 2 * inset) / 100)})`
		if (!placed.current) {
			m.style.transition = "none"
			m.style.transform = transform
			m.style.opacity = "1"
			void m.offsetWidth
			m.style.transition = ""
			placed.current = true
		} else {
			m.style.transform = transform
			m.style.opacity = "1"
		}
	}, [active, items.length, spans])
	// With targets, the mark is one line over the part of the list that is on screen: each child's share of its block that
	// shows (below the bars) is that share of the child's height, so the line runs from the first child's on-screen
	// part to the last's. Read once a frame on scroll (all reads, then one transform write).
	useLayoutEffect(() => {
		if (!spans) return
		const ul = box.current
		const m = mark.current
		if (!ul || !m) return
		m.style.transition = "opacity 150ms ease-out"
		let frame = 0
		let last = ""
		const read = () => {
			frame = 0
			const top = topRef.current?.() ?? 0
			const bottom = window.innerHeight
			let y0 = Number.POSITIVE_INFINITY
			let y1 = Number.NEGATIVE_INFINITY
			for (const c of itemsRef.current) {
				const el = c.target?.()
				if (!el) continue
				const r = el.getBoundingClientRect()
				if (!r.height) continue
				const a = Math.max(r.top, top)
				const b = Math.min(r.bottom, bottom)
				if (b <= a) continue
				const li = ul.querySelector<HTMLElement>(
					`:scope > [data-kid="${CSS.escape(c.id)}"]`,
				)
				if (!li) continue
				const h = li.offsetHeight
				y0 = Math.min(y0, li.offsetTop + ((a - r.top) / r.height) * h)
				y1 = Math.max(y1, li.offsetTop + ((b - r.top) / r.height) * h)
			}
			const next =
				y1 > y0
					? `translateY(${y0.toFixed(1)}px) scaleY(${(Math.max(2, y1 - y0) / 100).toFixed(4)})`
					: "off"
			if (next === last) return
			last = next
			if (next === "off") m.style.opacity = "0"
			else {
				m.style.transform = next
				m.style.opacity = "1"
			}
		}
		const on = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		read()
		window.addEventListener("scroll", on, { passive: true })
		window.addEventListener("resize", on)
		// Blocks that grow or arrive (shelves streaming in) move the line without a scroll.
		const t = window.setInterval(on, 400)
		return () => {
			window.removeEventListener("scroll", on)
			window.removeEventListener("resize", on)
			window.clearInterval(t)
			if (frame) cancelAnimationFrame(frame)
			m.style.transition = ""
		}
	}, [spans, items.length])
	return (
		<ul
			ref={box}
			className="rail-children relative mt-0.5 mb-1.5 ml-[1.15rem] flex flex-col gap-px border-l border-white/10"
		>
			<span
				ref={mark}
				aria-hidden="true"
				className="rail-mark pointer-events-none absolute top-0 -left-px h-[100px] w-0.5 origin-top rounded-full bg-amber-400 opacity-0 transition-[transform,opacity] duration-200 ease-out"
			/>
			{items.map((c) => (
				<li key={c.id} data-kid={c.id}>
					<ChildRow child={c} on={c.id === active} />
					{c.extra}
				</li>
			))}
		</ul>
	)
}

function ChildRow({ child: c, on }: { child: NavChild; on: boolean }) {
	const card = !!c.pile
	const className = `group/kid flex w-full cursor-pointer items-center gap-2.5 rounded-md text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-amber-300 ${
		card ? "py-1.5 pr-2 pl-3" : "py-1.5 pr-2 pl-3.5"
	} ${on ? "bg-white/[.05] text-white" : "text-gray-500 hover:bg-white/[.03] hover:text-gray-200"}`
	const body = card ? (
		<>
			<MiniPile posters={c.pile ?? []} />
			<span className="min-w-0 flex-1">
				{c.kind && (
					<span className="block truncate text-[10px] font-semibold tracking-[.12em] text-gray-500 uppercase">
						{c.kind}
					</span>
				)}
				<span
					className={`block truncate text-[13px] leading-5 ${on ? "font-semibold" : "font-medium text-gray-300 group-hover/kid:text-white"}`}
				>
					{c.label}
				</span>
			</span>
			{c.meta && (
				<span className="shrink-0 text-[11px] text-gray-600 tabular-nums">
					{c.meta}
				</span>
			)}
		</>
	) : (
		<>
			<span
				className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${on ? "font-medium" : ""}`}
			>
				{c.label}
			</span>
			{c.meta && (
				<span className="shrink-0 text-[11px] text-gray-600 tabular-nums">
					{c.meta}
				</span>
			)}
		</>
	)
	const current = on ? ("location" as const) : undefined
	if (c.href)
		return (
			<Link
				to={c.href}
				prefetch="intent"
				id={`rail-${c.id}`}
				aria-current={current}
				onClick={c.onSelect}
				className={className}
			>
				{body}
			</Link>
		)
	return (
		<button
			type="button"
			aria-current={current}
			onClick={c.onSelect}
			className={className}
		>
			{body}
		</button>
	)
}

/** A shelf's poster pile at rail size. */
function MiniPile({ posters }: { posters: (string | null)[] }) {
	return (
		<span aria-hidden="true" className="relative h-9 w-[2.1rem] shrink-0">
			{posters.slice(0, 3).map((p, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: three fixed places in the pile
					key={i}
					className="absolute top-0 h-9 w-6 overflow-hidden rounded-[5px] bg-gray-800 ring-1 ring-black/40"
					style={{
						left: i * 4,
						transform: `rotate(${(i - 1) * 4}deg)`,
						zIndex: 3 - i,
					}}
				>
					{p && (
						<img
							src={tmdbImageUrl(p, "w92")}
							alt=""
							loading="lazy"
							className="h-full w-full object-cover"
						/>
					)}
				</span>
			))}
		</span>
	)
}
