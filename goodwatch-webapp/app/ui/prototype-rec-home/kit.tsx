// PROTOTYPE - throwaway. Shared pieces for /prototype/rec-home (#178): the pick card (today's poster card with
// the `badge` amber taste-match coin from #179 and one-tap Want to See / Seen it / Not interested), a title
// sheet, the Watch next start hero (round 5's hero with round 7's docked strip), the doors to Taste, Discover
// and Explorer, the mobile bottom slab (filter-bar round 2's `slab` merged with the navigation), and the guest
// first-visit pieces: services, this-or-that, and a poster wall.
import { BookmarkIcon, CheckIcon, CubeIcon, FingerPrintIcon, GlobeAltIcon, HomeIcon, MapIcon, NoSymbolIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Poster } from "~/ui/Poster"
import { DragSheet, useScrollHide } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { RateDialog, ServiceTiles, ToastBar, useIsMobile } from "~/ui/prototype-rec-watch-next/kit"
import { type Offer, backdropUrl, detailsHref, ownedOffers, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { DISPLAY, WRAP } from "~/ui/prototype-rec-watch-next-3/kit3"
import { ANY } from "~/ui/prototype-rec-watch-next-4/select"
import { Hero5 } from "~/ui/prototype-rec-watch-next-5/kit5"
import { Docked7, ServicesToggle } from "~/ui/prototype-rec-watch-next-7/kit7"
import { MOOD, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { grid } from "~/ui/prototype-rec-watch-next-7/variants"
import { moodWords } from "~/ui/prototype-rec-watch-next-7/view"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import { DISCOVER_HREF, EXPLORER_HREF, type Home, TASTE_HREF, WATCH_NEXT_HREF } from "./model"
import { and } from "./taste"

export { DISPLAY, WRAP }
export const EASE = [0.2, 0.7, 0.2, 1] as const
const overlayLinks = (offers: Offer[]) => offers.map((o) => ({ provider_id: o.id, provider_name: o.name, provider_logo_path: o.logo.split("/original/")[1] })) as never

// ------------------------------------------------------------------ taste match coin

// The `badge` coin from Discover (#179): amber, fingerprint icon, the match number.
export function Coin({ t, className = "absolute right-[7px] top-[76px]" }: { t: WTitle; className?: string }) {
	if (t.match == null) return null
	return (
		<span
			title={`${t.match}% taste match`}
			className={`pointer-events-none z-10 flex h-[26px] w-[56px] items-center justify-center gap-0.5 rounded-full bg-linear-to-b from-amber-400 to-amber-600 text-[13px] font-black tabular-nums text-gray-950 shadow-[0_6px_16px_-4px_rgba(0,0,0,.8)] ring-[3px] ring-gray-900 ${className}`}
		>
			<FingerPrintIcon className="h-3.5 w-3.5 opacity-80" />
			{t.match}
		</span>
	)
}

export const whyLine = (h: Home, t: WTitle) => {
	const w = h.whyOf(t.key)
	return w.length ? `${and(w).charAt(0).toUpperCase()}${and(w).slice(1)}` : null
}

// ------------------------------------------------------------------ one-tap triage

export function Triage({ h, t, className = "", tone = "card" }: { h: Home; t: WTitle; className?: string; tone?: "card" | "hero" }) {
	const on = h.q.inQueue(t.key)
	const hero = tone === "hero"
	const want = on ? "On Wishlist" : "Want to See"
	return (
		<div className={`${hero ? "flex flex-wrap gap-2" : "@container flex gap-1"} ${className}`}>
			<button
				type="button"
				onClick={() => h.want(t.key)}
				aria-pressed={on}
				aria-label={on ? `${t.title} is on your Wishlist. Remove it` : `Want to See: ${t.title}`}
				title={want}
				className={`inline-flex cursor-pointer items-center justify-center gap-1.5 font-semibold transition-colors ${hero ? "h-12 rounded-lg px-4 text-sm" : "h-9 min-w-0 flex-1 rounded-md px-2 text-xs"} ${on ? "bg-amber-400 text-black hover:bg-amber-300" : hero ? "bg-white text-black hover:bg-gray-200" : "bg-white/10 text-white hover:bg-white/20"}`}
			>
				<BookmarkIcon className={`h-4 w-4 shrink-0 ${on ? "" : "text-amber-500"}`} />
				<span className={hero ? "" : "hidden truncate @min-[13rem]:inline"}>{want}</span>
			</button>
			<button type="button" onClick={() => h.seen(t.key)} aria-label={`Seen it: ${t.title}`} title="Seen it" className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-semibold text-white transition-colors ${hero ? "h-12 rounded-lg bg-white/10 px-4 text-sm hover:bg-white/20" : "h-9 w-9 rounded-md bg-white/10 hover:bg-white/20"}`}>
				<CheckIcon className="h-4 w-4 shrink-0 text-green-400" />
				{hero && "Seen it"}
			</button>
			<button type="button" onClick={() => h.no(t.key)} aria-label={`Not interested: ${t.title}`} title="Not interested" className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 font-semibold text-gray-300 transition-colors ${hero ? "h-12 rounded-lg px-4 text-sm hover:bg-white/10" : "h-9 w-9 rounded-md bg-white/10 hover:bg-white/20"}`}>
				<NoSymbolIcon className="h-4 w-4 shrink-0 text-gray-400" />
				{hero && "Not interested"}
			</button>
		</div>
	)
}

// ------------------------------------------------------------------ pick card

// Today's poster card (score tab, your services, title on the poster) with the coin, triage under it,
// and the fingerprint "why" line.
export function PickCard({ h, t, onOpen, why = true, triage = true, className = "" }: { h: Home; t: WTitle; onOpen: (t: WTitle) => void; why?: boolean; triage?: boolean; className?: string }) {
	const on = h.q.inQueue(t.key)
	const w = why ? whyLine(h, t) : null
	return (
		<div className={`min-w-0 ${className}`} data-pick={t.key}>
			<div className="relative">
				<a
					href={detailsHref(t)}
					onClick={(e) => {
						e.preventDefault()
						onOpen(t)
					}}
					className={`@container group flex w-full flex-col rounded-lg border-4 bg-gray-900 transition-colors hover:bg-gray-800 ${on ? "border-amber-400/70" : "border-gray-800 hover:border-amber-700/50"}`}
					draggable="false"
				>
					<div className="relative">
						<RatingOverlay ratings={{ goodwatch_overall_score_normalized_percent: t.score } as never} />
						<StreamingOverlay links={overlayLinks(ownedOffers(t))} />
						<Poster path={t.poster ?? undefined} title={t.title} />
						<div className="absolute bottom-0 hidden min-h-28 w-full items-end overflow-hidden bg-linear-to-t from-black/85 to-transparent px-2 pb-2 pt-2 @6xs:flex">
							<span className="text-sm font-bold leading-tight text-white">
								{t.title}
								{t.year ? <span className="font-normal text-gray-300"> ({t.year})</span> : null}
							</span>
						</div>
					</div>
				</a>
				<Coin t={t} />
			</div>
			{triage && <Triage h={h} t={t} className="mt-1.5" />}
			{w && <p className="mt-1 line-clamp-1 px-0.5 text-xs text-gray-400" title={w}>{w}</p>}
		</div>
	)
}

// A grid that lets removed cards fold away and the rest close the gap.
export function PickGrid({ h, titles, onOpen, className = "grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" }: { h: Home; titles: WTitle[]; onOpen: (t: WTitle) => void; className?: string }) {
	return (
		<motion.div layout className={className}>
			<AnimatePresence mode="popLayout" initial={false}>
				{titles.map((t) => (
					<motion.div key={t.key} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.16 } }} transition={{ type: "spring", stiffness: 500, damping: 40 }}>
						<PickCard h={h} t={t} onOpen={onOpen} />
					</motion.div>
				))}
			</AnimatePresence>
		</motion.div>
	)
}

// "N more on other services", the filter bar's one-tap recovery, for the picks.
export function Elsewhere({ h, className = "" }: { h: Home; className?: string }) {
	if (!h.hasServices) return null
	const on = !h.c.sel.everywhere
	return (
		<button type="button" onClick={() => h.c.setSel({ ...h.c.sel, everywhere: on })} className={`cursor-pointer text-sm font-semibold text-amber-400 hover:text-amber-300 ${className}`}>
			{on ? `+ ${h.hiddenElsewhere} on other services` : "Only my services"}
		</button>
	)
}

export function SectionHead({ title, note, right, className = "" }: { title: React.ReactNode; note?: React.ReactNode; right?: React.ReactNode; className?: string }) {
	return (
		<header className={`mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${className}`}>
			<div className="min-w-0">
				<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{title}</h2>
				{note && <p className="mt-1 text-sm text-gray-400">{note}</p>}
			</div>
			{right}
		</header>
	)
}

export const picksNote = (h: Home) =>
	h.guest && !h.hasTaste
		? h.hasServices
			? "Popular and well rated on your services. Answer a few this-or-thats and they sort to your taste."
			: "Popular and well rated. Answer a few this-or-thats and they sort to your taste."
		: `Not seen yet${h.hasServices && !h.c.sel.everywhere ? ", on your services" : ""}, best taste match first. One tap to keep, mark seen, or skip.`

// ------------------------------------------------------------------ title sheet

export function TitleSheet({ h, t, onClose }: { h: Home; t: WTitle | null; onClose: () => void }) {
	useEffect(() => {
		if (!t) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [t])
	const moods = t ? (h.data.extra[t.key]?.m ?? []) : []
	const w = t ? whyLine(h, t) : null
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
						transition={{ duration: 0.24, ease: EASE }}
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
								<div className="mt-4 flex flex-wrap items-center gap-3">
									<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: t.score } } as never} size={48} />
									<Coin t={t} className="relative" />
									{moods.slice(0, 3).map((m) => (
										<MoodChip key={m} m={m} />
									))}
								</div>
								{w && <p className="mt-3 text-sm text-gray-300">{w}.</p>}
								{t.tagline && <p className="mt-2 text-gray-200">{t.tagline}</p>}
								<div className="mt-4">
									<ServiceTiles title={t} size={40} max={4} names />
								</div>
								<Triage h={h} t={t} tone="hero" className="mt-5" />
								<Link to={detailsHref(t)} className="mt-4 inline-block text-sm font-semibold text-gray-300 underline-offset-4 hover:underline">
									Open the title page
								</Link>
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export function MoodChip({ m, on = false }: { m: MoodKey; on?: boolean }) {
	return (
		<span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-semibold ${on ? "text-black" : "bg-black/40 text-gray-200 ring-1 ring-white/15"}`} style={on ? { background: MOOD[m].hue } : undefined}>
			{!on && <span className="h-2 w-2 rounded-full" style={{ background: MOOD[m].hue }} />}
			{MOOD[m].name}
		</span>
	)
}

// ------------------------------------------------------------------ toasts

// One toast line for the page's own actions; the Wishlist store's toasts show only for scoring.
export function Toasts({ h }: { h: Home }) {
	const { toast, setToast } = h
	useEffect(() => {
		if (!toast) return
		const id = setTimeout(() => setToast(null), 4000)
		return () => clearTimeout(id)
	}, [toast])
	const qToast = h.q.toast && /^Scored|moved to Seen/.test(h.q.toast.text) ? h.q.toast : null
	return (
		<>
			<RateDialog store={h.q} />
			{!toast && <ToastBar store={{ ...h.q, toast: qToast }} bottom="bottom-44 md:bottom-6" />}
			<div className="pointer-events-none fixed inset-x-0 bottom-44 z-[1050] flex justify-center px-4 md:bottom-6" aria-live="polite">
				<AnimatePresence>
					{toast && (
						<motion.div
							key={toast.id}
							initial={{ y: 12, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: 12, opacity: 0 }}
							className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur"
						>
							<span className="min-w-0">{toast.text}</span>
							{toast.undo && (
								<button type="button" onClick={() => (toast.undo?.(), setToast(null))} className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-amber-300 hover:bg-white/20">
									Undo
								</button>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</>
	)
}

// ------------------------------------------------------------------ Watch next hero

// The settled start hero: Wishlist top under Best match and "On my services", with the Then column.
// Desktop gets round 7's docked strip (moods dropdown, services, sort); phones get the controls in the slab.
export function WatchNextHero({ h, onOpen, aside = "then" }: { h: Home; onOpen: (t: WTitle) => void; aside?: "then" | "poster" }) {
	const mobile = useIsMobile()
	const first = h.watchNext[0]
	const heroCtx = { q: h.q, v: h.v, sel: ANY, setSel: () => {}, m: null, setM: () => {}, n: h.c.n, reset: h.c.reset }
	return (
		<Hero5
			c={heroCtx}
			onPeek={onOpen}
			onPass={h.pass}
			top={mobile ? undefined : <Docked7 c={h.c} look={grid} />}
			eyebrow={first ? <HeroEyebrow h={h} t={first} /> : undefined}
			aside={aside}
			offer={first ? undefined : h.picks[0]}
		/>
	)
}

export function HeroEyebrow({ h, t }: { h: Home; t: WTitle }) {
	const { sel, v } = h.c
	const fits = !v.need || v.fit.get(t.key) === v.need
	const moods = h.data.extra[t.key]?.m ?? []
	const label = !fits ? (sel.moods.length ? "Closest to your moods" : "Nothing on your services; closest") : sel.moods.length ? `Watch next for ${moodWords(sel.moods)}` : "Watch next"
	return (
		<motion.div key={t.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold">
			<span className="text-amber-300">{label}</span>
			<span className="text-gray-300">Best match on your Wishlist</span>
			{moods.slice(0, 3).map((m) => (
				<MoodChip key={m} m={m} on={sel.moods.includes(m)} />
			))}
		</motion.div>
	)
}

// ------------------------------------------------------------------ doors

export function Doors({ h, className = "", compact = false }: { h: Home; className?: string; compact?: boolean }) {
	const posters = (keys: string[]) => keys.map(h.T).filter((t): t is WTitle => !!t?.poster)
	const tasteArt = posters(h.guest ? h.loved : Object.entries(h.data.ratings).filter(([, s]) => s >= 9).map(([k]) => k)).slice(0, 3)
	const tasteLine = h.leans.length ? `You go for ${and(h.leans)}.` : "Answer a few this-or-thats and see your taste take shape."
	const doors = [
		{ href: TASTE_HREF, title: "Taste", Icon: FingerPrintIcon, line: tasteLine, art: tasteArt.length ? tasteArt : h.picks.slice(6, 9) },
		{ href: DISCOVER_HREF, title: "Discover", Icon: CubeIcon, line: "Browse and search everything, sorted for you, with the same filters.", art: h.picks.slice(12, 15) },
		{ href: EXPLORER_HREF, title: "Explorer", Icon: MapIcon, line: "Wander a map of titles grouped by how they feel.", art: h.picks.slice(18, 21) },
	]
	return (
		<nav aria-label="More ways to find something" className={`grid gap-3 md:grid-cols-3 ${className}`}>
			{doors.map((d) => (
				<Link key={d.title} to={d.href} className={`group relative isolate flex cursor-pointer items-end overflow-hidden rounded-2xl bg-gray-950 p-5 ring-1 ring-white/10 transition-shadow hover:ring-amber-500/50 ${compact ? "min-h-32" : "min-h-44"}`}>
					<span className="absolute -right-4 top-3 -z-10 flex -space-x-8 opacity-70 transition-transform duration-500 group-hover:-translate-x-2">
						{d.art.map((t, i) => (
							<img key={t.key} src={posterUrl(t, "w185")} alt="" className="h-36 w-24 rounded-lg object-cover shadow-xl shadow-black ring-1 ring-white/10" style={{ transform: `rotate(${(i - 1) * 6}deg) translateY(${Math.abs(i - 1) * 8}px)` }} />
						))}
					</span>
					<span className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/85 to-gray-950/20" />
					<span className="max-w-[16rem]">
						<span className="flex items-center gap-2">
							<d.Icon className="h-5 w-5 text-amber-400" />
							<span className={`${DISPLAY} text-2xl text-white`}>{d.title}</span>
						</span>
						<span className="mt-1 block text-sm leading-snug text-gray-300">{d.line}</span>
					</span>
				</Link>
			))}
		</nav>
	)
}

// ------------------------------------------------------------------ mobile slab

// The bottom slab: an optional context row over the navigation, which folds away while scrolling down.
export function Slab({ h, children }: { h: Home; children?: React.ReactNode }) {
	const { hidden } = useScrollHide()
	const nav = [
		{ title: "Home", Icon: HomeIcon, to: "#", on: true },
		{ title: "Discover", Icon: CubeIcon, to: DISCOVER_HREF },
		null,
		{ title: "Wishlist", Icon: BookmarkIcon, to: WATCH_NEXT_HREF, badge: h.q.count > 99 ? "99+" : h.q.count || null },
		{ title: "Explorer", Icon: MapIcon, to: EXPLORER_HREF },
	]
	return (
		<div className="fixed inset-x-0 bottom-0 z-[60] md:hidden" data-slab>
			<div className="rounded-t-[26px] bg-gray-950/92 shadow-[0_-20px_50px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.07)] ring-1 ring-white/10 backdrop-blur-2xl">
				{children && <div className="flex items-center gap-2 px-3 pb-2 pt-2.5">{children}</div>}
				<AnimatePresence initial={false}>
					{!hidden && (
						<motion.nav initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ type: "spring", stiffness: 520, damping: 40 }} className={`grid grid-cols-5 overflow-hidden ${children ? "border-t border-white/5" : ""}`}>
							{nav.map((n) =>
								n ? (
									<Link key={n.title} to={n.to} className={`relative flex h-16 flex-col items-center justify-center pb-1 ${n.on ? "text-amber-400" : "text-gray-400"}`}>
										<n.Icon className="mb-1 h-5 w-5" />
										<span className="text-xs text-gray-200">{n.title}</span>
										{n.badge ? <span className="absolute right-3 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-gray-950">{n.badge}</span> : null}
									</Link>
								) : (
									<Link key="taste" to={TASTE_HREF} className="flex h-16 items-center justify-center" aria-label="Taste">
										<span className="grid h-11 w-11 place-items-center rounded-full bg-linear-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40">
											<FingerPrintIcon className="h-6 w-6 text-white" />
										</span>
									</Link>
								),
							)}
						</motion.nav>
					)}
				</AnimatePresence>
			</div>
		</div>
	)
}

// The Watch next controls for phones: "On my services" and moods, which open round 7's grid in a drawer.
export function SlabWatchNext({ h }: { h: Home }) {
	const [sheet, setSheet] = useState(-1)
	const picked = h.c.sel.moods
	return (
		<>
			<button type="button" onClick={() => setSheet(0)} data-slab-moods className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full bg-white/10 pl-2 pr-3 text-sm font-semibold text-white ring-1 ring-white/10">
				<span className="flex -space-x-1.5">
					{(picked.length ? picked : (["funny", "crime", "worlds"] as MoodKey[])).map((m) => (
						<span key={m} className="h-5 w-5 rounded-full ring-2 ring-gray-950" style={{ background: MOOD[m].hue }} />
					))}
				</span>
				<span className="truncate">{picked.length ? moodWords(picked) : "Any mood"}</span>
			</button>
			{h.hasServices && <ServicesToggle c={h.c} compact />}
			<DragSheet index={sheet} onIndex={setSheet} snaps={[0.62, 0.94]} backdropFrom={0} label="Moods">
				<grid.Panel c={h.c} pinned={false} />
				<div className="px-3 pb-6">
					<button type="button" onClick={() => setSheet(-1)} className="h-12 w-full cursor-pointer rounded-xl bg-white font-bold text-black">
						Show {h.c.n} from your Wishlist
					</button>
				</div>
			</DragSheet>
		</>
	)
}

// The guest's slab row: services they chose, or a nudge to choose them; either opens the services sheet.
export function SlabGuest({ h }: { h: Home; onServices?: () => void }) {
	const [sheet, setSheet] = useState(-1)
	return (
		<>
			<button type="button" onClick={() => setSheet(0)} data-slab-services className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full bg-white/10 pl-2 pr-3 text-sm font-semibold text-white ring-1 ring-white/10">
				{h.hasServices ? (
					<span className="flex -space-x-1.5">
						{h.services.slice(0, 4).map((s) => (
							<img key={s.name} src={s.logo} alt="" className="h-6 w-6 rounded-full ring-2 ring-gray-950" />
						))}
					</span>
				) : (
					<GlobeAltIcon className="h-5 w-5 text-gray-300" />
				)}
				<span className="truncate">{h.hasServices ? "On my services" : "Choose your services"}</span>
			</button>
			<DragSheet index={sheet} onIndex={setSheet} snaps={[0.5, 0.9]} backdropFrom={0} label="Your services">
				<div className="px-4 pb-6">
					<h2 className={`${DISPLAY} text-2xl text-white`}>Where do you watch?</h2>
					<p className="mt-1 text-sm text-gray-400">Picks stay on these, with a one-tap way out.</p>
					<ServicePick h={h} className="mt-4" />
					<button type="button" onClick={() => setSheet(-1)} className="mt-6 h-12 w-full cursor-pointer rounded-xl bg-white font-bold text-black">
						Done
					</button>
				</div>
			</DragSheet>
		</>
	)
}

// ------------------------------------------------------------------ guest: services

export function ServicePick({ h, size = "md", className = "" }: { h: Home; size?: "md" | "lg"; className?: string }) {
	return (
		<div className={`flex flex-wrap gap-2 ${className}`} role="group" aria-label="Your streaming services">
			{h.data.catalog.map((s) => {
				const on = h.mine.includes(s.name)
				return (
					<button
						key={s.name}
						type="button"
						aria-pressed={on}
						onClick={() => h.toggleService(s.name)}
						data-service={s.name}
						className={`relative flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 bg-white/10 pr-3 transition-colors hover:bg-white/15 ${size === "lg" ? "h-14" : "h-11"} ${on ? "border-green-500" : "border-white/15"}`}
					>
						<img src={s.logo} alt="" className="aspect-square h-full rounded-[10px]" />
						<span className={`truncate font-semibold text-white ${size === "lg" ? "text-base" : "text-sm"}`}>{s.name}</span>
						{on && (
							<span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-gray-950">
								<CheckIcon className="h-3.5 w-3.5" />
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

// ------------------------------------------------------------------ guest: this or that

// Pairs are answered in order; `i` is the next unanswered one.
export const nextPair = (h: Home) => {
	const done = new Set(h.answers.map((a) => a.pair))
	return h.data.pairs.findIndex((_, i) => !done.has(i))
}

export function Steps({ n, at, className = "" }: { n: number; at: number; className?: string }) {
	return (
		<span className={`flex items-center gap-1.5 ${className}`} aria-label={`${Math.min(at, n)} of ${n} answered`}>
			{Array.from({ length: n }, (_, i) => (
				<span key={i} className={`h-1.5 rounded-full transition-all ${i < at ? "w-5 bg-amber-400" : "w-1.5 bg-white/25"}`} />
			))}
		</span>
	)
}

// Two posters from opposite ends of one taste axis. Tap one; "Skip" moves on.
export function Duel({ h, className = "", size = "md" }: { h: Home; className?: string; size?: "md" | "lg" }) {
	const i = nextPair(h)
	const p = h.data.pairs[i]
	const [flash, setFlash] = useState<"a" | "b" | null>(null)
	if (!p) return null
	const pick = (side: "a" | "b" | "skip") => {
		if (side === "skip") return h.pickSide(i, "skip")
		setFlash(side)
		setTimeout(() => (setFlash(null), h.pickSide(i, side)), 260)
	}
	const side = (k: string, s: "a" | "b", label: string) => {
		const t = h.T(k)
		if (!t) return null
		return (
			<motion.button
				type="button"
				key={k}
				data-duel={s}
				onClick={() => pick(s)}
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: flash && flash !== s ? 0.35 : 1, y: 0, scale: flash === s ? 1.03 : 1 }}
				transition={{ duration: 0.25, ease: EASE }}
				className="group flex min-w-0 flex-1 cursor-pointer flex-col text-left"
			>
				<span className={`mb-2 block font-bold text-white ${size === "lg" ? "text-lg md:text-xl" : "text-base"}`}>{label}</span>
				<span className={`relative block overflow-hidden rounded-xl ring-2 transition-shadow ${flash === s ? "ring-amber-400" : "ring-white/10 group-hover:ring-white/40"}`}>
					<img src={posterUrl(t, "w500")} alt="" className="aspect-[2/3] w-full object-cover" />
				</span>
				<span className="mt-2 block truncate text-sm text-gray-300">
					{t.title} <span className="text-gray-500">({t.year})</span>
				</span>
			</motion.button>
		)
	}
	return (
		<div className={className} data-duel-round={i}>
			<div className="mb-3 flex items-center justify-between gap-3">
				<Steps n={h.data.pairs.length} at={h.answers.length} />
				<button type="button" onClick={() => pick("skip")} className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-white">
					Skip
				</button>
			</div>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={i} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22, ease: EASE }} className="flex gap-3 md:gap-4">
					{side(p.a, "a", p.left)}
					<span className={`${DISPLAY} self-center text-lg text-gray-500`}>or</span>
					{side(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

// ------------------------------------------------------------------ guest: poster wall

export function FavWall({ h, className = "grid grid-cols-3 gap-2 sm:grid-cols-6 md:gap-3", limit = 18 }: { h: Home; className?: string; limit?: number }) {
	return (
		<div className={className}>
			{h.data.favorites.slice(0, limit).map((k) => {
				const t = h.T(k)
				if (!t) return null
				const on = h.loved.includes(k)
				return (
					<motion.button
						key={k}
						type="button"
						data-fav={k}
						whileTap={{ scale: 0.96 }}
						onClick={() => h.love(k)}
						aria-pressed={on}
						aria-label={`${on ? "Loved" : "Love"}: ${t.title}`}
						className={`relative cursor-pointer overflow-hidden rounded-lg ring-2 transition-shadow ${on ? "ring-amber-400 shadow-[0_10px_30px_-10px_rgba(251,191,36,.7)]" : "ring-white/5 hover:ring-white/30"}`}
					>
						<img src={posterUrl(t, "w342")} alt="" className={`aspect-[2/3] w-full object-cover transition-opacity ${h.loved.length >= 3 && !on ? "opacity-60" : ""}`} />
						{on && (
							<span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-amber-400 text-black ring-2 ring-gray-950">
								<CheckIcon className="h-4 w-4" />
							</span>
						)}
					</motion.button>
				)
			})}
		</div>
	)
}

// ------------------------------------------------------------------ guest: what members get

export function MemberTeaser({ h, className = "" }: { h: Home; className?: string }) {
	const stack = (h.q.count ? h.q.titles : h.picks).slice(0, 3)
	return (
		<section className={`relative isolate overflow-hidden rounded-2xl bg-gray-950 p-5 ring-1 ring-white/10 md:p-8 ${className}`} aria-label="What members get">
			{stack[0] && <img src={backdropUrl(stack[0], "w1280")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-25" />}
			<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/90 to-gray-950/40" />
			<div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
				<div className="max-w-xl">
					<h2 className={`${DISPLAY} text-3xl leading-none text-white md:text-4xl`}>{h.q.count ? `Keep your ${h.q.count === 1 ? "pick" : `${h.q.count} picks`} for tonight` : "Your own start page"}</h2>
					<p className="mt-3 text-gray-300">
						With a free account, GoodWatch opens on the best match from your Wishlist that you can play tonight, keeps what you've seen out of the way, and learns from every score.
					</p>
					<div className="mt-5 flex flex-wrap gap-2">
						<button type="button" onClick={() => h.setToast({ id: Date.now(), text: "Prototype: sign-up isn't wired up here." })} className="inline-flex h-11 cursor-pointer items-center rounded-lg bg-white px-5 font-bold text-black hover:bg-gray-200">
							Create a free account
						</button>
						<button type="button" onClick={() => h.setToast({ id: Date.now(), text: "Prototype: sign-in isn't wired up here." })} className="inline-flex h-11 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-200 hover:bg-white/10">
							Sign in
						</button>
					</div>
				</div>
				<div className="hidden items-end -space-x-10 md:flex">
					{stack.map((t, i) => (
						<img key={t.key} src={posterUrl(t, "w342")} alt="" className="w-32 rounded-xl shadow-2xl shadow-black ring-1 ring-white/10" style={{ transform: `rotate(${(i - 1) * 5}deg) translateY(${i === 1 ? -10 : 0}px)`, zIndex: i === 1 ? 2 : 1 }} />
					))}
				</div>
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ taste in one line

export function TasteLine({ h, className = "" }: { h: Home; className?: string }) {
	if (!h.leans.length && !h.moods.length) return null
	return (
		<p className={`flex flex-wrap items-center gap-2 text-sm text-gray-300 ${className}`}>
			<SparklesIcon className="h-4 w-4 text-amber-400" />
			{h.leans.length > 0 && <span>You go for {and(h.leans)}.</span>}
			{h.moods.map((m) => (
				<MoodChip key={m} m={m} />
			))}
		</p>
	)
}

// ------------------------------------------------------------------ prototype chrome: audience switch

const AUDIENCES = [
	{ key: "guest", label: "Guest" },
	{ key: "new", label: "New member" },
	{ key: "me", label: "Me" },
] as const

export function AudienceBar({ h }: { h: Home }) {
	const [params, setParams] = useSearchParams()
	const as = params.get("as") ?? ""
	const uuid = /^[0-9a-f-]{36}$/.test(as) ? as : null
	const [lastUuid, setLastUuid] = useState(uuid)
	useEffect(() => {
		if (uuid) setLastUuid(uuid)
	}, [uuid])
	const go = (k: string) => {
		const p = new URLSearchParams(params)
		p.set("as", k === "me" && lastUuid ? lastUuid : k)
		setParams(p, { preventScrollReset: true })
	}
	return (
		<div className="fixed bottom-[10.5rem] left-2 z-50 flex origin-bottom-left scale-90 items-center gap-1 rounded-full bg-white p-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 md:bottom-6 md:left-4 md:scale-100" data-audience>
			{AUDIENCES.map((a) => (
				<button key={a.key} type="button" onClick={() => go(a.key)} className={`cursor-pointer rounded-full px-2.5 py-1 ${h.data.audience === a.key ? "bg-black text-white" : "hover:bg-neutral-200"}`}>
					{a.label}
				</button>
			))}
			<span className="hidden px-2 text-neutral-500 lg:inline">{h.data.who.label}</span>
		</div>
	)
}

// Round 7's strip still speaks of a saved manual order; #176's resolution dropped manual ordering, so on this
// page its "Sorted by ... Your order is unchanged" note and the "My order" entry are hidden.
export const PATCH_CSS = `[data-viewnote]{display:none!important}[role=menu][aria-label=Order]>div:first-child{display:none}[role=menu][aria-label=Order]>div:nth-child(2)>p{display:none}`
