// PROTOTYPE - throwaway. Shared pieces for round 2 of Watch next (#176): the three-stage flow bar
// (Suggested, Wishlist, Watch next), a poster card whose one button always moves a title one stage on,
// horizontal rails, compact list rows, and the demo controls for the top and the Wishlist state.
import { BookmarkIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, QueueListIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useRef, useState } from "react"
import { Poster } from "~/ui/Poster"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import UserDataOverlay from "~/ui/user/UserDataOverlay"
import { type Offer, type Title, backdropUrl, ownedOffers, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type Store2, type WTitle, ageLabel, runtimeLabel } from "./model"

export const DISPLAY = "font-['Gabarito'] font-black tracking-[-0.03em]"

export type Stage = "suggested" | "wishlist" | "next"
export const stageOf = (store: Store2, k: string): Stage => (store.has(k) ? "next" : store.onWishlist(k) ? "wishlist" : "suggested")

// ------------------------------------------------------------------ flow bar

// The pipeline every variant shares, with live counts. A count bumps when a title arrives.
export function FlowBar({ store, suggested, className = "" }: { store: Store2; suggested?: number; className?: string }) {
	const steps: { key: Stage; label: string; n: number | null; Icon: typeof BookmarkIcon; tone: string }[] = [
		{ key: "suggested", label: "Suggested", n: suggested ?? null, Icon: PlusGlyph as never, tone: "text-gray-300" },
		{ key: "wishlist", label: "Wishlist", n: store.state.wishlist.length, Icon: BookmarkIcon, tone: "text-amber-300" },
		{ key: "next", label: "Watch next", n: store.queue.length, Icon: QueueListIcon, tone: "text-amber-400" },
	]
	return (
		<ol className={`flex items-center gap-1.5 text-sm sm:gap-3 ${className}`} aria-label="How a title moves">
			{steps.map((s, i) => (
				<li key={s.key} className="flex min-w-0 items-center gap-1.5 sm:gap-3">
					{i > 0 && <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />}
					<span className="flex min-w-0 items-center gap-1.5">
						<s.Icon className={`h-4 w-4 shrink-0 ${s.tone}`} />
						<span className="truncate text-gray-300">{s.label}</span>
						{s.n != null && (
							<motion.span key={s.n} initial={{ scale: 1.5, color: "#fbbf24" }} animate={{ scale: 1, color: "#fff" }} className="font-bold tabular-nums">
								{s.n}
							</motion.span>
						)}
					</span>
				</li>
			))}
		</ol>
	)
}
function PlusGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 20 20" className={className} aria-hidden="true">
			<path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
		</svg>
	)
}

// ------------------------------------------------------------------ stage button

// One button, one step forward: Want to See, then Watch next, then (tap again) back to Wishlist.
export function StageButton({ store, t, size = "md", className = "" }: { store: Store2; t: Title; size?: "sm" | "md"; className?: string }) {
	const stage = stageOf(store, t.key)
	const pos = store.queue.indexOf(t.key) + 1
	const h = size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-xs"
	const base = `inline-flex items-center gap-1.5 rounded-full font-bold shadow-lg shadow-black/50 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white ${h} ${className}`
	if (stage === "suggested")
		return (
			<button type="button" onClick={() => store.want(t.key)} className={`${base} bg-white/95 text-black hover:bg-white`} aria-label={`Want to See: ${t.title}`}>
				<BookmarkIcon className="h-4 w-4 text-amber-600" />
				Want to See
			</button>
		)
	if (stage === "wishlist")
		return (
			<button type="button" onClick={() => store.add(t.key)} className={`${base} bg-gray-950/85 text-white ring-1 ring-amber-400/60 backdrop-blur hover:bg-amber-400 hover:text-black`} aria-label={`Move ${t.title} up to Watch next`}>
				<QueueListIcon className="h-4 w-4 text-amber-400" />
				Watch next
			</button>
		)
	return (
		<button type="button" onClick={() => store.remove(t.key)} className={`${base} bg-amber-300 text-black`} aria-label={`${t.title} is Watch next #${pos}. Send back to Wishlist`} title="Tap to send it back to your Wishlist">
			<CheckIcon className="h-4 w-4" />
			Next #{pos}
		</button>
	)
}

// ------------------------------------------------------------------ poster card

const overlayLinks = (offers: Offer[]) => offers.map((o) => ({ provider_id: o.id, provider_name: o.name, provider_logo_path: o.logo.split("/original/")[1] })) as never

// The production MovieTvCard look with the stage button pinned to the bottom and a meta line under the poster.
export function PipelineCard({ t, store, onOpen, meta, dim = false }: { t: WTitle; store: Store2; onOpen?: (t: Title) => void; meta?: React.ReactNode; dim?: boolean }) {
	const stage = stageOf(store, t.key)
	const rating = store.state.ratings[t.key]
	return (
		<div className={`relative transition-opacity ${dim ? "opacity-35 hover:opacity-100" : ""}`}>
			<a
				href={`#${t.key}`}
				onClick={(e) => {
					e.preventDefault()
					onOpen?.(t)
				}}
				className={`@container group flex w-full flex-col rounded-lg border-4 bg-gray-900 transition-transform duration-100 hover:bg-gray-800 ${
					stage === "next" ? "border-amber-400/80" : stage === "wishlist" ? "border-gray-700 hover:border-amber-700/50" : "border-gray-800 border-dashed hover:border-amber-700/50"
				}`}
				draggable="false"
			>
				<div className="relative">
					<UserDataOverlay score={(rating ?? null) as never} onWishList={stage === "wishlist"} />
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
				<StageButton store={store} t={t} size="sm" />
			</div>
			{meta !== undefined && <div className="mt-1 truncate px-1 text-xs text-gray-400">{meta}</div>}
		</div>
	)
}

export const MatchText = ({ t }: { t: WTitle }) => (t.match ? <span className={t.match >= 85 ? "text-amber-300" : ""}>{t.match}% match</span> : null)

// A meta line that says why the title sits where it does.
export function Why({ t, store, kind }: { t: WTitle; store: Store2; kind: "match" | "added" | "runtime" | "leaving" | "service" | "new" }) {
	if (kind === "added") return <>Added {ageLabel(store.addedAt(t.key) ?? store.now, store.now)}</>
	if (kind === "runtime") return <>{runtimeLabel(t)}</>
	if (kind === "leaving") return <span className="text-rose-300">Leaves in {t.leavingInDays} days</span>
	if (kind === "service") return <>{ownedOffers(t)[0]?.name ?? t.offers[0]?.name ?? "Not streaming"}</>
	if (kind === "new") return <>New on {ownedOffers(t)[0]?.name ?? "your services"}</>
	return <MatchText t={t} />
}

// ------------------------------------------------------------------ rails

export function Rail({ title, note, children, action, className = "" }: { title: React.ReactNode; note?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
	const ref = useRef<HTMLDivElement>(null)
	const scroll = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: "smooth" })
	return (
		<section className={`min-w-0 ${className}`}>
			<div className="mb-2 flex items-end justify-between gap-3">
				<div className="min-w-0">
					<h2 className="text-lg font-bold text-white md:text-xl">{title}</h2>
					{note && <p className="text-sm text-gray-400">{note}</p>}
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{action}
					<button type="button" onClick={() => scroll(-1)} aria-label="Scroll left" className="hidden rounded-full bg-white/5 p-1.5 text-gray-300 hover:bg-white/15 md:block cursor-pointer">
						<ChevronLeftIcon className="h-4 w-4" />
					</button>
					<button type="button" onClick={() => scroll(1)} aria-label="Scroll right" className="hidden rounded-full bg-white/5 p-1.5 text-gray-300 hover:bg-white/15 md:block cursor-pointer">
						<ChevronRightIcon className="h-4 w-4" />
					</button>
				</div>
			</div>
			<div ref={ref} className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
				{children}
			</div>
		</section>
	)
}
export const RailItem = ({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) => (
	<div className={`shrink-0 snap-start ${wide ? "w-[11.5rem] md:w-[13rem]" : "w-[8.5rem] md:w-[10.5rem]"}`}>{children}</div>
)

// ------------------------------------------------------------------ compact row

export function TitleRow({ t, store, onOpen, meta, actions, className = "" }: { t: WTitle; store: Store2; onOpen?: (t: Title) => void; meta?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
	const mine = ownedOffers(t)[0]
	return (
		<div className={`flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-2 ${className}`}>
			<button type="button" onClick={() => onOpen?.(t)} className="relative shrink-0 cursor-pointer">
				<img src={posterUrl(t, "w154")} alt="" loading="lazy" className="h-[4.5rem] w-12 rounded-md object-cover" />
				{mine && <img src={mine.logo} alt={mine.name} className="absolute -bottom-1 -right-1 h-5 w-5 rounded border border-green-500" />}
			</button>
			<div className="min-w-0 flex-1">
				<button type="button" onClick={() => onOpen?.(t)} className="block max-w-full truncate text-left text-sm font-bold text-white hover:underline cursor-pointer">
					{t.title} <span className="font-normal text-gray-500">{t.year}</span>
				</button>
				<p className="truncate text-xs text-gray-400">{meta ?? <MatchText t={t} />}</p>
			</div>
			<div className="flex shrink-0 items-center gap-1">{actions ?? <StageButton store={store} t={t} size="sm" />}</div>
		</div>
	)
}

// A backdrop strip: the still carries the row, the poster anchors it, actions sit on the right.
export function CineRow({ t, onOpen, meta, actions, accent = false }: { t: WTitle; onOpen?: (t: Title) => void; meta?: React.ReactNode; actions?: React.ReactNode; accent?: boolean }) {
	const mine = ownedOffers(t)[0]
	return (
		<div className={`relative isolate flex h-[5.5rem] items-center gap-3 overflow-hidden rounded-lg pr-2 ${accent ? "ring-1 ring-amber-400/60" : "ring-1 ring-white/5"}`}>
			<img src={backdropUrl(t, "w780")} alt="" loading="lazy" className="absolute inset-y-0 right-0 -z-20 h-full w-3/4 object-cover object-[center_25%]" />
			<div className="absolute inset-0 -z-10 bg-gradient-to-r from-gray-900 from-35% via-gray-900/85 to-gray-900/30" />
			<button type="button" onClick={() => onOpen?.(t)} className="relative h-full shrink-0 cursor-pointer">
				<img src={posterUrl(t, "w154")} alt="" loading="lazy" className="h-full w-[3.7rem] object-cover" />
				{mine && <img src={mine.logo} alt={mine.name} className="absolute bottom-1 right-1 h-5 w-5 rounded border border-green-500" />}
			</button>
			<div className="min-w-0 flex-1">
				<button type="button" onClick={() => onOpen?.(t)} className="block max-w-full truncate text-left text-[15px] font-bold text-white [text-shadow:0_1px_6px_#000] hover:underline cursor-pointer">
					{t.title}
				</button>
				<p className="truncate text-xs text-gray-300 [text-shadow:0_1px_4px_#000]">{meta ?? <MatchText t={t} />}</p>
			</div>
			<div className="flex shrink-0 items-center gap-1">{actions}</div>
		</div>
	)
}

export function IconBtn({ onClick, label, children, tone = "plain" }: { onClick: () => void; label: string; children: React.ReactNode; tone?: "plain" | "amber" | "rose" | "green" }) {
	const c = { plain: "bg-black/60 text-gray-100 backdrop-blur hover:bg-black/85", amber: "bg-amber-400 text-black hover:bg-amber-300", rose: "bg-black/60 text-rose-300 hover:bg-rose-950", green: "bg-green-500 text-black hover:bg-green-400" }[tone]
	return (
		<button type="button" onClick={onClick} aria-label={label} title={label} className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold cursor-pointer ${c}`}>
			{children}
		</button>
	)
}
export { XMarkIcon }

// ------------------------------------------------------------------ demo controls

// Prototype chrome, visually apart from the design: which top, and which Wishlist state.
export function DemoBar({ signedIn, mode, top, count }: { signedIn: boolean; mode: string; top: string; count: number }) {
	const [params] = useSearchParams()
	const [open, setOpen] = useState(true)
	const href = (k: string, v: string) => {
		const p = new URLSearchParams(params)
		p.set(k, v)
		return `?${p.toString()}`
	}
	const seg = (k: string, v: string, label: string, on: boolean, disabled = false) =>
		disabled ? (
			<span key={v} className="rounded-full px-2.5 py-1 text-neutral-400" title="Sign in to see your own Wishlist">
				{label}
			</span>
		) : (
			<Link key={v} to={href(k, v)} replace preventScrollReset className={`rounded-full px-2.5 py-1 ${on ? "bg-black text-white" : "hover:bg-neutral-200"}`}>
				{label}
			</Link>
		)
	return (
		<div className="fixed bottom-20 left-2 z-50 md:bottom-3 max-w-[calc(100vw-1rem)] text-xs font-semibold text-black">
			<AnimatePresence initial={false}>
				{open ? (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white px-2 py-1.5 shadow-2xl ring-2 ring-fuchsia-500">
						<span className="flex items-center gap-0.5">
							<span className="px-1 text-neutral-500">Top</span>
							{seg("top", "hero", "Start hero", top === "hero")}
							{seg("top", "tonight", "Tonight", top === "tonight")}
						</span>
						<span className="flex items-center gap-0.5">
							<span className="px-1 text-neutral-500">Wishlist</span>
							{seg("wishlist", "me", "Mine", mode === "me", !signedIn)}
							{seg("wishlist", "empty", "Empty", mode === "empty")}
							{seg("wishlist", "few", "Few", mode === "few")}
							{seg("wishlist", "many", "Many", mode === "many")}
						</span>
						<span className="px-1 text-neutral-500 tabular-nums">{count} titles</span>
						<button type="button" onClick={() => setOpen(false)} aria-label="Hide demo controls" className="rounded-full p-1 hover:bg-neutral-200 cursor-pointer">
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</motion.div>
				) : (
					<button type="button" onClick={() => setOpen(true)} className="rounded-full bg-white px-3 py-1.5 shadow-2xl ring-2 ring-fuchsia-500 cursor-pointer">
						Demo
					</button>
				)}
			</AnimatePresence>
		</div>
	)
}
