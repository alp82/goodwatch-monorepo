// PROTOTYPE - throwaway. Shared pieces for /prototype/rec-filter-bar-2 (issue #175, round 2).
// Builds on round 1's model and kit: the filter state, fake filtering, cards and recovery text stay the same.
// New here: a searchable, grouped filter panel with live counts, a drag sheet with snap points,
// scroll-direction hiding, a phone stage for the mobile docks, and small motion helpers.
import { CheckIcon, EyeSlashIcon, GlobeAltIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { CubeIcon, FilmIcon, FingerPrintIcon, HomeIcon, TvIcon as TvSolid } from "@heroicons/react/24/solid"
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion"
import { type PointerEvent as RPointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ProtoTitle } from "~/server/prototype-rec-filter-bar.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { LOGO, recoveryText, toCard } from "~/ui/prototype-rec-filter-bar/kit"
import { type Bar, type Filters, PEOPLE, RELEASES, SCORES, SORTS, TYPES, VIBES, allGenres, allServices, testers } from "~/ui/prototype-rec-filter-bar/model"
import { goodwatchVibeIndex } from "~/utils/ratings"

// ---------------------------------------------------------------- motion helpers

export const SPRING = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 } as const
export const SOFT = { type: "spring", stiffness: 300, damping: 32 } as const
export const TAP = { scale: 0.94 }

// A short tick on devices that support it. Desktop browsers ignore it.
export const buzz = (ms = 8) => {
	try {
		navigator.vibrate?.(ms)
	} catch {}
}

// Digits roll when the number changes, like a departure board.
export function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
	return (
		<span className={`relative inline-flex overflow-hidden tabular-nums ${className}`}>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span key={value} initial={{ y: "70%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-70%", opacity: 0 }} transition={SPRING}>
					{value}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

// ---------------------------------------------------------------- derived facts

export function useServices(bar: Bar) {
	return useMemo(() => {
		const mine = allServices(bar.catalog).filter((s) => bar.mine.includes(s.id))
		const names = mine.slice(0, 3).map((s) => s.name)
		const text = names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ") || "your services"
		return { mine, text }
	}, [bar.catalog, bar.mine])
}

export function countWith(bar: Bar, patch: Partial<Filters>) {
	const tests = Object.values(testers({ ...bar.filters, ...patch }, bar.mine, bar.catalog))
	return bar.catalog.filter((t) => tests.every((fn) => fn!(t))).length
}

// How many titles each first-class filter is hiding right now.
export function useCosts(bar: Bar) {
	return useMemo(() => {
		const n = bar.results.length
		return {
			mine: bar.filters.mine ? countWith(bar, { mine: false }) - n : 0,
			notSeen: bar.filters.notSeen ? countWith(bar, { notSeen: false }) - n : 0,
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bar.filters, bar.results])
}

// ---------------------------------------------------------------- small visual atoms

export function ServiceStack({ bar, on, size = 20, max = 3 }: { bar: Bar; on: boolean; size?: number; max?: number }) {
	const { mine } = useServices(bar)
	return (
		<span className="flex items-center" style={{ height: size }}>
			{mine.slice(0, max).map((s, i) => (
				<img
					key={s.id}
					src={`${LOGO}${s.logo}`}
					alt=""
					style={{ width: size, height: size, marginLeft: i ? -size * 0.32 : 0, zIndex: max - i }}
					className={`relative rounded-[28%] ring-2 ring-gray-950 object-cover transition duration-300 ${on ? "" : "grayscale opacity-50"}`}
				/>
			))}
		</span>
	)
}

export function ScoreDot({ score }: { score: number }) {
	return <span className={`h-2 w-2 rounded-full bg-vibe-${goodwatchVibeIndex(score)}`} />
}

// A thin proportional bar: what's showing, and what each filter hides.
export function HiddenMeter({ bar, className = "" }: { bar: Bar; className?: string }) {
	const total = bar.catalog.length
	const COLORS: Record<string, string> = { mine: "bg-emerald-600", notSeen: "bg-blue-600", providers: "bg-emerald-600" }
	return (
		<div className={`flex h-1.5 overflow-hidden rounded-full bg-white/5 ${className}`} aria-hidden>
			<motion.div layout transition={SOFT} className="h-full bg-amber-500" style={{ width: `${(bar.results.length / total) * 100}%` }} />
			{bar.recoveries.map((r) => (
				<motion.div layout transition={SOFT} key={r.key} className={`h-full ml-px opacity-70 ${COLORS[r.key] ?? "bg-gray-500"}`} style={{ width: `${(r.count / total) * 100}%` }} />
			))}
		</div>
	)
}

// Recovery actions as a list of tappable rows; used in popovers and sheets.
export function RecoveryList({ bar, onPick, limit = 3 }: { bar: Bar; onPick?: () => void; limit?: number }) {
	const DOT: Record<string, string> = { mine: "bg-emerald-500", notSeen: "bg-blue-500", providers: "bg-emerald-500" }
	if (!bar.recoveries.length) return <p className="px-1 text-sm text-gray-400">Nothing is hidden. Every title in this list is showing.</p>
	return (
		<div className="flex flex-col">
			{bar.recoveries.slice(0, limit).map((r) => (
				<motion.button
					key={r.key}
					type="button"
					whileTap={TAP}
					onClick={() => {
						buzz()
						bar.drop(r.key)
						onPick?.()
					}}
					className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5 cursor-pointer"
				>
					<span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.key] ?? "bg-gray-400"}`} />
					<span className="flex-1 text-sm text-gray-200">{recoveryText(r)}</span>
					<span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">Show</span>
				</motion.button>
			))}
		</div>
	)
}

// ---------------------------------------------------------------- sort list (fixed size)

export function SortList({ bar, onPick, dense = false }: { bar: Bar; onPick?: () => void; dense?: boolean }) {
	return (
		<div className="flex flex-col p-1.5">
			{SORTS.map((s) => {
				const on = s.key === bar.filters.sort
				return (
					<motion.button
						key={s.key}
						type="button"
						whileTap={TAP}
						onClick={() => {
							buzz()
							bar.set({ sort: s.key })
							onPick?.()
						}}
						className={`relative flex items-center gap-3 rounded-xl px-3 ${dense ? "py-2" : "py-2.5"} text-left cursor-pointer ${on ? "" : "hover:bg-white/5"}`}
					>
						{on && <motion.span layoutId="sort-list-hl" transition={SPRING} className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-white/10" />}
						<span className="relative flex-1">
							<span className={`block text-sm font-bold ${on ? "text-white" : "text-gray-300"}`}>{s.label}</span>
							<span className="block text-xs text-gray-500">{s.hint}</span>
						</span>
						<CheckIcon className={`relative h-4 w-4 text-amber-400 ${on ? "" : "invisible"}`} />
					</motion.button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------- the grouped, searchable filter panel

type Opt = { id: string; label: string; active: boolean; toggle: () => void; count: number; swatch?: ReactNode; img?: string; wide?: boolean }
type Group = { key: string; title: string; note?: string; accent: string; opts: Opt[]; kind?: "chips" | "logos" | "posters" }

export function useFilterGroups(bar: Bar): Group[] {
	return useMemo(() => {
		const f = bar.filters
		const c = (patch: Partial<Filters>) => countWith(bar, patch)
		const tog = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
		return [
			{
				key: "type",
				title: "Movies or shows",
				accent: "bg-teal-500",
				opts: TYPES.map((t) => ({ id: t.key, label: t.label, active: f.type === t.key, toggle: () => bar.set({ type: t.key }), count: c({ type: t.key }) })),
			},
			{
				key: "vibes",
				title: "Mood",
				note: "From each title's analysis",
				accent: "bg-indigo-500",
				opts: VIBES.map((v) => ({
					id: v.key,
					label: v.label,
					active: f.vibes.includes(v.key),
					toggle: () => bar.toggle("vibes", v.key),
					count: c({ vibes: tog(f.vibes, v.key) }),
					swatch: <span className="h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />,
				})),
			},
			{
				key: "genres",
				title: "Genre",
				accent: "bg-amber-500",
				opts: allGenres(bar.catalog)
					.slice(0, 16)
					.map((g) => ({ id: g, label: g, active: f.genres.includes(g), toggle: () => bar.toggle("genres", g), count: c({ genres: tog(f.genres, g) }) })),
			},
			{
				key: "minScore",
				title: "GoodWatch score",
				accent: "bg-lime-500",
				opts: SCORES.map((s) => ({
					id: String(s),
					label: s ? `${s} and up` : "Any score",
					active: f.minScore === s,
					toggle: () => bar.set({ minScore: s }),
					count: c({ minScore: s }),
					swatch: s ? <ScoreDot score={s} /> : undefined,
				})),
			},
			{
				key: "release",
				title: "Released",
				accent: "bg-cyan-500",
				opts: RELEASES.map((r) => ({ id: r.key, label: r.label, active: f.release === r.key, toggle: () => bar.set({ release: r.key }), count: c({ release: r.key }) })),
			},
			{
				key: "providers",
				title: "Streaming services",
				note: f.mine ? "Showing your services. Pick one to look somewhere else." : "Only titles on the services you pick",
				accent: "bg-emerald-500",
				kind: "logos",
				opts: allServices(bar.catalog)
					.slice(0, 12)
					.map((s) => ({
						id: String(s.id),
						label: s.name,
						img: `${LOGO}${s.logo}`,
						active: f.mine ? bar.mine.includes(s.id) : f.providers.includes(s.id),
						toggle: () => (f.mine ? bar.set({ mine: false, providers: [s.id] }) : bar.toggle("providers", s.id)),
						count: c(f.mine ? { mine: false, providers: [s.id] } : { providers: tog(f.providers, s.id) }),
					})),
			},
			{
				key: "similar",
				title: "Similar to",
				accent: "bg-rose-500",
				kind: "posters",
				opts: bar.catalog.slice(0, 8).map((t) => ({
					id: t.key,
					label: t.title,
					img: `https://image.tmdb.org/t/p/w154${t.poster_path}`,
					active: f.similar === t.key,
					toggle: () => bar.set({ similar: f.similar === t.key ? null : t.key }),
					count: c({ similar: f.similar === t.key ? null : t.key }),
				})),
			},
			{
				key: "people",
				title: "Cast and crew",
				accent: "bg-purple-500",
				opts: PEOPLE.map((p) => ({ id: p, label: p, active: f.people.includes(p), toggle: () => bar.toggle("people", p), count: c({ people: tog(f.people, p) }) })),
			},
		]
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bar.filters, bar.catalog, bar.mine])
}

const clearMore = { type: "all", genres: [], minScore: 0, release: "any", providers: [], similar: null, vibes: [], people: [] } as Partial<Filters>
export const clearMoreFilters = (bar: Bar) => bar.set(clearMore)

function OptChip({ o }: { o: Opt }) {
	const dead = !o.active && o.count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={o.active}
			whileTap={TAP}
			onClick={() => {
				buzz()
				o.toggle()
			}}
			className={`flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-full text-sm whitespace-nowrap cursor-pointer transition-colors ${
				o.active
					? "bg-white text-gray-950 font-bold shadow-[0_6px_20px_-6px_rgba(255,255,255,.35)]"
					: dead
						? "bg-white/[0.03] text-gray-600 ring-1 ring-white/5"
						: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
			}`}
		>
			{o.swatch}
			{o.label}
			<span className={`text-xs tabular-nums ${o.active ? "text-gray-500" : "text-gray-500"}`}>{o.active ? <CheckIcon className="h-3.5 w-3.5" /> : o.count}</span>
		</motion.button>
	)
}

function OptLogo({ o }: { o: Opt }) {
	return (
		<motion.button
			type="button"
			aria-pressed={o.active}
			title={o.label}
			whileTap={TAP}
			onClick={() => {
				buzz()
				o.toggle()
			}}
			className="group flex flex-col items-center gap-1 w-14 cursor-pointer"
		>
			<span className={`relative h-12 w-12 rounded-xl overflow-hidden transition ${o.active ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-950" : "opacity-45 grayscale group-hover:opacity-90 group-hover:grayscale-0"}`}>
				<img src={o.img} alt={o.label} className="h-full w-full object-cover" />
			</span>
			<span className="w-full truncate text-center text-[11px] text-gray-400">{o.label}</span>
		</motion.button>
	)
}

function OptPoster({ o }: { o: Opt }) {
	return (
		<motion.button
			type="button"
			aria-pressed={o.active}
			title={o.label}
			whileTap={TAP}
			onClick={() => {
				buzz()
				o.toggle()
			}}
			className={`w-14 shrink-0 rounded-lg overflow-hidden cursor-pointer transition ${o.active ? "ring-2 ring-rose-400 ring-offset-2 ring-offset-gray-950" : "opacity-60 hover:opacity-100"}`}
		>
			<img src={o.img} alt={o.label} className="w-full aspect-[2/3] object-cover" />
		</motion.button>
	)
}

// Search runs across every option; groups with no match disappear. Counts show what a tap would leave you with.
export function FilterPanel({ bar, query, columns = 1, className = "" }: { bar: Bar; query: string; columns?: 1 | 2; className?: string }) {
	const groups = useFilterGroups(bar)
	const q = query.trim().toLowerCase()
	const shown = groups
		.map((g) => ({ ...g, opts: q && !g.title.toLowerCase().includes(q) ? g.opts.filter((o) => o.label.toLowerCase().includes(q)) : g.opts }))
		.filter((g) => g.opts.length)
	if (!shown.length)
		return (
			<div className={`py-10 text-center ${className}`}>
				<p className="text-base font-bold text-white">No filter called "{query}"</p>
				<p className="mt-1 text-sm text-gray-400">Try a genre, a mood, a service, or a name.</p>
			</div>
		)
	return (
		<div className={`${columns === 2 ? "columns-2 gap-x-10 [&>section]:mb-7 [&>section]:break-inside-avoid" : "flex flex-col gap-7"} ${className}`}>
			{shown.map((g) => {
				const on = g.opts.filter((o) => o.active && !(g.key === "providers" && bar.filters.mine)).length
				const isDefault = (g.key === "type" && bar.filters.type === "all") || (g.key === "minScore" && !bar.filters.minScore) || (g.key === "release" && bar.filters.release === "any")
				return (
					<section key={g.key}>
						<header className="mb-3 flex items-center gap-2.5">
							<span className={`h-3.5 w-1 rounded-full ${g.accent}`} />
							<h3 className="text-[15px] font-bold text-white">{g.title}</h3>
							{on > 0 && !isDefault && <span className="rounded-full bg-white/10 px-2 text-xs font-bold tabular-nums text-white">{on}</span>}
							{g.note && <span className="ml-auto truncate text-xs text-gray-500">{g.note}</span>}
						</header>
						<div className={`flex flex-wrap ${g.kind === "logos" ? "gap-2" : g.kind === "posters" ? "gap-2.5" : "gap-2"}`}>
							{g.opts.map((o) => (g.kind === "logos" ? <OptLogo key={o.id} o={o} /> : g.kind === "posters" ? <OptPoster key={o.id} o={o} /> : <OptChip key={o.id} o={o} />))}
						</div>
					</section>
				)
			})}
		</div>
	)
}

export function SearchField({ value, onChange, autoFocus = false, className = "" }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; className?: string }) {
	return (
		<label className={`flex items-center gap-2.5 h-11 px-3.5 rounded-xl bg-white/[0.06] ring-1 ring-white/10 focus-within:ring-amber-500/70 ${className}`}>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<input
				value={value}
				autoFocus={autoFocus}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Find a filter: horror, Pedro, Netflix"
				className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none border-0 p-0 focus:ring-0"
			/>
			{value && (
				<button type="button" onClick={() => onChange("")} aria-label="Clear search" className="text-gray-500 hover:text-white cursor-pointer">
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

// The sheet footer: clear, and a live "Show N titles" that rolls as filters change.
export function ShowButton({ bar, onClick, className = "" }: { bar: Bar; onClick: () => void; className?: string }) {
	const n = bar.results.length
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			disabled={!n}
			className={`flex items-center justify-center gap-1.5 h-12 px-6 rounded-xl font-bold text-white cursor-pointer bg-linear-to-b from-amber-500 to-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_30px_-10px_rgba(217,119,6,.7)] disabled:from-gray-700 disabled:to-gray-800 disabled:shadow-none ${className}`}
		>
			{n ? (
				<>
					Show <RollingNumber value={n} /> {n === 1 ? "title" : "titles"}
				</>
			) : (
				"No titles match"
			)}
		</motion.button>
	)
}

// ---------------------------------------------------------------- scroll direction

// Hides on scroll down, shows on scroll up. Listens to the window and to the phone stage's own scroller.
export function useScrollHide(threshold = 10) {
	const [hidden, setHidden] = useState(false)
	const [atTop, setAtTop] = useState(true)
	useEffect(() => {
		const els: (Window | HTMLElement)[] = [window, ...Array.from(document.querySelectorAll<HTMLElement>("[data-stage-scroller]"))]
		const last = new Map<Window | HTMLElement, number>()
		const pos = (el: Window | HTMLElement) => (el === window ? window.scrollY : (el as HTMLElement).scrollTop)
		const handlers = els.map((el) => {
			last.set(el, pos(el))
			const fn = () => {
				const y = pos(el)
				const dy = y - (last.get(el) ?? 0)
				setAtTop(y < 40)
				if (y < 80) setHidden(false)
				else if (dy > threshold) setHidden(true)
				else if (dy < -threshold) setHidden(false)
				if (Math.abs(dy) > threshold) last.set(el, y)
			}
			el.addEventListener("scroll", fn, { passive: true })
			return () => el.removeEventListener("scroll", fn)
		})
		return () => handlers.forEach((off) => off())
	}, [threshold])
	return { hidden, atTop }
}

// ---------------------------------------------------------------- drag sheet with snap points

// Snaps are fractions of the stage height. The handle and header drag; content scrolls.
// index -1 means closed (only when dismissible).
export function DragSheet({
	index,
	onIndex,
	snaps,
	dismissible = true,
	header,
	footer,
	children,
	backdropFrom = 1,
	label = "Filters",
	className = "",
	bottomOffset = 0,
}: {
	index: number
	onIndex: (i: number) => void
	snaps: number[] // ascending, px when > 1
	dismissible?: boolean
	header?: ReactNode
	footer?: ReactNode
	children?: ReactNode
	backdropFrom?: number // snap index from which the backdrop shows
	label?: string
	className?: string
	bottomOffset?: number
}) {
	const wrap = useRef<HTMLDivElement>(null)
	const [H, setH] = useState(800)
	const h = useMotionValue(0)
	const drag = useRef<{ y: number; h: number; t: number; v: number } | null>(null)
	const px = useCallback((s: number) => (s > 1 ? s : s * H), [H])

	useEffect(() => {
		const el = wrap.current
		if (!el) return
		const ro = new ResizeObserver(() => setH(el.clientHeight))
		ro.observe(el)
		setH(el.clientHeight)
		return () => ro.disconnect()
	}, [])

	// Content only lives in the DOM while the sheet is open or closing.
	const [mounted, setMounted] = useState(index >= 0)
	useEffect(() => {
		if (index >= 0) setMounted(true)
		const target = index < 0 ? 0 : px(snaps[Math.min(index, snaps.length - 1)])
		const ctl = animate(h, target, { type: "spring", stiffness: 420, damping: 40, mass: 0.8 })
		ctl.then(() => index < 0 && setMounted(false))
		return () => ctl.stop()
	}, [index, H, px, snaps, h])

	useEffect(() => {
		if (index < 0) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onIndex(dismissible ? -1 : 0)
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [index, dismissible, onIndex])

	const onDown = (e: RPointerEvent) => {
		// Buttons inside the header stay buttons; drag from the handle or empty space.
		if ((e.target as HTMLElement).closest("button, a, input, label")) return
		;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
		drag.current = { y: e.clientY, h: h.get(), t: performance.now(), v: 0 }
	}
	const onMove = (e: RPointerEvent) => {
		const d = drag.current
		if (!d) return
		const now = performance.now()
		const next = Math.max(0, Math.min(H * 0.96, d.h + (d.y - e.clientY)))
		d.v = (next - h.get()) / Math.max(1, now - d.t)
		d.t = now
		h.set(next)
	}
	const onUp = () => {
		const d = drag.current
		drag.current = null
		if (!d) return
		const moved = Math.abs(h.get() - d.h)
		if (moved < 4) {
			// A tap on the handle steps up one snap, or back to the first from the top.
			const nextIdx = index >= snaps.length - 1 ? (dismissible ? -1 : 0) : index + 1
			buzz()
			onIndex(nextIdx)
			return
		}
		const projected = h.get() + d.v * 180
		const points = snaps.map(px)
		let best = 0
		for (let i = 1; i < points.length; i++) if (Math.abs(points[i] - projected) < Math.abs(points[best] - projected)) best = i
		if (dismissible && projected < points[0] * 0.6) best = -1
		buzz(best === index ? 4 : 10)
		if (best === index) animate(h, best < 0 ? 0 : points[best], { type: "spring", stiffness: 420, damping: 40 })
		onIndex(best)
	}

	const showBackdrop = index >= backdropFrom
	return (
		<div ref={wrap} className="fixed inset-x-0 top-[6%] bottom-0 z-[1001] pointer-events-none">
			<AnimatePresence>
				{showBackdrop && (
					<motion.div
						key="bd"
						className="fixed inset-0 bg-black/55 backdrop-blur-[2px] pointer-events-auto"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => onIndex(dismissible ? -1 : 0)}
					/>
				)}
			</AnimatePresence>
			<motion.div
				role="dialog"
				aria-label={label}
				style={{ height: h, bottom: bottomOffset }}
				className={`absolute inset-x-0 transition-[bottom] duration-300 flex flex-col overflow-hidden rounded-t-[28px] bg-gray-950/95 backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_-20px_60px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)] pointer-events-auto ${index < 0 ? "ring-0 shadow-none" : ""} ${className}`}
			>
				<div className="shrink-0 touch-none select-none cursor-grab active:cursor-grabbing" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
					<div className="flex justify-center pt-2.5 pb-1.5" aria-label="Drag to resize">
						<span className="h-1.5 w-10 rounded-full bg-white/25" />
					</div>
					{header}
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{mounted && children}</div>
				{mounted && footer}
			</motion.div>
		</div>
	)
}

// ---------------------------------------------------------------- the phone stage for mobile docks

// On a phone it's just the page. From lg up it becomes a 390 x 844 phone in the middle of the screen,
// with its own scroller; the transform makes "fixed" children stick to the phone, not the window.
export function PhoneStage({ children, title, pitch, notes }: { children: ReactNode; title: string; pitch: string; notes: string[] }) {
	return (
		<div className="lg:flex lg:h-[calc(100vh-4rem)] lg:items-center lg:justify-center lg:gap-16 lg:py-6 lg:bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,.08),transparent_60%)]">
			<aside className="hidden lg:block w-72 shrink-0">
				<p className="text-xs font-bold text-amber-500">Mobile dock</p>
				<h2 className="mt-1 brand-header text-3xl text-white">{title}</h2>
				<p className="mt-3 text-sm leading-relaxed text-gray-300">{pitch}</p>
				<ul className="mt-5 flex flex-col gap-2 text-sm text-gray-400">
					{notes.map((n) => (
						<li key={n} className="flex gap-2">
							<span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-500" />
							{n}
						</li>
					))}
				</ul>
				<p className="mt-6 text-xs text-gray-500">Scroll inside the phone to see the dock hide and return.</p>
			</aside>
			<div className="relative lg:h-[min(844px,calc(100vh-6rem))] lg:w-[390px] lg:shrink-0 lg:overflow-hidden lg:rounded-[52px] lg:bg-gray-950 lg:ring-[10px] lg:ring-gray-800 lg:shadow-[0_40px_120px_-20px_rgba(0,0,0,.9)] lg:[transform:translateZ(0)]">
				<div data-stage-scroller className="lg:h-full lg:overflow-y-auto lg:overflow-x-hidden lg:[scrollbar-width:none]">
					<FrameHeader />
					{children}
				</div>
			</div>
			{/* On phones the dock and the replica nav below take over from the site's own bottom nav.
			    The dev-only TanStack Query button would sit on the dock's right thumb zone, so it steps aside too. */}
			<style>{"@media (max-width: 1023px){div.fixed.bottom-0.left-0.z-50.w-full.border-t,.tsqd-open-btn-container{display:none!important}}"}</style>
		</div>
	)
}

// The site header as it looks at 390, only drawn inside the desktop phone frame (on phones the real one is there).
function FrameHeader() {
	return (
		<div className="hidden lg:flex sticky top-0 z-[70] h-16 items-center gap-3 bg-gray-900 px-4 pt-3">
			<span className="text-2xl font-black text-white">G</span>
			<span className="flex h-9 flex-1 items-center gap-2 rounded-md bg-gray-800 px-3 text-sm text-gray-500">
				<MagnifyingGlassIcon className="h-4 w-4" /> Search...
			</span>
			<span className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-bold text-gray-900">Sign In</span>
		</div>
	)
}

// The site's bottom nav, redrawn so docks can merge with it, hide it on scroll, or replace it.
export const NAV = [
	{ title: "Home", Icon: HomeIcon, to: "/" },
	{ title: "Discover", Icon: CubeIcon, to: "/discover" },
	{ title: "Movies", Icon: FilmIcon, to: "/movies" },
	{ title: "Shows", Icon: TvSolid, to: "/shows" },
]

export function NavTabs({ inlineTaste = false, className = "" }: { inlineTaste?: boolean; className?: string }) {
	const items = inlineTaste ? [NAV[0], NAV[1], null, NAV[2], NAV[3]] : NAV
	return (
		<nav className={`grid h-16 ${inlineTaste ? "grid-cols-5" : "grid-cols-4"} ${className}`}>
			{items.map((n) =>
				n ? (
					<a key={n.title} href={n.to} className={`flex flex-col items-center justify-center pt-2 pb-3 ${n.title === "Discover" ? "text-amber-500" : "text-gray-400"}`}>
						<n.Icon className="mb-1 h-5 w-5" />
						<span className="text-xs text-gray-200">{n.title}</span>
					</a>
				) : (
					<a key="taste" href="/taste" className="flex items-center justify-center" aria-label="Taste">
						<span className="grid h-11 w-11 place-items-center rounded-full bg-linear-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40">
							<FingerPrintIcon className="h-6 w-6 text-white" />
						</span>
					</a>
				),
			)}
		</nav>
	)
}

export function TasteFab({ className = "" }: { className?: string }) {
	return (
		<a href="/taste" aria-label="Taste" className={`absolute left-1/2 -translate-x-1/2 -top-6 grid h-14 w-14 place-items-center rounded-full bg-linear-to-br from-amber-500 to-amber-700 shadow-lg ${className}`}>
			<FingerPrintIcon className="h-7 w-7 text-white" />
		</a>
	)
}

// ---------------------------------------------------------------- phone grid

export function PhoneGrid({ bar, limit = 24 }: { bar: Bar; limit?: number }) {
	const items = bar.results.slice(0, limit)
	return (
		<div className="grid grid-cols-2 gap-3">
			<AnimatePresence initial={false} mode="popLayout">
				{items.map((t: ProtoTitle) => (
					<motion.div key={t.key} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.22 }}>
						<MovieTvCard details={toCard(t, bar.mine)} mediaType={t.media_type} />
					</motion.div>
				))}
			</AnimatePresence>
			<PhoneRecoveryCell bar={bar} />
		</div>
	)
}

function PhoneRecoveryCell({ bar }: { bar: Bar }) {
	if (!bar.recoveries.length) return null
	const empty = !bar.results.length
	return (
		<div className={`${empty ? "col-span-2 py-12" : "aspect-[2/3]"} flex flex-col justify-center gap-2 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10`}>
			<p className="text-sm font-bold text-white">{empty ? "Nothing matches all your filters" : `${bar.hidden} more hidden by your filters`}</p>
			{bar.recoveries.slice(0, 3).map((r) => (
				<button key={r.key} type="button" onClick={() => bar.drop(r.key)} className="text-left text-xs font-bold text-amber-400 cursor-pointer">
					{recoveryText(r)}
				</button>
			))}
		</div>
	)
}

// The first-class toggles' icons, for compact docks.
export const Icons = { EyeSlashIcon, GlobeAltIcon }
