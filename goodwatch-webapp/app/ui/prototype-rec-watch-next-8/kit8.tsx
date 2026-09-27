// PROTOTYPE - throwaway. Shared pieces for round 8 of Watch next (#176), the decided model: the desktop
// `docked` strip with round 7's `grid` mood dropdown and a sort select (Best match by default), the hero line,
// and round 3's poster, peek, suggestion row, and stepped grid without any queue position or reordering.
import { ArrowsUpDownIcon, BookmarkIcon, CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Poster } from "~/ui/Poster"
import { ServiceTiles, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { type Offer, backdropUrl, ownedOffers, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, ageLabel, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { DISPLAY, Match, SHORT, WRAP } from "~/ui/prototype-rec-watch-next-3/kit3"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import type { Tier } from "~/ui/prototype-rec-watch-next-4/kit4"
import { type Ctx7, Count, EASE, Float, type Look, MoodButton, ServicesToggle } from "~/ui/prototype-rec-watch-next-7/kit7"
import { MOOD } from "~/ui/prototype-rec-watch-next-7/moods"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import UserDataOverlay from "~/ui/user/UserDataOverlay"
import { SORT8, SORTS8, type Sel8, type SortKey8, heroLabel, sortFact } from "./view8"

// Round 7's context with a round-8 selection. Round 7's pieces read only moods and services from it.
export type Ctx8 = Omit<Ctx7, "sel" | "setSel"> & { sel: Sel8; setSel: (s: Sel8) => void }
export const as7 = (c: Ctx8) => c as unknown as Ctx7

// ------------------------------------------------------------------ sort select

export function SortMenu({ c }: { c: Ctx8 }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const btn = useRef<HTMLButtonElement>(null)
	const [box, setBox] = useState<{ top: number; right: number } | null>(null)
	const by = c.sel.by
	useLayoutEffect(() => {
		if (!open) return
		const place = () => {
			const r = btn.current?.getBoundingClientRect()
			if (!r) return
			if (r.bottom < 60) return setOpen(false)
			setBox({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
		}
		place()
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => (window.removeEventListener("scroll", place), window.removeEventListener("resize", place))
	}, [open])
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node) && setOpen(false)
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => (window.removeEventListener("pointerdown", off), window.removeEventListener("keydown", esc))
	}, [open])
	const pick = (k: SortKey8) => (c.setSel({ ...c.sel, by: k }), setOpen(false))
	return (
		<>
			<button
				ref={btn}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`Sort: ${SORT8[by].label}`}
				data-order
				onClick={() => setOpen(!open)}
				className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-3 text-sm font-semibold text-gray-100 ring-1 ring-white/15 transition-colors hover:bg-white/20"
			>
				<ArrowsUpDownIcon className="h-4 w-4 text-amber-300" />
				{SORT8[by].label}
				<ChevronDownIcon className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			{typeof document !== "undefined" &&
				createPortal(
					<AnimatePresence>
						{open && box && (
							<motion.div
								ref={ref}
								role="menu"
								aria-label="Sort"
								initial={{ opacity: 0, y: -6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -6 }}
								transition={{ duration: 0.18, ease: EASE }}
								className="fixed z-[70] w-[min(22rem,calc(100vw-1rem))] rounded-2xl bg-gray-900/95 p-1.5 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12 backdrop-blur-xl"
								style={{ top: box.top, right: box.right }}
							>
								<SortOptions c={c} onPick={pick} />
							</motion.div>
						)}
					</AnimatePresence>,
					document.body,
				)}
		</>
	)
}

// The six sorts as radio rows, for the desktop menu.
export function SortOptions({ c, onPick }: { c: Ctx8; onPick: (k: SortKey8) => void }) {
	const by = c.sel.by
	return (
		<>
			{SORTS8.map((s) => (
				<button
					key={s.key}
					type="button"
					role="menuitemradio"
					aria-checked={by === s.key}
					data-sort={s.key}
					onClick={() => onPick(s.key)}
					className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-white/8 ${by === s.key ? "bg-white/10" : ""}`}
				>
					<span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${by === s.key ? "bg-white text-black" : "ring-1 ring-white/30"}`}>{by === s.key && <CheckIcon className="h-3 w-3" />}</span>
					<span className="min-w-0">
						<span className="block text-sm font-semibold text-white">{s.label}</span>
						<span className="block text-xs text-gray-400">{s.line}</span>
					</span>
				</button>
			))}
		</>
	)
}

// ------------------------------------------------------------------ the docked strip (desktop and tablet)

function StripBody({ c, look, pinned }: { c: Ctx8; look: Look; pinned: boolean }) {
	const anchor = useRef<HTMLDivElement>(null)
	const picked = c.sel.moods.length > 0
	const c7 = as7(c)
	const { Picked, Panel } = look
	return (
		<div ref={anchor} className="relative">
			<div className={`flex items-center gap-2 ${pinned ? "h-12" : "h-14 rounded-2xl bg-black/45 px-2 ring-1 ring-white/10 backdrop-blur-md"}`}>
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					{picked && (
						<div className="-my-1 flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]" role="group" aria-label="Picked moods">
							<Picked c={c7} pinned={pinned} />
						</div>
					)}
					<MoodButton c={c7} picked={picked} pinned={pinned} />
					<Count c={c7} className={`shrink-0 pl-1 pr-1.5 ${pinned ? "hidden lg:inline" : ""}`} />
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<ServicesToggle c={c7} compact={pinned} />
					<SortMenu c={c} />
				</div>
			</div>
			<Float c={c7} anchor={anchor} strip={anchor} look={look} pinned={pinned}>
				<Panel c={c7} pinned={pinned} />
			</Float>
		</div>
	)
}

// The strip on the hero's top edge from md up. Once it scrolls away, the same line waits under the header.
// On a phone the controls live at the bottom instead (see mobile8).
export function Docked8({ c, look }: { c: Ctx8; look: Look }) {
	const ref = useRef<HTMLDivElement>(null)
	const [gone, setGone] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(([e]) => setGone(!e.isIntersecting && e.boundingClientRect.top < 80 && window.innerWidth >= 768), { rootMargin: "-64px 0px 0px 0px" })
		io.observe(el)
		return () => io.disconnect()
	}, [])
	useEffect(() => c.setOpen(false), [gone])
	return (
		<>
			<div ref={ref} data-sel className="hidden md:block">
				{gone ? <div className="h-14" /> : <StripBody c={c} look={look} pinned={false} />}
			</div>
			{gone &&
				typeof document !== "undefined" &&
				createPortal(
					<motion.div data-pinned initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE }} className="fixed inset-x-0 top-16 z-40 hidden border-b border-white/10 bg-gray-900/90 backdrop-blur-md md:block">
						<div className={WRAP}>
							<StripBody c={c} look={look} pinned />
						</div>
					</motion.div>,
					document.body,
				)}
		</>
	)
}

// ------------------------------------------------------------------ hero line

// Above the hero's title: what the pick is under this sort and these moods, the value the sort read, its moods.
export function Eyebrow8({ c, t }: { c: Ctx8; t: WTitle }) {
	const { sel, v } = c
	const fitsAll = !v.need || v.fit.get(t.key) === v.need
	const fact = sortFact(c.q, c.x, sel.by, t)
	const moods = c.x[t.key]?.m ?? []
	return (
		<motion.div key={`${t.key}:${sel.by}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold" data-eyebrow>
			<span className="text-amber-300" data-herolabel>
				{heroLabel(sel, fitsAll)}
			</span>
			{fact && sel.by !== "match" && <span className="text-gray-300">{fact}</span>}
			{moods.length > 0 && (
				<span className="flex flex-wrap items-center gap-1.5">
					{moods.slice(0, 3).map((m) => {
						const on = sel.moods.includes(m)
						return (
							<span key={m} className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs ${on ? "text-black" : "bg-black/40 text-gray-200 ring-1 ring-white/15"}`} style={on ? { background: MOOD[m].hue } : undefined}>
								{!on && <span className="h-2 w-2 rounded-full" style={{ background: MOOD[m].hue }} />}
								{MOOD[m].name}
							</span>
						)
					})}
				</span>
			)}
		</motion.div>
	)
}

// ------------------------------------------------------------------ Want to See, without a position

// Off: "Want to See". On: a filled bookmark; tapping it again takes the title off the Wishlist.
export function Want8({ q, t, size = "md", className = "" }: { q: Queue; t: WTitle; size?: "sm" | "md" | "lg"; className?: string }) {
	const on = q.inQueue(t.key)
	const h = size === "lg" ? "h-12 px-5 text-base" : size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
	const base = `inline-flex items-center gap-1.5 rounded-full font-bold shadow-lg shadow-black/50 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white ${h} ${className}`
	if (!on)
		return (
			<button type="button" onClick={() => q.addQ(t.key, "bottom")} className={`${base} bg-white/95 text-black hover:bg-white`} aria-label={`Want to See: ${t.title}`}>
				<BookmarkIcon className="h-4 w-4 text-amber-600" />
				Want to See
			</button>
		)
	return (
		<button type="button" onClick={() => q.remove(t.key)} className={`${base} bg-amber-400 text-black hover:bg-amber-300`} aria-label={`${t.title} is on your Wishlist. Remove it`} title="On your Wishlist. Tap to remove.">
			<BookmarkIcon className="h-4 w-4" />
			{size === "sm" ? <CheckIcon className="h-3.5 w-3.5" /> : "On your Wishlist"}
		</button>
	)
}

const overlayLinks = (offers: Offer[]) => offers.map((o) => ({ provider_id: o.id, provider_name: o.name, provider_logo_path: o.logo.split("/original/")[1] })) as never

// The production MovieTvCard look with the Want to See button on the bottom right.
export function QPoster8({ t, q, onOpen, meta }: { t: WTitle; q: Queue; onOpen?: (t: WTitle) => void; meta?: React.ReactNode }) {
	const on = q.inQueue(t.key)
	return (
		<div className="relative">
			<a
				href={`#${t.key}`}
				onClick={(e) => (e.preventDefault(), onOpen?.(t))}
				className={`@container group flex w-full flex-col rounded-lg border-4 bg-gray-900 transition-colors hover:bg-gray-800 ${on ? "border-gray-800 hover:border-amber-700/50" : "border-gray-800 hover:border-amber-700/50"}`}
			>
				<div className="relative">
					<UserDataOverlay score={(q.state.ratings[t.key] ?? null) as never} onWishList={false} />
					<RatingOverlay ratings={{ goodwatch_overall_score_normalized_percent: t.score } as never} />
					<StreamingOverlay links={overlayLinks(ownedOffers(t))} />
					<Poster path={t.poster ?? undefined} title={t.title} />
					<div className="absolute bottom-0 hidden min-h-32 w-full items-end overflow-hidden bg-linear-to-t from-black/85 to-transparent px-2 pb-12 pt-2 @6xs:flex">
						<span className="text-sm font-bold leading-tight text-white">
							{t.title}
							{t.year ? <span className="font-normal text-gray-300"> ({t.year})</span> : null}
						</span>
					</div>
				</div>
			</a>
			<div className="absolute inset-x-2 bottom-3 z-10 flex justify-end">
				<Want8 q={q} t={t} size="sm" />
			</div>
			{meta !== undefined && <div className="mt-1 truncate px-1 text-xs text-gray-400">{meta}</div>}
		</div>
	)
}

// ------------------------------------------------------------------ stepped grid

const GRID: Record<Tier["size"], string> = {
	xl: "grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4",
	lg: "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3",
	md: "grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2",
	sm: "grid grid-cols-6 gap-1 md:flex md:flex-wrap md:gap-1.5",
}
const ITEM: Record<Tier["size"], string> = { xl: "md:w-56", lg: "md:w-36", md: "md:w-24", sm: "md:w-16" }
const HEAD: Record<Tier["size"], string> = { xl: "text-3xl md:text-4xl text-amber-300", lg: "text-2xl md:text-3xl text-white", md: "text-xl md:text-2xl text-gray-200", sm: "text-lg md:text-xl text-gray-400" }
const CAP: Record<Tier["size"], number> = { xl: 99, lg: 99, md: 40, sm: 30 }

// Round 4's stepped grid: large now, smaller further out. The biggest step says what the sort read.
export function Tiers8({ c, tiers, onPeek }: { c: Ctx8; tiers: Tier[]; onPeek: (t: WTitle) => void }) {
	return (
		<LayoutGroup>
			<ol aria-label="Your Wishlist, stepped">
				{tiers
					.filter((t) => t.keys.length)
					.map((tier) => (
						<TierRow key={tier.key} c={c} tier={tier} onPeek={onPeek} />
					))}
			</ol>
		</LayoutGroup>
	)
}

function TierRow({ c, tier, onPeek }: { c: Ctx8; tier: Tier; onPeek: (t: WTitle) => void }) {
	const { q } = c
	const [all, setAll] = useState(false)
	const titles = tier.keys.map(q.T).filter((t): t is WTitle => !!t)
	const shown = all ? titles : titles.slice(0, CAP[tier.size])
	const big = tier.size === "xl" || tier.size === "lg"
	const meta = (t: WTitle) => {
		const f = sortFact(q, c.x, c.sel.by, t)
		const w = watchLine(t)
		return [f ?? runtimeLabel(t), w.owned && w.offer ? `on ${w.offer.name}` : null].filter(Boolean).join(", ")
	}
	return (
		<li className={`grid gap-3 md:grid-cols-[12rem_1fr] md:gap-8 ${tier.size === "xl" ? "pb-12" : tier.size === "lg" ? "pb-10" : "pb-8"}`} data-tier={tier.key}>
			<div className="md:sticky md:top-32 md:self-start md:text-right">
				<h3 className={`${DISPLAY} leading-none ${HEAD[tier.size]}`}>{tier.label}</h3>
				<p className="mt-1 text-sm text-gray-400">
					{tier.note ? `${tier.note} ` : ""}
					{titles.length} {titles.length === 1 ? "title" : "titles"}
				</p>
			</div>
			<div className={`min-w-0 ${GRID[tier.size]}`}>
				{shown.map((t) =>
					big ? (
						<motion.div key={t.key} layoutId={`p8-${t.key}`} transition={{ type: "spring", stiffness: 380, damping: 34 }} className={`min-w-0 ${ITEM[tier.size]}`} data-key={t.key}>
							<QPoster8 t={t} q={q} onOpen={onPeek} meta={tier.size === "xl" ? meta(t) : undefined} />
						</motion.div>
					) : (
						<div key={t.key} className={`min-w-0 ${ITEM[tier.size]}`} data-key={t.key}>
							<button type="button" onClick={() => onPeek(t)} className="block w-full cursor-pointer" title={t.title}>
								<img src={posterUrl(t, tier.size === "md" ? "w185" : "w92")} alt={t.title} loading="lazy" className={`aspect-[2/3] w-full rounded-md object-cover ring-1 ring-white/5 ${tier.size === "sm" ? "opacity-75 hover:opacity-100" : ""}`} />
							</button>
						</div>
					),
				)}
				{titles.length > shown.length && (
					<button type="button" onClick={() => setAll(true)} className={`flex aspect-[2/3] cursor-pointer items-center justify-center rounded-md bg-white/5 text-center text-xs font-semibold text-gray-300 hover:bg-white/10 ${ITEM[tier.size]}`}>
						+{titles.length - shown.length}
					</button>
				)}
			</div>
		</li>
	)
}

// ------------------------------------------------------------------ suggestions while the Wishlist is short

export function Suggest8({ q, onOpen, className = "" }: { q: Queue; onOpen?: (t: WTitle) => void; className?: string }) {
	const [keys] = useState(() => {
		const b = q.suggest.because(10)
		const skip = q.count === 0 ? q.suggest.forYou(1)[0]?.key : undefined
		const mix = [...(b?.titles ?? []), ...q.suggest.forYou(24)].filter((t) => t.key !== skip)
		return { seed: b?.seed.title ?? null, keys: mix.filter((t, i) => mix.findIndex((x) => x.key === t.key) === i).slice(0, 18).map((t) => t.key) }
	})
	if (q.count >= SHORT) return null
	const titles = keys.keys.map(q.T).filter((t): t is WTitle => !!t && !q.isSeen(t.key))
	return (
		<section className={className} aria-label="Suggestions to add">
			<div className="mb-3">
				<h2 className="text-lg font-bold text-white md:text-xl">{q.count === 0 ? "Start your Wishlist" : "Worth adding"}</h2>
				<p className="text-sm text-gray-400">
					{keys.seed ? `Like ${keys.seed}, and your best matches. ` : "Your best matches on your services. "}
					Tap Want to See and it joins Watch next under your sort.
				</p>
			</div>
			<div className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
				{titles.map((t) => (
					<div key={t.key} className="w-[8.5rem] shrink-0 snap-start md:w-[10.5rem]">
						<QPoster8 t={t} q={q} onOpen={onOpen} meta={<Match t={t} />} />
					</div>
				))}
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ peek

export function Peek8({ q, t, onClose }: { q: Queue; t: WTitle | null; onClose: () => void }) {
	useEffect(() => {
		if (!t) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [t])
	const on = t ? q.inQueue(t.key) : false
	return (
		<AnimatePresence>
			{t && (
				<motion.div className="fixed inset-0 z-[1080] flex items-end justify-center bg-black/70 md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
					<motion.div
						role="dialog"
						aria-label={`${t.title} details`}
						initial={{ y: 40 }}
						animate={{ y: 0 }}
						exit={{ y: 40 }}
						className="relative isolate max-h-[92vh] w-full max-w-3xl overflow-hidden overflow-y-auto rounded-t-2xl bg-gray-900 md:rounded-2xl"
						onClick={(e) => e.stopPropagation()}
					>
						<img src={backdropUrl(t, "w1280")} alt="" className="absolute inset-x-0 top-0 -z-10 h-72 w-full object-cover object-[center_25%] opacity-60" />
						<div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-transparent to-gray-900" />
						<button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-20 cursor-pointer rounded-full bg-black/50 p-2 text-white hover:bg-black/80">
							<XMarkIcon className="h-5 w-5" />
						</button>
						<div className="flex gap-5 p-5 pt-28 md:p-7 md:pt-32">
							<img src={posterUrl(t, "w342")} alt="" className="hidden w-40 shrink-0 self-start rounded-xl shadow-2xl shadow-black ring-1 ring-white/10 sm:block" />
							<div className="min-w-0 flex-1">
								<h2 className={`${DISPLAY} text-4xl leading-[0.95] text-white md:text-5xl`}>{t.title}</h2>
								<p className="mt-2 text-sm text-gray-300">{[t.year, runtimeLabel(t), t.genres.join(", ")].filter(Boolean).join(", ")}</p>
								<div className="mt-4 flex items-center gap-4">
									<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: t.score } } as never} size={48} />
									{t.match && <p className="text-sm text-gray-300">{t.match}% taste match</p>}
								</div>
								{t.tagline && <p className="mt-3 text-gray-200">{t.tagline}</p>}
								<div className="mt-4">
									<ServiceTiles title={t} size={40} max={4} names />
								</div>
								<div className="mt-5">
									<Want8 q={q} t={t} size="lg" />
								</div>
								{on && <p className="mt-3 text-xs text-gray-400">On your Wishlist, added {ageLabel(q.addedAt(t.key), q.now)}.</p>}
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ------------------------------------------------------------------ demo controls

// Prototype chrome, apart from the design. On a phone it starts folded at the top so the bottom stays clear.
export function DemoBar8({ signedIn, mode, count, onReset, onSim }: { signedIn: boolean; mode: string; count: number; onReset: () => void; onSim: () => void }) {
	const [params] = useSearchParams()
	const [open, setOpen] = useState(true)
	useEffect(() => setOpen(window.innerWidth >= 768), [])
	const href = (v: string) => {
		const p = new URLSearchParams(params)
		p.set("wishlist", v)
		return `?${p.toString()}`
	}
	const seg = (v: string, label: string, disabled = false) =>
		disabled ? (
			<span key={v} className="rounded-full px-2.5 py-1 text-neutral-400" title="Sign in to see your own Wishlist">
				{label}
			</span>
		) : (
			<Link key={v} to={href(v)} replace preventScrollReset className={`rounded-full px-2.5 py-1 ${mode === v ? "bg-black text-white" : "hover:bg-neutral-200"}`}>
				{label}
			</Link>
		)
	return (
		<div className="fixed left-2 top-[4.5rem] z-50 max-w-[calc(100vw-1rem)] text-xs font-semibold text-black md:bottom-3 md:top-auto" data-demobar>
			{open ? (
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white px-2 py-1.5 shadow-2xl ring-2 ring-fuchsia-500">
					<span className="flex items-center gap-0.5">
						<span className="px-1 text-neutral-500">Wishlist</span>
						{seg("me", "Mine", !signedIn)}
						{seg("empty", "Empty")}
						{seg("few", "Few")}
						{seg("many", "Many")}
					</span>
					<span className="px-1 tabular-nums text-neutral-500">{count} titles</span>
					<button type="button" onClick={onSim} className="cursor-pointer rounded-full bg-fuchsia-100 px-2.5 py-1 hover:bg-fuchsia-200">
						Want to See from another page
					</button>
					<button type="button" onClick={onReset} className="cursor-pointer rounded-full px-2 py-1 hover:bg-neutral-200">
						Reset
					</button>
					<button type="button" onClick={() => setOpen(false)} aria-label="Hide demo controls" className="cursor-pointer rounded-full p-1 hover:bg-neutral-200">
						<XMarkIcon className="h-3.5 w-3.5" />
					</button>
				</div>
			) : (
				<button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-full bg-white px-3 py-1.5 shadow-2xl ring-2 ring-fuchsia-500">
					Demo
				</button>
			)}
		</div>
	)
}
