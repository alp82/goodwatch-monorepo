// PROTOTYPE - throwaway (#659). Pieces the Sides-on-Watch-next variants share: how a side looks (its color and the
// posters of its loved titles; its words only with the names on), the stepped tiers with a side mark per poster, and
// the URL-driven choices (the prototype plans on the server, so every choice is a URL change).
import { ChevronDownIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { TIER_CAPS, type WatchNextTierSize } from "~/domain/watch-next"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { titleHref, useMoviesPage } from "~/ui/watch-next/WatchNextHero"
import { misfitWords, runtimeLabel, tierHeadingClass } from "~/ui/watch-next/labels"
import { DISPLAY, posterUrl } from "~/ui/watch-next/style"
import type { TitleKey } from "~/utils/title-key"
import type { SwnSide, SwnTier, SwnView } from "./model"

export const pct = (share: number) => `${Math.round(share * 100)}%`

/** Sets or clears URL parameters, keeping the rest. */
export function useParam() {
	const [params, setParams] = useSearchParams()
	return (changes: Record<string, string | null>) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(changes)) {
			if (v === null || v === "") p.delete(k)
			else p.set(k, v)
		}
		setParams(p, { replace: true, preventScrollReset: true })
	}
}

export const sideById = (view: SwnView, id: string | null | undefined) => (id ? (view.sides.find((s) => s.id === id) ?? null) : null)

/** The side's posters, fanned: its face when the words are off. */
export function SideFaces({ side, view, size = "sm" }: { side: SwnSide; view: SwnView; size?: "xs" | "sm" | "md" }) {
	const w = size === "xs" ? "w-5" : size === "sm" ? "w-7" : "w-11"
	return (
		<span className="inline-flex shrink-0 items-center" aria-hidden>
			{side.faces.slice(0, 3).map((key, i) => {
				const face = view.faces[key]
				return (
					<img
						key={key}
						src={posterUrl(face?.poster ?? null, "w92")}
						alt=""
						title={face?.title}
						className={`${w} aspect-[2/3] rounded-sm object-cover ring-2 ${i ? "-ml-2" : ""}`}
						style={{ ["--tw-ring-color" as string]: side.color }}
					/>
				)
			})}
		</span>
	)
}

/** A side's chip: its color, its posters, and (with the names on) its name, or its share of what you love. */
export function SideChip({ side, view, share = true, className = "" }: { side: SwnSide; view: SwnView; share?: boolean; className?: string }) {
	return (
		<span className={`inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-gray-200 ${className}`} data-side={side.id}>
			<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: side.color }} aria-hidden />
			<SideFaces side={side} view={view} size="xs" />
			<span className="truncate">
				{view.names ? side.name : `Side ${view.sides.indexOf(side) + 1}`}
				{share && <span className="font-normal text-gray-400"> · {pct(side.share)} of what you love</span>}
			</span>
		</span>
	)
}

/** "Funny + Feel-good": a side's moods, as Watch next's mood picker names them. */
export function moodNames(moods: MoodKey[]) {
	return moods.map((m) => MOOD_BY_KEY[m].name).join(" + ")
}

export function MoodButton({ side, className = "" }: { side: SwnSide; className?: string }) {
	const set = useParam()
	if (!side.moods.length) return null
	return (
		<button
			type="button"
			onClick={() => set({ moods: side.moods.join(","), side: null })}
			className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 text-xs font-semibold text-gray-200 hover:border-amber-400/70 ${className}`}
		>
			{side.moods.map((m) => (
				<span key={m} className="h-2 w-2 rounded-full" style={{ background: MOOD_BY_KEY[m].hue }} aria-hidden />
			))}
			Its moods: {moodNames(side.moods)}
		</button>
	)
}

const GRID: Record<WatchNextTierSize, string> = {
	xl: "grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-4",
	lg: "grid grid-cols-3 gap-2 md:flex md:flex-wrap md:gap-3",
	md: "grid grid-cols-4 gap-1.5 md:flex md:flex-wrap md:gap-2",
	sm: "grid grid-cols-6 gap-1 md:flex md:flex-wrap md:gap-1.5",
}
const ITEM: Record<WatchNextTierSize, string> = { xl: "md:w-56", lg: "md:w-36", md: "md:w-24", sm: "md:w-16" }

export type Mark = (title: WatchNextTitle, size: WatchNextTierSize) => ReactNode

/** A side's color under a poster. */
export function sideBar(view: SwnView): Mark {
	return (title, size) => {
		const side = sideById(view, view.sideOf[title.key])
		if (!side) return <span className="mt-1 block h-1 rounded-full bg-white/5" aria-hidden />
		return (
			<span className="mt-1 flex items-center gap-1.5" title={view.names ? side.name : `Side ${view.sides.indexOf(side) + 1}`}>
				<span className="h-1 flex-1 rounded-full" style={{ background: side.color }} aria-hidden />
				{view.names && (size === "xl" || size === "lg") && <span className="truncate text-[11px] text-gray-400">{side.name}</span>}
			</span>
		)
	}
}

function TierRow({ tier, view, mark, keys }: { tier: SwnTier; view: SwnView; mark?: Mark; keys: TitleKey[] }) {
	const [all, setAll] = useState(false)
	const movies = useMoviesPage()
	const misfits = tier.key === "notTonightsFit"
	const [opened, setOpened] = useState(false)
	const open = !misfits || opened
	const cap = TIER_CAPS[tier.size]
	const shown = all ? keys : keys.slice(0, cap)
	const big = tier.size === "xl" || tier.size === "lg"
	const count = `${keys.length} ${movies ? (keys.length === 1 ? "movie" : "movies") : keys.length === 1 ? "title" : "titles"}`
	return (
		<li className={`grid gap-3 md:grid-cols-[12rem_1fr] md:gap-8 ${tier.size === "xl" ? "pb-12" : tier.size === "lg" ? "pb-10" : "pb-8"}`} data-tier={tier.key}>
			<div className="md:sticky md:top-32 md:self-start md:text-right">
				<h3 className={`${DISPLAY} leading-none ${tierHeadingClass[tier.size]}`}>
					{misfits ? (
						<button type="button" aria-expanded={opened} onClick={() => setOpened(!opened)} className="inline-flex cursor-pointer items-center gap-1.5 text-gray-400 hover:text-white">
							<ChevronDownIcon className={`h-4 w-4 transition-transform ${opened ? "" : "-rotate-90"}`} aria-hidden />
							{tier.label}
						</button>
					) : (
						tier.label
					)}
				</h3>
				<p className="mt-1 text-sm text-gray-400">
					{tier.note && open ? `${tier.note} ` : ""}
					{count}
				</p>
			</div>
			{/* Production hides a closed group with "hidden", which md:flex overrides on desktop; here it is left out. */}
			{open && <div className={`min-w-0 ${GRID[tier.size]}`}>
				{shown.map((key) => {
					const title = view.titles[key]
					if (!title) return <div key={key} className={`aspect-[2/3] min-w-0 rounded-md bg-white/5 ${ITEM[tier.size]}`} aria-hidden />
					return big ? (
						<div key={key} className={`min-w-0 ${ITEM[tier.size]}`} data-key={key}>
							<TitlePosterCard card={title} />
							{mark?.(title, tier.size)}
							{tier.size === "xl" && <div className="truncate px-1 text-xs text-gray-400">{runtimeLabel(title, movies ? "Movie" : undefined)}</div>}
						</div>
					) : (
						<div key={key} className={`min-w-0 ${ITEM[tier.size]}`} data-key={key}>
							<Link to={titleHref(title)} className="relative block" title={title.title}>
								<img
									src={posterUrl(title.poster_path, tier.size === "md" ? "w185" : "w92")}
									alt={title.title}
									loading="lazy"
									className={`aspect-[2/3] w-full rounded-md bg-white/5 object-cover ring-1 ring-white/5 ${tier.size === "sm" || misfits ? "opacity-75 hover:opacity-100" : ""}`}
								/>
								{title.misfit && <span className="mt-1 block truncate text-xs text-gray-400">{misfitWords(title.misfit)}</span>}
							</Link>
							{mark?.(title, tier.size)}
						</div>
					)
				})}
				{keys.length > shown.length && (
					<button
						type="button"
						onClick={() => setAll(true)}
						className={`flex aspect-[2/3] min-w-0 cursor-pointer items-center justify-center rounded-md bg-white/5 text-center text-xs font-semibold text-gray-300 hover:bg-white/10 ${ITEM[tier.size]}`}
					>
						+{keys.length - shown.length}
					</button>
				)}
			</div>}
		</li>
	)
}

/** The stepped tiers, optionally narrowed to some titles and with a mark under each poster. */
export function Tiers({ view, mark, only, tiers = view.tiers, label }: { view: SwnView; mark?: Mark; only?: (key: TitleKey) => boolean; tiers?: SwnTier[]; label?: string }) {
	const rows = tiers.map((t) => ({ tier: t, keys: only ? t.keys.filter(only) : t.keys })).filter((r) => r.keys.length)
	if (!rows.length) return null
	return (
		<ol aria-label={label ?? "Your list, stepped"}>
			{rows.map((r) => (
				<TierRow key={r.tier.key} tier={r.tier} keys={r.keys} view={view} mark={mark} />
			))}
		</ol>
	)
}

export function AfterThat({ view, line }: { view: SwnView; line?: string }) {
	const movies = view.list === "movies"
	return (
		<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
			<span className="hidden md:block" />
			<div>
				<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>After that</h2>
				<p className="mt-1 text-sm text-gray-400">
					{line ?? (movies ? "The rest of your movies that fit, by Best match. Each step further down gets smaller." : "The rest of your Wishlist, by Best match. Each step further down gets smaller.")}
				</p>
			</div>
		</header>
	)
}
