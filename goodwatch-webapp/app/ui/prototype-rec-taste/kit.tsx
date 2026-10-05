// PROTOTYPE - throwaway. Shared bits for /prototype/rec-taste variants, built from existing components.
// Posters are plain <img>s (not ~/ui/Poster) so the prototype sends no poster impressions.
import { Link } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import RatingOverlay from "~/ui/ratings/RatingOverlay"
import StreamingOverlay from "~/ui/streaming/StreamingOverlay"
import type { AllRatings } from "~/utils/ratings"
import { getScoreBgClass, getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { titleToDashed } from "~/utils/helpers"
import type { Score } from "~/server/scores.server"
import type { PoolItem, Service } from "./model"
import type { Taste } from "./useTaste"

export const href = (item: PoolItem) => `/${item.type}/${item.id}-${titleToDashed(item.title)}`

export const ratingsOf = (item: PoolItem) => ({ goodwatch_overall_score_normalized_percent: item.score }) as AllRatings

export const linksOf = (item: PoolItem, services: Service[]) =>
	item.services
		.map((id) => services.find((s) => s.id === id))
		.filter((s): s is Service => !!s)
		.map((s) => ({ provider_id: s.id, provider_name: s.name, provider_logo_path: s.logo.replace("https://www.themoviedb.org/t/p/original/", "") })) as never

/** The poster card as MovieTvCard draws it: border-4 frame, GoodWatch score tab, service logos, title fade. */
export function PosterCard({
	item,
	services,
	match,
	children,
	onClick,
	className = "",
	showTitle = true,
	dim = false,
}: {
	item: PoolItem
	services: Service[]
	match?: number
	children?: ReactNode
	onClick?: () => void
	className?: string
	showTitle?: boolean
	dim?: boolean
}) {
	const body = (
		<div className="relative">
			<RatingOverlay ratings={ratingsOf(item)} />
			<StreamingOverlay links={linksOf(item, services)} />
			<img
				className={`block w-full aspect-[2/3] object-cover rounded-md pointer-events-none transition ${dim ? "brightness-50 grayscale" : ""}`}
				src={item.poster}
				alt={`Poster for ${item.title}`}
				draggable="false"
				loading="lazy"
			/>
			{showTitle && (
				<div className="hidden @6xs:flex flex-col justify-end gap-1 absolute bottom-0 w-full min-h-32 px-2 py-2 bg-linear-to-t from-black/85 to-transparent rounded-b-md">
					{match != null && <MatchText match={match} />}
					<span className="text-sm font-bold text-white leading-tight">
						{item.title} ({item.year})
					</span>
				</div>
			)}
			{children}
		</div>
	)
	const cls = `@container flex flex-col w-full bg-gray-900 border-4 rounded-lg border-gray-800 hover:border-amber-700/50 group ${className}`
	return onClick ? (
		<button type="button" onClick={onClick} className={`${cls} text-left`}>
			{body}
		</button>
	) : (
		<div className={cls}>{body}</div>
	)
}

export function MatchText({ match, className = "", short = false }: { match: number; className?: string; short?: boolean }) {
	const vibe = Math.min(100, Math.floor(match / 10) * 10)
	return (
		<span className={`text-xs font-bold tabular-nums ${className}`} style={{ color: `var(--color-vibe-${vibe})`, filter: "brightness(1.5)" }}>
			{match}%{short ? "" : " your taste"}
		</span>
	)
}

export function Ring({ item, size = 44, label = false }: { item: PoolItem; size?: number; label?: boolean }) {
	return <ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: item.score } } as never} size={size} label={label} />
}

export function ServiceLogos({ item, services, size = "w-7 h-7", onlyMine = false }: { item: PoolItem; services: Service[]; size?: string; onlyMine?: boolean }) {
	const list = item.services.map((id) => services.find((s) => s.id === id)).filter((s): s is Service => !!s && (!onlyMine || s.mine))
	if (!list.length) return <span className="text-xs text-gray-400">Not on your services</span>
	return (
		<span className="flex items-center gap-1">
			{list.slice(0, 4).map((s) => (
				<img key={s.id} src={s.logo} alt={s.name} title={s.name} className={`${size} rounded-lg border-2 ${s.mine ? "border-gray-400" : "border-gray-700 opacity-50"}`} />
			))}
		</span>
	)
}

/** The ClickScorer rating bar: ten vibe-colored steps, hover fills up to the pointer. */
export function VibeBar({ onScore, compact = false, value }: { onScore: (s: Score) => void; compact?: boolean; value?: number }) {
	const [hover, setHover] = useState<Score | null>(null)
	return (
		<div className="w-full">
			<div className="flex w-full overflow-hidden rounded-lg">
				{Array.from({ length: 10 }, (_, i) => {
					const s = (i + 1) as Score
					const lit = hover != null ? s <= hover : value != null && s <= value
					const tone = hover ?? (value as Score | undefined) ?? s
					return (
						<button
							key={s}
							type="button"
							aria-label={`${s} of 10, ${scoreLabels[s]}`}
							className={`flex-1 ${compact ? "h-9" : "h-14"} flex items-center justify-center cursor-pointer ${lit ? getScoreBgClass(tone, tone) : `${getScoreBgClass(s, s)} opacity-60`}`}
							onMouseEnter={() => setHover(s)}
							onMouseLeave={() => setHover(null)}
							onClick={() => onScore(s)}
						>
							<span className={`${compact ? "text-sm" : "text-lg"} font-bold ${lit ? "text-white" : "text-white/70"}`}>{s}</span>
						</button>
					)
				})}
			</div>
			<div className="h-5 mt-1 text-center text-sm font-semibold" style={{ color: hover ? getVibeColorValue(hover) : undefined }}>
				{hover ? scoreLabels[hover] : ""}
			</div>
		</div>
	)
}

/** "On my services" is on by default for members with saved services, one tap to everywhere. */
export function ServicesSwitch({ taste, className = "" }: { taste: Taste; className?: string }) {
	const mine = taste.services.filter((s) => s.mine)
	return (
		<button
			type="button"
			onClick={taste.toggleMine}
			aria-pressed={taste.onlyMine}
			className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition ${taste.onlyMine ? "border-amber-600/70 bg-amber-900/30 text-amber-100" : "border-gray-700 bg-gray-900 text-gray-300"} ${className}`}
		>
			<span className="flex -space-x-1.5">
				{mine.map((s) => (
					<img key={s.id} src={s.logo} alt="" className={`h-5 w-5 rounded-md ring-2 ring-gray-950 ${taste.onlyMine ? "" : "grayscale opacity-60"}`} />
				))}
			</span>
			{taste.onlyMine ? "On my services" : "Everywhere"}
		</button>
	)
}

/** A small arrow for rank movement since the last change. */
export function Moved({ delta }: { delta: number | null }) {
	if (delta === 0) return null
	if (delta == null) return <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">NEW</span>
	return <span className={`text-xs font-bold tabular-nums ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>
}

/** Keyboard shortcuts that ignore typing in inputs. */
export function useKeys(map: Record<string, () => void>, enabled = true) {
	useEffect(() => {
		if (!enabled) return
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			const fn = map[e.key.toLowerCase()] ?? map[e.key]
			if (fn) {
				e.preventDefault()
				fn()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
}

export function Kbd({ children }: { children: ReactNode }) {
	return <kbd className="inline-flex min-w-5 h-5 items-center justify-center rounded border border-gray-600 bg-gray-800 px-1 font-sans text-[11px] font-bold text-gray-300">{children}</kbd>
}

export const layoutSpring = { type: "spring", stiffness: 500, damping: 40, mass: 0.8 } as const
export const MotionDiv = motion.div
