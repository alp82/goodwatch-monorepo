// PROTOTYPE (start page lab): parts the recs variants share: card rows, the tap poster, the picks reveal.
import { Link } from "@remix-run/react"
import { useEffect, type ReactNode } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { picksFrom } from "../../lab/fixture-search"
import { tmdbImage } from "../../lab/kit"
import { type LabCard, type LabData, useLab } from "../../lab/types"

export const score = (c: LabCard) => c.goodwatch_overall_score_normalized_percent ?? 0

/** Popular titles first, then the all-time best, without repeats, best score first. */
export function scoreRanked(data: LabData, limit = 10): LabCard[] {
	const seen = new Set<number>()
	const popular = data.guest.popular.filter((c) => score(c) > 0)
	const list = [...popular.sort((a, b) => score(b) - score(a))]
	for (const c of [...data.guest.topRated].sort((a, b) => score(b) - score(a))) list.push(c)
	return list.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true))).slice(0, limit)
}

const short = (title: string) => title.replace(/:.*$/, "")
export const joinNames = (cards: LabCard[]) => {
	const names = cards.map((c) => short(c.title))
	return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/** Picks for the taps, never empty: the best rated titles when the fixtures have no neighbors. */
export function usePicks(tapped: LabCard[] | null, limit = 12): LabCard[] {
	const { data, setShelfTitles } = useLab()
	const picks = tapped
		? (() => {
				const p = picksFrom(data, tapped, limit)
				const keys = new Set(tapped.map((t) => t.key))
				return p.length ? p : scoreRanked(data, limit + 3).filter((c) => !keys.has(c.key)).slice(0, limit)
			})()
		: []
	const sig = picks.map((p) => p.key).join(",")
	useEffect(() => {
		if (picks.length) setShelfTitles(picks)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sig])
	return picks
}

/** A row of the site's poster cards: scrolls sideways on phones, fits the width from `fitFrom`. */
export function CardRow({ cards, size = "md", ranked = false }: { cards: LabCard[]; size?: "sm" | "md"; ranked?: boolean }) {
	const w = size === "sm" ? "w-[6.5rem] sm:w-[8rem]" : "w-[8.5rem] sm:w-[10rem]"
	return (
		<ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
			{cards.map((card, i) => (
				<li key={card.key} className={`flex shrink-0 snap-start items-end ${ranked ? "" : w}`}>
					{ranked && (
						<span
							aria-hidden
							className="-mr-3 select-none text-[4.5rem] font-black leading-[0.8] tabular-nums text-transparent sm:text-[6rem]"
							style={{ WebkitTextStroke: "2px rgba(251,191,36,.7)" }}
						>
							{i + 1}
						</span>
					)}
					<div className={ranked ? w : "w-full"}>
						<TitlePosterCard card={card} actions={false} />
					</div>
				</li>
			))}
		</ul>
	)
}

/** A poster to tap in a taste quiz: amber ring and its number once picked. */
export function TapPoster({
	card,
	n,
	onTap,
	disabled,
	className = "",
}: {
	card: LabCard
	/** 1-based pick number, or 0 when not picked. */
	n: number
	onTap: () => void
	disabled?: boolean
	className?: string
}) {
	const on = n > 0
	return (
		<button
			type="button"
			onClick={onTap}
			disabled={disabled && !on}
			aria-pressed={on}
			aria-label={card.title}
			title={card.title}
			className={`group relative aspect-[2/3] w-full rounded-lg bg-gray-800 transition-transform duration-150 active:scale-95 ${className}`}
		>
			<img
				src={tmdbImage(card.poster_path, "w185")}
				alt=""
				loading="lazy"
				className={`h-full w-full rounded-lg object-cover transition-opacity duration-200 ${disabled && !on ? "opacity-40" : ""}`}
			/>
			<span
				className={`pointer-events-none absolute -inset-1 rounded-xl border-[3px] border-amber-400 transition duration-200 ${on ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
			/>
			<span
				className={`pointer-events-none absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-extrabold text-gray-950 transition duration-200 ${on ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
			>
				{n || ""}
			</span>
		</button>
	)
}

/** The three slots that fill as the guest taps. */
export function Slots({ picked, need = 3 }: { picked: LabCard[]; need?: number }) {
	return (
		<div className="flex gap-1.5" aria-label={`${picked.length} of ${need} picked`}>
			{Array.from({ length: need }, (_, i) => {
				const p = picked[i]
				return (
					<span
						key={p?.key ?? `empty-${i}`}
						className={`relative flex aspect-[2/3] w-7 items-center justify-center overflow-hidden rounded border-2 text-[11px] font-bold sm:w-8 ${p ? "border-amber-400" : "border-dashed border-white/25 text-white/40"}`}
					>
						{p ? <img src={tmdbImage(p.poster_path, "w185")} alt="" className="absolute inset-0 h-full w-full object-cover" /> : i + 1}
					</span>
				)
			})}
		</div>
	)
}

/** The quiet sign-up nudge under picks. */
export function KeepNudge({ children = "Keep these picks and get new ones every day." }: { children?: ReactNode }) {
	return (
		<p className="text-sm text-gray-300">
			{children}{" "}
			<Link to="/sign-up" className="font-semibold text-amber-400 underline-offset-4 hover:underline">
				Sign up free
			</Link>
		</p>
	)
}

/** Picks after the taps: why, the cards, the nudge and a way back. */
export function PicksReveal({
	because,
	picks,
	onAgain,
	againLabel = "Try three others",
	size = "md",
}: {
	because: LabCard[]
	picks: LabCard[]
	onAgain: () => void
	againLabel?: string
	size?: "sm" | "md"
}) {
	return (
		<div className="animate-[recs-in_.4s_ease-out_both]">
			<style>{`@keyframes recs-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
			<div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
				<div className="flex -space-x-2">
					{because.map((c) => (
						<img key={c.key} src={tmdbImage(c.poster_path, "w185")} alt="" className="aspect-[2/3] w-7 rounded border border-gray-950 object-cover" />
					))}
				</div>
				<p className="min-w-0 flex-1 text-sm text-gray-200 sm:text-base">
					Because you loved <b className="text-white">{joinNames(because)}</b>
				</p>
			</div>
			<CardRow cards={picks} size={size} />
			<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
				<KeepNudge />
				<button type="button" onClick={onAgain} className="text-sm font-semibold text-gray-400 hover:text-white">
					{againLabel}
				</button>
			</div>
		</div>
	)
}

export function SectionHead({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
	return (
		<div className="mb-4">
			{kicker && <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-400">{kicker}</div>}
			<h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
			{children}
		</div>
	)
}
