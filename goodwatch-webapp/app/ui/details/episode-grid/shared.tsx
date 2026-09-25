// Pieces every episode grid layout uses: the floating tip and popover, the season scores
// and legend that live inside them, provider marks and the IMDb attribution line.
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { GridEpisode, GridSeason, GridSpecial } from "~/server/episode-grid.server"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import tmdbLogo from "~/img/tmdb-logo.svg"
import {
	LOW_VOTE_THRESHOLD,
	PROVIDERS,
	type ProviderKey,
	describeProviderScore,
	formatCount,
	formatScore,
	imdbVibe,
	isLowVotes,
	vibeInkClass,
	vibeLabel,
	vibeTextColor,
} from "~/ui/details/episode-grid/scale"

/** One slot per number from `first` to `last`; `episode` is null for an unrated number. */
export const episodeSlots = (episodes: GridEpisode[], first: number, last: number) => {
	const byNumber = new Map(episodes.map((e) => [e.number, e]))
	const slots: { number: number; episode: GridEpisode | null }[] = []
	for (let n = first; n <= last; n++) slots.push({ number: n, episode: byNumber.get(n) ?? null })
	return slots
}

/** Where an episode sits, in words. `season` is null for a special. */
export const episodeWhere = (season: number | null, episode: GridEpisode | GridSpecial) =>
	season === null ? "Special" : `Season ${season}, episode ${(episode as GridEpisode).number}`

/** The accessible name of an episode cell: everything the tip shows. */
export const episodeLabel = (season: number | null, episode: GridEpisode | GridSpecial) => {
	const votes = `${formatCount(episode.votes)} IMDb vote${episode.votes === 1 ? "" : "s"}`
	return `${episodeWhere(season, episode)}: ${episode.name || "Untitled"}. Rated ${formatScore(episode.score)}, ${votes}${isLowVotes(episode.votes) ? ", few votes" : ""}.`
}

/** The accessible name of a season trigger: every site's season score. */
export const seasonLabel = (season: GridSeason, providers: ProviderKey[]) => {
	const scores = providers.flatMap((p) => {
		const value = season.scores[p]
		return value ? [describeProviderScore(p, value)] : []
	})
	return `Season ${season.number}. ${scores.length ? scores.join("; ") : "No season scores"}.`
}

// useLayoutEffect warns during server rendering; the float never renders there anyway.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

// ---------------------------------------------------------------------------------------
// Floating tip and popover
//
// One floating box per grid. Mouse users get it on hover, keyboard users on focus, touch
// users on tap (a tap pins it until the next tap elsewhere or Escape). Its content is
// visual only: every trigger already carries the same facts in its accessible name.

interface FloatState {
	id: string
	el: HTMLElement
	anchor: DOMRect
	content: ReactNode
	pinned: boolean
}

export function useFloat() {
	const [state, setState] = useState<FloatState | null>(null)
	const stateRef = useRef(state)
	stateRef.current = state

	const close = useCallback(() => setState(null), [])

	useEffect(() => {
		const openId = state?.id
		if (!openId) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") close()
		}
		const onDown = (event: PointerEvent) => {
			const target = event.target as HTMLElement | null
			if (target?.closest(`[data-float-id="${CSS.escape(openId)}"]`)) return
			close()
		}
		// Follow the anchor when the page or the grid box scrolls, e.g. while tabbing through.
		const follow = () => setState((s) => (s ? { ...s, anchor: s.el.getBoundingClientRect() } : s))
		window.addEventListener("keydown", onKey)
		window.addEventListener("pointerdown", onDown, true)
		window.addEventListener("scroll", follow, true)
		window.addEventListener("resize", follow)
		return () => {
			window.removeEventListener("keydown", onKey)
			window.removeEventListener("pointerdown", onDown, true)
			window.removeEventListener("scroll", follow, true)
			window.removeEventListener("resize", follow)
		}
	}, [state?.id, close])

	/** Props that make an element open the float with `content`. */
	const trigger = useCallback(
		(id: string, content: () => ReactNode) => {
			const open = (el: HTMLElement, pinned: boolean) =>
				setState({ id, el, anchor: el.getBoundingClientRect(), content: content(), pinned })
			return {
				"data-float-id": id,
				onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
					if (event.pointerType === "mouse" && !stateRef.current?.pinned) open(event.currentTarget, false)
				},
				onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
					const current = stateRef.current
					if (event.pointerType === "mouse" && current?.id === id && !current.pinned) close()
				},
				onFocus: (event: React.FocusEvent<HTMLElement>) => {
					if (!stateRef.current?.pinned) open(event.currentTarget, false)
				},
				onBlur: () => {
					const current = stateRef.current
					if (current?.id === id && !current.pinned) close()
				},
				onClick: (event: React.MouseEvent<HTMLElement>) => {
					const current = stateRef.current
					if (current?.id === id && current.pinned) close()
					else open(event.currentTarget, true)
				},
			}
		},
		[close],
	)

	return { state, trigger, close, isOpen: (id: string) => state?.id === id }
}

/** Draws the float above its anchor, or below when there is no room, inside the viewport. */
export function FloatLayer({ state }: { state: FloatState | null }) {
	const ref = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

	useIsoLayoutEffect(() => {
		const el = ref.current
		if (!state || !el) return setPosition(null)
		const { width, height } = el.getBoundingClientRect()
		const { anchor } = state
		const gap = 6
		const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - 8)
		// The site header covers the top ~120px of the viewport; go below when it would hide the box.
		const above = anchor.top - height - gap
		const top = above >= 128 ? above : anchor.bottom + gap
		setPosition({ left, top })
	}, [state])

	if (!state) return null
	return (
		<div
			ref={ref}
			aria-hidden="true"
			data-float-id={state.id}
			className="pointer-events-none fixed z-[80] max-w-[min(18rem,calc(100vw-16px))] rounded-lg border border-white/10 bg-gray-950/95 px-3 py-2 text-sm text-gray-200 shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur"
			style={position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: "hidden" }}
		>
			{state.content}
		</div>
	)
}

// ---------------------------------------------------------------------------------------
// What goes inside the float

export function EpisodeTip({ season, episode }: { season: number | null; episode: GridEpisode | GridSpecial }) {
	const vibe = imdbVibe(episode.score)
	const low = isLowVotes(episode.votes)
	return (
		<div className="flex items-start gap-2.5">
			<span className={`mt-0.5 inline-flex h-7 min-w-9 items-center justify-center rounded-md px-1.5 text-sm font-bold tabular-nums bg-vibe-${vibe} ${vibeInkClass(vibe)}`}>
				{formatScore(episode.score)}
			</span>
			<span className="min-w-0">
				<span className="block font-semibold leading-snug text-gray-50">{episode.name || "Untitled"}</span>
				<span className="block text-xs text-gray-400">
					{season === null ? "Special" : `S${season} E${(episode as GridEpisode).number}`} · {formatCount(episode.votes)} votes
				</span>
				{low && <span className="mt-1 block text-xs text-amber-200/90">Few votes (under {LOW_VOTE_THRESHOLD}), so this score can still move.</span>}
			</span>
		</div>
	)
}

const SITE_LOGO = {
	imdb: { src: imdbLogo, className: "h-2.5", bg: "bg-imdb" },
	tmdb: { src: tmdbLogo, className: "h-2", bg: "bg-[#0d253f]" },
	rotten: { src: rottenLogoIcon, className: "h-3", bg: "bg-rotten" },
	metacritic: { src: metacriticLogoIcon, className: "h-3", bg: "bg-metacritic" },
} as const

/** A provider's small logo on its brand colour. */
export function ProviderLogo({ provider }: { provider: ProviderKey }) {
	const logo = SITE_LOGO[PROVIDERS[provider].site]
	return (
		<span className={`inline-flex h-4 w-9 shrink-0 items-center justify-center rounded ${logo.bg}`}>
			<img src={logo.src} alt="" className={logo.className} />
		</span>
	)
}

/** Every site's score for one season, one line each. Missing providers are left out. */
export function SeasonScoreList({ season, providers, inline = false }: { season: GridSeason; providers: ProviderKey[]; inline?: boolean }) {
	const rows = providers.flatMap((p) => {
		const value = season.scores[p]
		return value ? [{ p, value }] : []
	})
	if (!rows.length) return <p className="text-xs text-gray-400">No site has a score for this season.</p>
	if (inline)
		return (
			<ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
				{rows.map(({ p, value }) => {
					const meta = PROVIDERS[p]
					const suffix = meta.site === "rotten" || meta.site === "metacritic" ? meta.short : null
					return (
						<li key={p} className="flex items-center gap-1.5">
							<ProviderLogo provider={p} />
							{suffix && <span className="text-xs text-gray-400">{suffix}</span>}
							<span className="text-sm font-semibold tabular-nums text-gray-50">{meta.format(value.score)}</span>
						</li>
					)
				})}
			</ul>
		)
	return (
		<ul className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1">
			{rows.map(({ p, value }) => {
				const meta = PROVIDERS[p]
				const suffix = meta.site === "rotten" || meta.site === "metacritic" ? meta.short : null
				return (
					<li key={p} className="contents">
						<ProviderLogo provider={p} />
						<span className="text-xs text-gray-400">
							{suffix ?? (p === "imdb" ? "Episode avg" : "Season avg")}
							{value.count && meta.countNoun ? <span className="text-gray-500"> · {formatCount(value.count)}</span> : null}
						</span>
						<span className="text-right text-sm font-semibold tabular-nums text-gray-50">{meta.format(value.score)}</span>
					</li>
				)
			})}
		</ul>
	)
}

export function SeasonTip({ season, providers }: { season: GridSeason; providers: ProviderKey[] }) {
	return (
		<div className="min-w-52">
			<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Season {season.number} by site</p>
			<SeasonScoreList season={season} providers={providers} />
		</div>
	)
}

/** The key to the grid: the vibe steps episodes actually use, the few-votes mark and gaps. */
export function LegendContent({ lowVoteSample, children }: { lowVoteSample: ReactNode; children?: ReactNode }) {
	const steps = [
		{ vibe: 90, range: "9+" },
		{ vibe: 80, range: "8" },
		{ vibe: 70, range: "7" },
		{ vibe: 60, range: "6" },
		{ vibe: 50, range: "5" },
		{ vibe: 40, range: "<5" },
	]
	return (
		<div className="w-64 space-y-2 text-xs text-gray-300">
			<p className="text-gray-400">IMDb episode ratings, coloured like every GoodWatch score.</p>
			<ul className="flex gap-0.5">
				{steps.map(({ vibe, range }) => (
					<li key={vibe} className="flex-1 text-center">
						<span className={`block rounded-sm py-0.5 text-[11px] font-semibold bg-vibe-${vibe} ${vibeInkClass(vibe)}`}>{range}</span>
						<span className="mt-0.5 block text-[10px] leading-tight" style={{ color: vibeTextColor(vibe) }}>
							{vibeLabel(vibe)}
						</span>
					</li>
				))}
			</ul>
			<p className="flex items-center gap-2">
				{lowVoteSample}
				<span>Under {LOW_VOTE_THRESHOLD} votes: may still move</span>
			</p>
			<p className="flex items-center gap-2">
				<span className="inline-block h-3 w-4 rounded-sm bg-white/[0.06]" />
				<span>Not rated on IMDb</span>
			</p>
			{children}
		</div>
	)
}

/** Required by the IMDb dataset license (https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX). */
export function ImdbAttribution({ className = "" }: { className?: string }) {
	return (
		<p className={`text-[11px] text-gray-500 ${className}`}>
			Information courtesy of IMDb (
			<a href="https://www.imdb.com" target="_blank" rel="noreferrer" className="underline decoration-gray-700 underline-offset-2 hover:text-gray-300">
				https://www.imdb.com
			</a>
			). Used with permission.
		</p>
	)
}
