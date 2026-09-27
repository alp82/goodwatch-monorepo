// PROTOTYPE - throwaway. Shared pieces for round 3 of Watch next (#176): the one Want to See button every
// poster carries (it shows the queue position once on), the poster card, the single suggestion shelf that
// appears while the queue is short, the "placed at #7" moment, a title peek, the empty hero, and demo controls.
import { BookmarkIcon, CheckIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type React from "react"
import { useEffect, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Poster } from "~/ui/Poster"
import { ServiceTiles, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { type Offer, type Title, backdropUrl, ownedOffers, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { DISPLAY } from "~/ui/prototype-rec-watch-next-2/kit2"
import { type WTitle, ageLabel, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import UserDataOverlay from "~/ui/user/UserDataOverlay"
import type { AddHow, Queue } from "./model"

export { DISPLAY }
export const WRAP = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
// The queue is short enough to need suggestions.
export const SHORT = 12

// ------------------------------------------------------------------ Want to See

// The one button. Off: "Want to See". On: the title's place in the queue; tapping it again removes it.
export function WantButton({ q, t, how = "bottom", size = "md", className = "", onAdd }: { q: Queue; t: WTitle; how?: AddHow; size?: "sm" | "md" | "lg"; className?: string; onAdd?: (t: WTitle) => void }) {
	const at = q.pos(t.key)
	const h = size === "lg" ? "h-12 px-5 text-base" : size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
	const base = `inline-flex items-center gap-1.5 rounded-full font-bold shadow-lg shadow-black/50 cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white ${h} ${className}`
	if (!at)
		return (
			<button type="button" onClick={() => (onAdd ? onAdd(t) : q.addQ(t.key, how))} className={`${base} bg-white/95 text-black hover:bg-white`} aria-label={`Want to See: ${t.title}`}>
				<BookmarkIcon className="h-4 w-4 text-amber-600" />
				Want to See
			</button>
		)
	return (
		<button
			type="button"
			onClick={() => q.remove(t.key)}
			className={`${base} bg-amber-400 text-black hover:bg-amber-300`}
			aria-label={`${t.title} is #${at} on your Wishlist. Remove it`}
			title="On your Wishlist. Tap to remove."
		>
			<BookmarkIcon className="h-4 w-4" />
			<span className="tabular-nums">#{at}</span>
		</button>
	)
}

// ------------------------------------------------------------------ poster card

const overlayLinks = (offers: Offer[]) => offers.map((o) => ({ provider_id: o.id, provider_name: o.name, provider_logo_path: o.logo.split("/original/")[1] })) as never

// The production MovieTvCard look with the Want to See button pinned to the bottom right.
export function QPoster({ t, q, onOpen, how, meta, onAdd }: { t: WTitle; q: Queue; onOpen?: (t: WTitle) => void; how?: AddHow; meta?: React.ReactNode; onAdd?: (t: WTitle) => void }) {
	const on = q.inQueue(t.key)
	return (
		<div className="relative">
			<a
				href={`#${t.key}`}
				onClick={(e) => {
					e.preventDefault()
					onOpen?.(t)
				}}
				className={`@container group flex w-full flex-col rounded-lg border-4 bg-gray-900 transition-colors hover:bg-gray-800 ${on ? "border-amber-400/70" : "border-gray-800 hover:border-amber-700/50"}`}
				draggable="false"
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
				<WantButton q={q} t={t} how={how} size="sm" onAdd={onAdd} />
			</div>
			{meta !== undefined && <div className="mt-1 truncate px-1 text-xs text-gray-400">{meta}</div>}
		</div>
	)
}

export const Match = ({ t }: { t: WTitle }) => (t.match ? <span className={t.match >= 85 ? "text-amber-300" : ""}>{t.match}% match</span> : null)

// ------------------------------------------------------------------ rank numeral

// The one bold device across every variant: the queue position, set big.
export function Rank({ n, className = "" }: { n: number; className?: string }) {
	return <span className={`${DISPLAY} tabular-nums leading-none ${className}`}>{n}</span>
}

// ------------------------------------------------------------------ suggestion shelf

// The one place suggestions appear, and only while the queue is short. Titles like the top of your
// queue come first, then your best matches on your services.
export function SuggestShelf({ q, onOpen, how = "bottom", onAdd, className = "" }: { q: Queue; onOpen?: (t: WTitle) => void; how?: AddHow; onAdd?: (t: WTitle) => void; className?: string }) {
	// Freeze the list for this visit so an add doesn't reshuffle the row under the pointer.
	const [keys] = useState(() => {
		const b = q.suggest.because(10)
		// With an empty queue the hero already offers the best match; don't repeat it here.
		const skip = q.count === 0 ? q.suggest.forYou(1)[0]?.key : undefined
		const mix = [...(b?.titles ?? []), ...q.suggest.forYou(24)].filter((t) => t.key !== skip)
		return { seed: b?.seed.title ?? null, keys: mix.filter((t, i) => mix.findIndex((x) => x.key === t.key) === i).slice(0, 18).map((t) => t.key) }
	})
	if (q.count >= SHORT) return null
	const titles = keys.keys.map(q.T).filter((t): t is WTitle => !!t && !q.isSeen(t.key))
	const left = SHORT - q.count
	return (
		<section className={className} aria-label="Suggestions to add">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-lg font-bold text-white md:text-xl">{q.count === 0 ? "Start your queue" : "Worth adding"}</h2>
					<p className="text-sm text-gray-400">
						{keys.seed ? `Like ${keys.seed} and your best matches. ` : "Your best matches on your services. "}
						{q.count === 0 ? "The first one you pick becomes Watch next." : `This row goes away once you have ${SHORT} titles; ${left} to go.`}
					</p>
				</div>
			</div>
			<div className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
				{titles.map((t) => (
					<div key={t.key} className="w-[8.5rem] shrink-0 snap-start md:w-[10.5rem]">
						<QPoster t={t} q={q} onOpen={onOpen} how={how} onAdd={onAdd} meta={<Match t={t} />} />
					</div>
				))}
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ placed at #n

// A short-lived banner for the latest add: where it went and why, with one-tap corrections.
export function Landed({ q, className = "" }: { q: Queue; className?: string }) {
	const l = q.landed
	const [open, setOpen] = useState<number | null>(null)
	useEffect(() => {
		if (!l) return
		setOpen(l.n)
		const id = setTimeout(() => setOpen(null), 9000)
		return () => clearTimeout(id)
	}, [l?.n])
	const t = l ? q.T(l.key) : undefined
	const at = t ? q.pos(t.key) : 0
	return (
		<AnimatePresence>
			{l && t && at > 0 && open === l.n && (
				<motion.div
					key={l.n}
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					className={`flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-transparent p-2 pr-3 ${className}`}
					role="status"
				>
					<img src={posterUrl(t, "w154")} alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" />
					<motion.div initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }} className="shrink-0 text-amber-300">
						<Rank n={at} className="text-4xl md:text-5xl" />
					</motion.div>
					<div className="min-w-0 flex-1 basis-40">
						<p className="text-sm font-bold text-white sm:truncate">
							{t.title} {l.how === "auto" || l.how === "at" ? `placed at #${at}` : at === 1 ? "is up next" : `added at #${at}`}
						</p>
						<p className="text-xs text-gray-300 sm:truncate">{l.how === "auto" ? `Because it's a ${l.why}` : l.how === "at" ? `Where your answers put it. ${l.why}` : l.why}</p>
					</div>
					<div className="flex w-full shrink-0 justify-end gap-1 sm:w-auto">
						{at > 1 && (
							<button type="button" onClick={() => q.toTop(t.key)} aria-label={`Play ${t.title} next`} className="h-8 rounded-lg bg-amber-400 px-2.5 text-xs font-bold text-black hover:bg-amber-300 cursor-pointer">
								Play this next
							</button>
						)}
						<button type="button" onClick={() => setOpen(null)} aria-label="Keep it there" title="Keep it there" className="h-8 rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer">
							<span className="hidden sm:inline">Keep at #{at}</span>
							<CheckIcon className="h-4 w-4 sm:hidden" />
						</button>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ------------------------------------------------------------------ peek

// Title details in an overlay: the same pieces as the details hero, with the one button.
export function Peek({ q, t, onClose }: { q: Queue; t: WTitle | null; onClose: () => void }) {
	useEffect(() => {
		if (!t) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [t])
	const at = t ? q.pos(t.key) : 0
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
						<button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-2 text-white hover:bg-black/80 cursor-pointer">
							<XMarkIcon className="h-5 w-5" />
						</button>
						<div className="flex gap-5 p-5 pt-28 md:p-7 md:pt-32">
							<img src={posterUrl(t, "w342")} alt="" className="hidden w-40 shrink-0 self-start rounded-xl shadow-2xl shadow-black ring-1 ring-white/10 sm:block" />
							<div className="min-w-0 flex-1">
								<h2 className={`${DISPLAY} text-4xl leading-[0.95] text-white md:text-5xl`}>{t.title}</h2>
								<p className="mt-2 text-sm text-gray-300">
									{[t.year, runtimeLabel(t), t.genres.join(", ")].filter(Boolean).join(", ")}
								</p>
								<div className="mt-4 flex items-center gap-4">
									<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: t.score } } as never} size={48} />
									{t.match && <p className="text-sm text-gray-300">{t.match}% taste match</p>}
								</div>
								{t.tagline && <p className="mt-3 text-gray-200">{t.tagline}</p>}
								<div className="mt-4">
									<ServiceTiles title={t} size={40} max={4} names />
								</div>
								<div className="mt-5 flex flex-wrap items-center gap-2">
									<WantButton q={q} t={t} size="lg" />
									{at !== 1 && (
										<button
											type="button"
											onClick={() => (at ? q.toTop(t.key) : q.addQ(t.key, "top"))}
											className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-4 font-semibold text-white hover:bg-white/20 cursor-pointer"
										>
											<PlayIcon className="h-5 w-5 text-amber-300" />
											Play this next
										</button>
									)}
								</div>
								{at > 0 && <p className="mt-3 text-xs text-gray-400">Added {ageLabel(q.addedAt(t.key), q.now)}. #{at} of {q.count}.</p>}
							</div>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

// ------------------------------------------------------------------ empty hero

// The start hero's empty state, with the one button: the best match on your services becomes #1 when added.
export function EmptyHero({ q, onPeek }: { q: Queue; onPeek: (t: WTitle) => void }) {
	const t = q.suggest.forYou(1)[0]
	return (
		<section className="relative isolate min-h-[34rem] overflow-hidden md:min-h-[40rem]" aria-label="Your next watch">
			{t && <img src={backdropUrl(t, "original")} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%] opacity-55" />}
			<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-gradient-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-gray-900 to-transparent" />
			<div className="mx-auto grid min-h-[34rem] max-w-7xl items-end gap-8 px-4 pb-8 pt-40 sm:px-6 md:min-h-[40rem] md:items-center md:pt-10 lg:px-8">
				{t ? (
					<motion.div key={t.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 max-w-2xl">
						<p className="text-sm font-semibold text-amber-300">Your Wishlist is empty. Start with this?</p>
						<button type="button" onClick={() => onPeek(t)} className="block text-left cursor-pointer">
							<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.92] text-white md:text-7xl`}>{t.title}</h1>
						</button>
						<p className="mt-3 text-base text-gray-200 md:text-lg">
							{t.match ? `${t.match}% taste match. ` : ""}
							{t.tagline || t.genres.join(", ")}
						</p>
						<div className="mt-5">
							<ServiceTiles title={t} size={44} max={3} names />
						</div>
						<div className="mt-6 flex flex-wrap gap-2">
							<WantButton q={q} t={t} size="lg" />
							<button type="button" onClick={() => q.dismiss(t.key)} className="inline-flex h-12 items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
								Not for me
							</button>
						</div>
					</motion.div>
				) : (
					<h1 className={`${DISPLAY} text-5xl text-white`}>Nothing queued</h1>
				)}
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ compact row

// A queue row: rank, poster, title, where it streams, and the actions the variant passes.
export function QRow({ q, t, onOpen, actions, meta, accent = false, className = "" }: { q: Queue; t: WTitle; onOpen?: (t: WTitle) => void; actions?: React.ReactNode; meta?: React.ReactNode; accent?: boolean; className?: string }) {
	const at = q.pos(t.key)
	const w = watchLine(t)
	return (
		<div className={`flex items-center gap-3 rounded-lg border p-1.5 pr-2 ${accent ? "border-amber-400/50 bg-amber-400/[0.07]" : "border-white/5 bg-white/[0.03]"} ${className}`}>
			<Rank n={at} className={`w-9 shrink-0 text-right text-2xl md:w-11 md:text-3xl ${at <= 5 ? "text-white" : "text-gray-500"}`} />
			<button type="button" onClick={() => onOpen?.(t)} className="relative shrink-0 cursor-pointer">
				<img src={posterUrl(t, "w154")} alt="" loading="lazy" className="h-[4.5rem] w-12 rounded-md object-cover" />
				{w.owned && w.offer && <img src={w.offer.logo} alt={w.offer.name} className="absolute -bottom-1 -right-1 h-5 w-5 rounded border border-green-500" />}
			</button>
			<div className="min-w-0 flex-1">
				<button type="button" onClick={() => onOpen?.(t)} className="block max-w-full truncate text-left text-sm font-bold text-white hover:underline cursor-pointer">
					{t.title} <span className="font-normal text-gray-500">{t.year}</span>
				</button>
				<p className="truncate text-xs text-gray-400">{meta ?? `${w.text}${t.match ? `, ${t.match}% match` : ""}`}</p>
			</div>
			<div className="flex shrink-0 items-center gap-1" data-nodrag>
				{actions}
			</div>
		</div>
	)
}

export function Btn({ onClick, label, children, tone = "plain", className = "" }: { onClick: () => void; label: string; children: React.ReactNode; tone?: "plain" | "amber" | "green" | "ghost"; className?: string }) {
	const c = { plain: "bg-white/10 text-gray-100 hover:bg-white/20", amber: "bg-amber-400 text-black hover:bg-amber-300", green: "bg-green-500 text-black hover:bg-green-400", ghost: "text-gray-300 hover:bg-white/10" }[tone]
	return (
		<button type="button" onClick={onClick} aria-label={label} title={label} className={`inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-white ${c} ${className}`}>
			{children}
		</button>
	)
}

export function SectionHead({ title, note, right }: { title: React.ReactNode; note?: React.ReactNode; right?: React.ReactNode }) {
	return (
		<header className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
			<div className="min-w-0">
				<h2 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>{title}</h2>
				{note && <p className="mt-1 max-w-2xl text-sm text-gray-400">{note}</p>}
			</div>
			{right && <div className="shrink-0">{right}</div>}
		</header>
	)
}

// ------------------------------------------------------------------ demo controls

// Prototype chrome, visually apart from the design: which Wishlist state.
// "Want to See from another page" stands in for a tap on any poster elsewhere in the app, so the
// entry moment can be tried even when the queue is long and the suggestion row is gone.
export function DemoBar({ signedIn, mode, count, onReset, onSim }: { signedIn: boolean; mode: string; count: number; onReset: () => void; onSim: () => void }) {
	const [params] = useSearchParams()
	const [open, setOpen] = useState(true)
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
		<div className="fixed bottom-20 left-2 z-50 max-w-[calc(100vw-1rem)] text-xs font-semibold text-black md:bottom-3">
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
					<button type="button" onClick={onSim} className="rounded-full bg-fuchsia-100 px-2.5 py-1 hover:bg-fuchsia-200 cursor-pointer">
						Want to See from another page
					</button>
					<button type="button" onClick={onReset} className="rounded-full px-2 py-1 hover:bg-neutral-200 cursor-pointer">
						Reset
					</button>
					<button type="button" onClick={() => setOpen(false)} aria-label="Hide demo controls" className="rounded-full p-1 hover:bg-neutral-200 cursor-pointer">
						<XMarkIcon className="h-3.5 w-3.5" />
					</button>
				</div>
			) : (
				<button type="button" onClick={() => setOpen(true)} className="rounded-full bg-white px-3 py-1.5 shadow-2xl ring-2 ring-fuchsia-500 cursor-pointer">
					Demo
				</button>
			)}
		</div>
	)
}
