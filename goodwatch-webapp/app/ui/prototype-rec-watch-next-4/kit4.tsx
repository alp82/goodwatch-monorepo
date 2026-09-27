// PROTOTYPE - throwaway. Shared pieces for round 4 of Watch next (#176): the hero that shows the top of the
// current selection and swaps with motion when the selection changes, the line that says whether you are
// looking at a view or your saved order ("Use this order"), and the stepped grid with its three tier rules.
import { CheckIcon, PlayIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import type React from "react"
import { useState } from "react"
import { ServiceTiles, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { DISPLAY, QPoster, WRAP, WantButton } from "~/ui/prototype-rec-watch-next-3/kit3"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import { type Sel, type View, adopt, describe, isDefault, relax, suggestFor, tests } from "./select"

export { DISPLAY, WRAP }

// ------------------------------------------------------------------ hero

function PlayButton({ t }: { t: WTitle }) {
	const w = watchLine(t)
	if (!w.offer) return null
	return (
		<a
			href={`#play-${t.key}`}
			onClick={(e) => e.preventDefault()}
			className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200"
		>
			<img src={w.offer.logo} alt="" className="h-8 w-8 rounded-md" />
			<PlayIcon className="h-5 w-5" />
			{w.owned ? `Play on ${w.offer.name}` : `Open ${w.offer.name}`}
		</a>
	)
}

const SWAP = { initial: { opacity: 0, x: 48 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -48 }, transition: { duration: 0.32, ease: [0.2, 0.7, 0.2, 1] } } as const

// The start hero from round 2, fed by the selection. `top` puts the selection inside the hero, over the
// backdrop; without it the selection sits above the hero.
export function Hero4({ q, v, sel, setSel, onPeek, onPass, top, bold = false }: { q: Queue; v: View; sel: Sel; setSel: (s: Sel) => void; onPeek: (t: WTitle) => void; onPass: (k: string) => void; top?: React.ReactNode; bold?: boolean }) {
	const first = v.keys[0] ? q.T(v.keys[0]) : undefined
	const offer = first ? undefined : suggestFor(q, sel)
	const stage = first ?? offer
	const saved = first ? q.pos(first.key) : 0
	const plain = isDefault(sel)
	return (
		<section className={`relative isolate overflow-hidden ${bold ? "min-h-[40rem] md:min-h-[46rem]" : "min-h-[34rem] md:min-h-[40rem]"}`} aria-label="Your next watch">
			<AnimatePresence mode="popLayout" initial={false}>
				{stage && (
					<motion.img
						key={stage.key}
						src={backdropUrl(stage, "original")}
						alt=""
						initial={{ opacity: 0, scale: 1.08 }}
						animate={{ opacity: first ? 1 : 0.5, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.8 }}
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
				)}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-gradient-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-gray-900 to-transparent" />
			{top && <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-gray-900/90 to-transparent" />}
			{top && <div className={`${WRAP} relative pt-6 md:pt-8`}>{top}</div>}

			<div className={`${WRAP} grid items-end gap-8 pb-8 md:grid-cols-[1fr_auto] md:items-center ${top ? "min-h-[22rem] pt-12 md:min-h-[30rem] md:pt-6" : "min-h-[34rem] pt-40 md:min-h-[40rem] md:pt-10"}`}>
				<AnimatePresence mode="wait" initial={false}>
					{first ? (
						<motion.div key={first.key} {...SWAP} className="min-w-0 max-w-2xl">
							<p className="flex flex-wrap items-baseline gap-x-3 text-sm font-semibold">
								<span className="text-amber-300">{plain ? "Watch next" : "Top of this selection"}</span>
								{!plain && saved > 0 && <span className="text-gray-300">#{saved} in your saved order</span>}
							</p>
							<button type="button" onClick={() => onPeek(first)} className="block text-left cursor-pointer">
								<h1 className={`${DISPLAY} mt-1 leading-[0.92] text-white ${first.title.length > 22 ? "text-4xl md:text-6xl lg:text-7xl" : `text-5xl md:text-7xl ${bold ? "lg:text-[7.5rem]" : "lg:text-8xl"}`}`}>{first.title}</h1>
							</button>
							<p className="mt-3 text-base text-gray-200 md:text-lg">{first.tagline || first.genres.join(", ")}</p>
							<p className="mt-1 text-sm text-gray-400">
								{[first.year, runtimeLabel(first), first.match ? `${first.match}% taste match` : null, first.leavingInDays != null ? `Leaves in ${first.leavingInDays} days` : null].filter(Boolean).join(", ")}
							</p>
							<div className="mt-5">
								<ServiceTiles title={first} size={44} max={3} names />
							</div>
							<div className="mt-6 flex flex-wrap items-center gap-2">
								<PlayButton t={first} />
								<button type="button" onClick={() => q.watched(first.key)} className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20 cursor-pointer">
									<CheckIcon className="h-5 w-5 text-green-400" />I watched it
								</button>
								{v.keys.length > 1 && (
									<button type="button" onClick={() => onPass(first.key)} className="inline-flex h-12 items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
										Not tonight
									</button>
								)}
							</div>
						</motion.div>
					) : (
						<motion.div key={`none-${offer?.key ?? ""}`} {...SWAP} className="min-w-0 max-w-2xl">
							<NoFit q={q} sel={sel} setSel={setSel} offer={offer} onPeek={onPeek} />
						</motion.div>
					)}
				</AnimatePresence>
				<AnimatePresence mode="wait" initial={false}>
					{stage && (
						<motion.button
							type="button"
							key={stage.key}
							onClick={() => onPeek(stage)}
							initial={{ opacity: 0, y: 24, rotate: 2 }}
							animate={{ opacity: first ? 1 : 0.8, y: 0, rotate: 0 }}
							exit={{ opacity: 0, y: -24 }}
							transition={{ duration: 0.35 }}
							className={`hidden cursor-pointer md:block ${bold ? "w-72 lg:w-80" : "w-56 lg:w-64"}`}
							aria-label={`${stage.title} details`}
						>
							<img src={posterUrl(stage, "w500")} alt="" className="w-full rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10" />
						</motion.button>
					)}
				</AnimatePresence>
			</div>
		</section>
	)
}

// When nothing on the Wishlist fits: loosen one filter, or add a suggestion that does fit.
function NoFit({ q, sel, setSel, offer, onPeek }: { q: Queue; sel: Sel; setSel: (s: Sel) => void; offer: WTitle | undefined; onPeek: (t: WTitle) => void }) {
	const ts = tests(sel)
	const empty = q.count === 0
	return (
		<>
			<p className="text-sm font-semibold text-amber-300">{empty ? "Your Wishlist is empty" : `Nothing on your Wishlist fits: ${ts.map((x) => x.label).join(", ")}`}</p>
			{offer ? (
				<>
					<button type="button" onClick={() => onPeek(offer)} className="block text-left cursor-pointer">
						<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.92] text-white md:text-7xl`}>{offer.title}</h1>
					</button>
					<p className="mt-3 text-base text-gray-200 md:text-lg">
						{empty ? "Start with this? " : "This one fits. "}
						{offer.match ? `${offer.match}% taste match. ` : ""}
						{runtimeLabel(offer)}.
					</p>
					<div className="mt-5">
						<ServiceTiles title={offer} size={44} max={3} names />
					</div>
					<div className="mt-6 flex flex-wrap gap-2">
						<WantButton q={q} t={offer} size="lg" />
					</div>
				</>
			) : (
				<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.92] text-white md:text-6xl`}>Nothing fits yet</h1>
			)}
			{!empty && ts.length > 0 && (
				<div className="mt-6 flex flex-wrap items-center gap-2">
					<span className="text-sm text-gray-400">Or loosen it:</span>
					{ts.map((x) => (
						<button key={x.key} type="button" onClick={() => setSel(relax(sel, x.key))} className="h-9 rounded-full bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer">
							Drop "{x.label}"
						</button>
					))}
				</div>
			)}
		</>
	)
}

// ------------------------------------------------------------------ view or saved order

// Says plainly whether the page shows your saved order or a view of it, and offers to save the view.
export function OrderLine({ q, v, sel, setSel, className = "", dark = false }: { q: Queue; v: View; sel: Sel; setSel: (s: Sel) => void; className?: string; dark?: boolean }) {
	if (q.count < 2) return null
	const plain = isDefault(sel)
	const use = () => {
		const first = q.T(v.keys[0])
		q.setOrder(adopt(q, v), `Saved as your order. ${first?.title ?? "The top title"} is #1 on your Wishlist.`)
		setSel({ ...sel, by: "mine", services: false, kind: "all", length: "any", mood: null, genre: null })
	}
	const changes = v.keys.slice(0, 12).some((k, i) => q.order[i] !== k)
	return (
		<div className={`flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 text-sm ${className}`} role="status">
			{plain ? (
				<p className={dark ? "text-gray-300" : "text-gray-400"}>
					Your saved order, {q.count} titles. Pick what fits tonight; your order stays as it is.
				</p>
			) : (
				<>
					<p className="min-w-0 flex-1 basis-64 text-gray-200">
						<span className="font-semibold text-white">Just a view:</span> {describe(sel)}. {v.hidden > 0 ? `${v.keys.length} of ${q.count} titles fit. ` : ""}
						<span className="text-gray-400">Your saved order stays as it is.</span>
					</p>
					<div className="flex shrink-0 gap-2">
						{changes && v.keys.length > 0 && (
							<button type="button" onClick={use} className="h-10 rounded-lg bg-amber-400 px-4 font-bold text-black hover:bg-amber-300 cursor-pointer" title={v.hidden > 0 ? `These ${v.keys.length} move to the top in this order; the other ${v.hidden} follow as before.` : "Save this as your order"}>
								Use this order
							</button>
						)}
						<button type="button" onClick={() => setSel({ ...sel, by: "mine", services: false, kind: "all", length: "any", mood: null, genre: null })} className="h-10 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/20 cursor-pointer">
							Back to my order
						</button>
					</div>
				</>
			)}
		</div>
	)
}

// ------------------------------------------------------------------ stepped grid

export type Size = "xl" | "lg" | "md" | "sm"
export type Tier = { key: string; label: string; note?: string; size: Size; keys: string[] }

// Every tier is a step down from the one above: fewer pixels per title, more titles per row.
const GRID: Record<Size, string> = {
	xl: "grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4",
	lg: "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3",
	md: "grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2",
	sm: "grid grid-cols-6 gap-1 md:flex md:flex-wrap md:gap-1.5",
}
const ITEM: Record<Size, string> = { xl: "md:w-56", lg: "md:w-36", md: "md:w-24", sm: "md:w-16" }
const HEAD: Record<Size, string> = { xl: "text-3xl md:text-4xl text-amber-300", lg: "text-2xl md:text-3xl text-white", md: "text-xl md:text-2xl text-gray-200", sm: "text-lg md:text-xl text-gray-400" }
const CAP: Record<Size, number> = { xl: 99, lg: 99, md: 40, sm: 30 }

export function Tiers({ q, tiers, onPeek, className = "" }: { q: Queue; tiers: Tier[]; onPeek: (t: WTitle) => void; className?: string }) {
	return (
		<LayoutGroup>
			<ol className={className} aria-label="Your Wishlist, stepped">
				{tiers
					.filter((t) => t.keys.length)
					.map((tier) => (
						<TierRow key={tier.key} q={q} tier={tier} onPeek={onPeek} />
					))}
			</ol>
		</LayoutGroup>
	)
}

function TierRow({ q, tier, onPeek }: { q: Queue; tier: Tier; onPeek: (t: WTitle) => void }) {
	const [all, setAll] = useState(false)
	const titles = tier.keys.map(q.T).filter((t): t is WTitle => !!t)
	const shown = all ? titles : titles.slice(0, CAP[tier.size])
	const big = tier.size === "xl" || tier.size === "lg"
	return (
		<li className={`grid gap-3 md:grid-cols-[12rem_1fr] md:gap-8 ${tier.size === "xl" ? "pb-12" : tier.size === "lg" ? "pb-10" : "pb-8"}`} data-tier={tier.key}>
			<div className="md:sticky md:top-24 md:self-start md:text-right">
				<h3 className={`${DISPLAY} leading-none ${HEAD[tier.size]}`}>{tier.label}</h3>
				<p className="mt-1 text-sm text-gray-400">
					{tier.note ? `${tier.note} ` : ""}
					{titles.length} {titles.length === 1 ? "title" : "titles"}
				</p>
			</div>
			<div className={`min-w-0 ${GRID[tier.size]}`}>
				{shown.map((t) =>
					big ? (
						<motion.div key={t.key} layoutId={`p-${t.key}`} transition={{ type: "spring", stiffness: 380, damping: 34 }} className={`min-w-0 ${ITEM[tier.size]}`} data-key={t.key}>
							<QPoster t={t} q={q} onOpen={onPeek} meta={tier.size === "xl" ? <Meta t={t} /> : undefined} />
						</motion.div>
					) : (
						<div key={t.key} className={`min-w-0 ${ITEM[tier.size]}`} data-key={t.key}>
							<button type="button" onClick={() => onPeek(t)} className="block w-full cursor-pointer" title={`${t.title}, #${q.pos(t.key)} in your saved order`}>
								<img
									src={posterUrl(t, tier.size === "md" ? "w185" : "w92")}
									alt={t.title}
									loading="lazy"
									className={`aspect-[2/3] w-full rounded-md object-cover ring-1 ring-white/5 ${tier.size === "sm" ? "opacity-75 hover:opacity-100" : ""}`}
								/>
							</button>
						</div>
					),
				)}
				{titles.length > shown.length && (
					<button type="button" onClick={() => setAll(true)} className={`flex aspect-[2/3] items-center justify-center rounded-md bg-white/5 text-center text-xs font-semibold text-gray-300 hover:bg-white/10 cursor-pointer ${ITEM[tier.size]}`}>
						+{titles.length - shown.length}
					</button>
				)}
			</div>
		</li>
	)
}

function Meta({ t }: { t: WTitle }) {
	const w = watchLine(t)
	return (
		<span>
			{runtimeLabel(t)}
			{w.owned && w.offer ? `, on ${w.offer.name}` : ""}
		</span>
	)
}

// ------------------------------------------------------------------ tier rules

// By evening: at four evenings a week, a film takes one and a series two. The hero is tonight.
const nights = (t: WTitle | undefined) => (t?.type === "show" ? 2 : 1)
export function byEvening(q: Queue, keys: string[], pace = 4): Tier[] {
	const steps: { key: string; label: string; upTo: number; size: Size }[] = [
		{ key: "week", label: "This week", upTo: 7, size: "xl" },
		{ key: "next", label: "Next week", upTo: 14, size: "lg" },
		{ key: "month", label: "This month", upTo: 31, size: "md" },
		{ key: "year", label: "Later this year", upTo: 365, size: "sm" },
		{ key: "someday", label: "Someday", upTo: Number.POSITIVE_INFINITY, size: "sm" },
	]
	const out = steps.map((s) => ({ ...s, keys: [] as string[] }))
	let used = nights(q.T(keys[0]))
	for (const k of keys.slice(1)) {
		const day = Math.floor((used / pace) * 7)
		used += nights(q.T(k))
		out.find((s) => day < s.upTo)!.keys.push(k)
	}
	return out
}

// By rank: fixed bands under the hero.
export function byRank(keys: string[]): Tier[] {
	const rest = keys.slice(1)
	return [
		{ key: "up", label: "Up next", size: "xl", keys: rest.slice(0, 4) },
		{ key: "soon", label: "Soon", size: "lg", keys: rest.slice(4, 12) },
		{ key: "later", label: "Later", size: "md", keys: rest.slice(12, 32) },
		{ key: "someday", label: "Someday", size: "sm", keys: rest.slice(32) },
	]
}

// By fit: titles that meet every filter first and largest, then the ones that miss one, then the rest.
export function byFit(v: View): Tier[] {
	if (!v.need) return byRank(v.keys)
	const rest = v.keys.slice(1)
	const all = rest.filter((k) => v.fit.get(k) === v.need)
	const one = rest.filter((k) => v.fit.get(k) === v.need - 1)
	const other = rest.filter((k) => (v.fit.get(k) ?? 0) < v.need - 1)
	return [
		{ key: "fits", label: "Fits all of it", size: "xl", keys: all.slice(0, 4) },
		{ key: "fits2", label: "Also fits", size: "lg", keys: all.slice(4, 16) },
		{ key: "fits3", label: "Fits, further down", size: "md", keys: all.slice(16) },
		{ key: "close", label: "Close", note: "Misses one thing.", size: "md", keys: one },
		{ key: "rest", label: "Not tonight", note: "Misses more.", size: "sm", keys: other },
	]
}
