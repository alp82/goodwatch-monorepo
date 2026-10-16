// PROTOTYPE - throwaway (#662). Pieces the rating-moment variants share: posters that keep the prototype's address,
// how a side is referred to with and without side names (words gate, #656), the #526 why row, and the Watch next link.
import { Link, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { MOOD_BY_KEY } from "~/domain/moods"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import { posterUrl } from "~/ui/taste/tabs/parts"
import type { TitleKey } from "~/utils/title-key"
import { type MomentSide, type MomentView, WHY } from "./model"

export const pct = (x: number) => `${Math.round(x * 100)}%`

export function useProtoHref() {
	const [params] = useSearchParams()
	return (t: PortraitTitle) => {
		const p = new URLSearchParams(params)
		return `/${t.mediaType === "show" ? "tv" : "movie"}/${t.tmdbId}?${p.toString()}`
	}
}

export function titlesOf(view: MomentView, keys: (TitleKey | null | undefined)[]) {
	return keys.flatMap((k) => (k != null && view.titles[k] ? [view.titles[k]] : []))
}

export function Poster({ t, className = "", ring }: { t: PortraitTitle; className?: string; ring?: string }) {
	const href = useProtoHref()
	return (
		<Link
			to={href(t)}
			title={t.title}
			className={`relative block shrink-0 overflow-hidden rounded-md bg-gray-900 ${className}`}
			style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
		>
			<img src={posterUrl(t, "w185")} alt={`Poster for ${t.title}`} className="block aspect-[2/3] w-full object-cover" draggable={false} />
		</Link>
	)
}

/** The side's titles other than the one just rated, the most typical first. */
export function sideTitles(view: MomentView, side: MomentSide, n: number) {
	return titlesOf(view, side.here.filter((k) => k !== view.key)).slice(0, n)
}

/**
 * How text refers to a side. With side names: "your Bleak crime side". Without (the words gate): by two of its
 * titles, "your side with Zodiac and Prisoners", which is grouping, not a description.
 */
export function SideRef({ view, side, names }: { view: MomentView; side: MomentSide; names: boolean }) {
	if (names)
		return (
			<>
				your side of <b style={{ color: side.hue }}>{side.name.charAt(0).toLowerCase() + side.name.slice(1)}</b>
			</>
		)
	const [a, b] = sideTitles(view, side, 2)
	return (
		<>
			your side with <b className="text-white">{a?.title ?? "…"}</b>
			{b && (
				<>
					{" "}
					and <b className="text-white">{b.title}</b>
				</>
			)}
		</>
	)
}

/** The side as a mark: its hue and, with names, its name; without, a stack of three posters. */
export function SideMark({ view, side, names, size = "sm" }: { view: MomentView; side: MomentSide; names: boolean; size?: "sm" | "md" }) {
	const posters = sideTitles(view, side, 3)
	const w = size === "md" ? "w-9" : "w-6"
	return (
		<span className="inline-flex min-w-0 items-center gap-2">
			<span className="flex shrink-0 -space-x-2">
				{posters.map((t) => (
					<img key={t.key} src={posterUrl(t, "w185")} alt="" className={`${w} aspect-[2/3] rounded-sm object-cover`} style={{ boxShadow: `0 0 0 2px ${side.hue}` }} />
				))}
			</span>
			{names && (
				<span className="truncate font-bold" style={{ color: side.hue }}>
					{side.name}
				</span>
			)}
		</span>
	)
}

/** #526: one optional tap for why, after a score of 5 or less. Stores nothing in the prototype. */
export function WhyRow({ score, onDone, compact = false }: { score: number; onDone?: () => void; compact?: boolean }) {
	const [picked, setPicked] = useState<string | null>(null)
	if (picked)
		return (
			<p className="text-sm text-gray-300" aria-live="polite">
				Noted: <b className="text-white">{picked}</b>. Thanks, that helps.
			</p>
		)
	return (
		<div>
			<div className="flex items-center justify-between gap-3">
				<p className={`font-semibold ${compact ? "text-sm" : ""}`}>What made it {score === 8 ? "an" : "a"} {score}?</p>
				{onDone && (
					<button type="button" onClick={onDone} className="cursor-pointer text-xs font-semibold text-gray-400 hover:text-white">
						Skip
					</button>
				)}
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{WHY.map((w) => (
					<button
						key={w}
						type="button"
						onClick={() => {
							setPicked(w)
							if (onDone) setTimeout(onDone, 1400)
						}}
						className="cursor-pointer rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-sm font-semibold text-gray-100 hover:border-amber-400/70 hover:bg-amber-400/10"
					>
						{w}
					</button>
				))}
			</div>
		</div>
	)
}

/** Every side can open Watch next with its moods. The mood names show only with side names on (words gate). */
export function WatchNextLink({ side, names, className = "" }: { side: MomentSide; names: boolean; className?: string }) {
	if (!side.moods.length) return null
	return (
		<Link
			to={`/watch-next?moods=${side.moods.join(",")}`}
			className={`inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black hover:bg-amber-100 ${className}`}
		>
			{names ? <>Watch next: {side.moods.map((m) => MOOD_BY_KEY[m].name).join(" + ")}</> : "Watch next like this side"}
			<span aria-hidden="true">→</span>
		</Link>
	)
}

export function sideById(sides: MomentSide[] | undefined, id: string | null | undefined) {
	return sides?.find((s) => s.id === id) ?? null
}
