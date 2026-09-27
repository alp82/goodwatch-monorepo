// PROTOTYPE - throwaway. Taste atoms for /prototype/rec-discover (#179): the match next to the score tab,
// a match bar, "because you liked" and "why" lines, movement chips, and the taste strength control.
// Amber plus the fingerprint icon is Taste's color in the app (the nav's Taste button), so match uses it.
import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { SPRING, TAP, buzz } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { toCard } from "~/ui/prototype-rec-filter-bar/kit"
import { type Disc, type Ranked, posterUrl, titleHref } from "./rank"
import type { DiscTitle } from "./types"

// The existing card, untouched, with an overlay that scales with it (the card is scale-95 until hovered).
// The match hangs under the GoodWatch score tab as an amber coin.
export function CoinCard({ t, mine, coin = true, children }: { t: DiscTitle; mine: number[]; coin?: boolean; children?: ReactNode }) {
	return (
		<div className="group/c relative">
			<MovieTvCard details={toCard(t, mine)} mediaType={t.media_type} />
			<div className="pointer-events-none absolute inset-0 scale-95 transition-transform duration-100 group-hover/c:scale-100">
				{coin && t.match != null && (
					<span
						title={`${t.match}% taste match`}
						className="absolute top-[63px] right-[7px] flex h-[26px] w-[56px] items-center justify-center gap-0.5 rounded-full bg-linear-to-b from-amber-400 to-amber-600 text-[13px] font-black tabular-nums text-gray-950 ring-[3px] ring-gray-900 shadow-[0_6px_16px_-4px_rgba(0,0,0,.8)]"
					>
						<FingerPrintIcon className="h-3.5 w-3.5 opacity-80" />
						{t.match}
					</span>
				)}
				{children}
			</div>
		</div>
	)
}

export function MatchNumber({ t, className = "" }: { t: DiscTitle; className?: string }) {
	if (t.match == null) return <span className={`text-xs text-gray-600 ${className}`}>No title analysis</span>
	return (
		<span className={`inline-flex items-center gap-1 font-bold tabular-nums text-amber-400 ${className}`}>
			<FingerPrintIcon className="h-3.5 w-3.5" />
			{t.match}% match
		</span>
	)
}

// A slim bar under the poster: how far into the person's own distribution this title sits.
export function MatchBar({ t, className = "" }: { t: DiscTitle; className?: string }) {
	const w = t.match == null ? 0 : ((t.match - 50) / 49) * 100
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			<div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
				<motion.div className="h-full rounded-full bg-linear-to-r from-amber-700 to-amber-400" initial={false} animate={{ width: `${w}%` }} transition={SPRING} />
			</div>
			<span className={`w-7 text-right text-xs font-bold tabular-nums ${t.match == null ? "text-gray-600" : t.match >= 85 ? "text-amber-300" : "text-gray-400"}`}>{t.match ?? "–"}</span>
		</div>
	)
}

export function MovedChip({ moved, className = "" }: { moved: number; className?: string }) {
	return (
		<AnimatePresence initial={false}>
			{moved !== 0 && (
				<motion.span
					key={moved > 0 ? "up" : "down"}
					initial={{ opacity: 0, y: moved > 0 ? 6 : -6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${moved > 0 ? "bg-amber-500/15 text-amber-300" : "bg-white/5 text-gray-500"}`}
				>
					{moved > 0 ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
					{Math.abs(moved)}
				</motion.span>
			)}
		</AnimatePresence>
	)
}

export function BecauseLine({ t, className = "" }: { t: DiscTitle; className?: string }) {
	if (!t.like) return null
	return (
		<span className={`flex min-w-0 items-center gap-2 ${className}`}>
			{t.like.poster_path && <img src={posterUrl(t.like.poster_path, "w92")} alt="" className="h-8 w-[22px] shrink-0 rounded-[3px] object-cover ring-1 ring-white/15" />}
			<span className="min-w-0 text-xs leading-snug text-gray-400">
				Because you liked <span className="font-bold text-gray-200">{t.like.title}</span>
			</span>
		</span>
	)
}

export const whyText = (t: DiscTitle) => (t.why.length ? t.why.join(" and ") : null)

export function WhyLine({ t, className = "" }: { t: DiscTitle; className?: string }) {
	const why = whyText(t)
	// A strong match doesn't need a warning; below that, say what usually puts the person off.
	const against = (t.match ?? 0) < 85 ? t.against : null
	if (!why && !against) return null
	return (
		<span className={`block text-xs leading-snug ${className}`}>
			{why && <span className="text-amber-200/80">{why.charAt(0).toUpperCase() + why.slice(1)}</span>}
			{against && (
				<span className="text-gray-500">
					{why ? ", but " : "Heavy on "}
					{why ? `heavy on ${against}` : against}
				</span>
			)}
		</span>
	)
}

// How much taste reorders the list. Four stops, because a free slider reads as precision the signal doesn't have.
export const STRENGTHS = [
	{ v: 0, label: "Off" },
	{ v: 0.3, label: "Light" },
	{ v: 0.6, label: "Strong" },
	{ v: 1, label: "Full" },
]

export function StrengthControl({ d, className = "", wide = false }: { d: Disc; className?: string; wide?: boolean }) {
	return (
		<div role="radiogroup" aria-label="Taste in the order" className={`relative flex h-12 items-center gap-1 rounded-2xl bg-white/[0.04] p-1 ring-1 ring-white/10 ${wide ? "w-full" : ""} ${className}`}>
			<span title="Taste in the order" className={`flex items-center gap-1.5 text-sm text-gray-400 ${wide ? "px-2.5" : "px-2"}`}>
				<FingerPrintIcon className="h-4 w-4 text-amber-500" />
				{wide && "Taste"}
			</span>
			{STRENGTHS.map((s) => {
				const on = Math.abs(d.strength - s.v) < 0.01
				return (
					<motion.button
						key={s.label}
						type="button"
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => (buzz(), d.setStrength(s.v))}
						className={`relative h-full rounded-xl text-sm font-bold cursor-pointer ${wide ? "flex-1 px-3" : "px-2.5"} ${on ? "text-gray-950" : "text-gray-400 hover:text-gray-200"}`}
					>
						{on && <motion.span layoutId={`disc-strength-${wide}`} transition={SPRING} className="absolute inset-0 rounded-xl bg-linear-to-b from-amber-400 to-amber-600" />}
						<span className="relative">{s.label}</span>
					</motion.button>
				)
			})}
		</div>
	)
}

// A plain poster tile for the bolder variants: poster, then the words.
export function PosterLink({ t, size = "w342", className = "", children }: { t: DiscTitle; size?: string; className?: string; children?: ReactNode }) {
	return (
		<Link to={titleHref(t)} prefetch="intent" className={`group relative block overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/10 ${className}`}>
			<img src={posterUrl(t.poster_path, size)} alt={t.title} loading="lazy" className="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
			{children}
		</Link>
	)
}

export const takeShown = (ranked: Ranked[], n: number) => ranked.slice(0, n)
