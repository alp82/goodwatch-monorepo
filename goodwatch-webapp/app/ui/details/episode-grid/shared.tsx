// Pieces every episode grid layout uses: the palette choice, the legend, provider marks,
// the readout for the hovered or tapped episode, and the IMDb attribution line.
import { useCallback, useEffect, useState } from "react"
import type { GridEpisode, GridSpecial, ProviderScore } from "~/server/episode-grid.server"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import tmdbLogo from "~/img/tmdb-logo.svg"
import {
	LOW_VOTE_THRESHOLD,
	PALETTES,
	type PaletteName,
	PROVIDERS,
	type ProviderKey,
	SCORE_BUCKETS,
	cellColors,
	formatCount,
	formatScore,
} from "~/ui/details/episode-grid/scale"

const PALETTE_KEY = "episode-grid-palette"

/** The viewer's palette, remembered on this device. Renders "standard" on the server. */
export function usePalette() {
	const [palette, setPalette] = useState<PaletteName>("standard")
	useEffect(() => {
		try {
			const stored = localStorage.getItem(PALETTE_KEY)
			if (stored === "standard" || stored === "colorblind") setPalette(stored)
		} catch {}
	}, [])
	const choose = useCallback((next: PaletteName) => {
		setPalette(next)
		try {
			localStorage.setItem(PALETTE_KEY, next)
		} catch {}
	}, [])
	return [palette, choose] as const
}

export interface Selection {
	/** null for a special. */
	season: number | null
	episode: GridEpisode | GridSpecial
}

export const isLowVotes = (votes: number) => votes < LOW_VOTE_THRESHOLD

export const selectionLabel = ({ season, episode }: Selection) => {
	const where = season === null ? "Special" : `Season ${season}, episode ${(episode as GridEpisode).number}`
	const votes = `${formatCount(episode.votes)} IMDb vote${episode.votes === 1 ? "" : "s"}`
	return `${where}: ${episode.name || "Untitled"}. Rated ${formatScore(episode.score)} from ${votes}${isLowVotes(episode.votes) ? ", few votes" : ""}.`
}

export function PaletteToggle({ palette, onChange }: { palette: PaletteName; onChange: (p: PaletteName) => void }) {
	return (
		<fieldset className="m-0 min-w-0 inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 text-xs">
			<legend className="sr-only">Colours</legend>
			{(Object.keys(PALETTES) as PaletteName[]).map((name) => (
				<button
					key={name}
					type="button"
					aria-pressed={palette === name}
					onClick={() => onChange(name)}
					className={`rounded-full px-2.5 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-amber-300 ${
						palette === name ? "bg-white text-gray-900" : "text-gray-300 hover:text-white"
					}`}
				>
					{PALETTES[name].label}
				</button>
			))}
		</fieldset>
	)
}

/** The seven score steps, the few-votes mark and the gap mark. */
export function ScoreLegend({ compact = false }: { compact?: boolean }) {
	return (
		<ul className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-300 ${compact ? "" : "sm:gap-x-4"}`}>
			{SCORE_BUCKETS.map((bucket, i) => (
				<li key={bucket.label} className="flex items-center gap-1.5">
					<span
						aria-hidden="true"
						className="h-3.5 w-3.5 rounded-[3px]"
						style={{ background: `var(--eg-fill-${i})` }}
					/>
					<span>
						<span className="font-medium text-gray-100">{bucket.label}</span>{" "}
						<span className="text-gray-400">{bucket.range}</span>
					</span>
				</li>
			))}
			<li className="flex items-center gap-1.5">
				<span aria-hidden="true" className="h-3.5 w-3.5 rounded-[3px] border-2" style={{ borderColor: "var(--eg-fill-5)" }} />
				<span>Hollow: under {LOW_VOTE_THRESHOLD} votes</span>
			</li>
			<li className="flex items-center gap-1.5">
				<span aria-hidden="true" className="h-3.5 w-3.5 rounded-[3px] bg-white/[0.06]" />
				<span>Not rated</span>
			</li>
		</ul>
	)
}

const SITE_LOGO = {
	imdb: { src: imdbLogo, className: "h-3", bg: "bg-imdb" },
	tmdb: { src: tmdbLogo, className: "h-2.5", bg: "bg-[#0d253f]" },
	rotten: { src: rottenLogoIcon, className: "h-3.5", bg: "bg-rotten" },
	metacritic: { src: metacriticLogoIcon, className: "h-3.5", bg: "bg-metacritic" },
} as const

/** A provider's logo on its brand colour. With `label`, RT and Metacritic add "Critics" or "Audience"/"Users". */
export function ProviderMark({ provider, label = false, className = "" }: { provider: ProviderKey; label?: boolean; className?: string }) {
	const meta = PROVIDERS[provider]
	const logo = SITE_LOGO[meta.site]
	const showLabel = label && (meta.site === "rotten" || meta.site === "metacritic")
	return (
		<span className={`inline-flex items-center gap-1 ${className}`}>
			<span className={`inline-flex h-5 shrink-0 items-center rounded px-1 ${logo.bg}`}>
				<img src={logo.src} alt={showLabel ? "" : meta.name} className={logo.className} />
			</span>
			{showLabel && (
				<span className="text-[11px] leading-tight text-gray-300">
					<span className="sr-only">{meta.name}, </span>
					{meta.short}
				</span>
			)}
		</span>
	)
}

export const providerTitle = (provider: ProviderKey, value: ProviderScore | null) => {
	const meta = PROVIDERS[provider]
	if (!value) return `${meta.name}: no score`
	const count = value.count && meta.countNoun ? `, ${formatCount(value.count)} ${meta.countNoun}` : ""
	return `${meta.name}: ${meta.format(value.score)}${count}`
}

/** The hovered, focused or tapped episode in words. Screen readers hear it as it changes. */
export function EpisodeReadout({ selection, placeholder, className = "" }: { selection: Selection | null; placeholder: string; className?: string }) {
	return (
		<div aria-live="polite" className={`min-h-[3.25rem] text-sm ${className}`}>
			{selection ? (
				<div className="flex items-start gap-3">
					<span
						className="mt-0.5 inline-flex h-8 min-w-10 items-center justify-center rounded-md px-1.5 text-sm font-bold tabular-nums"
						style={isLowVotes(selection.episode.votes) ? { boxShadow: `inset 0 0 0 2px ${cellColors(selection.episode.score).background}`, color: "#f3f4f6" } : cellColors(selection.episode.score)}
					>
						{formatScore(selection.episode.score)}
					</span>
					<span className="min-w-0">
						<span className="block truncate font-semibold text-gray-100">{selection.episode.name || "Untitled"}</span>
						<span className="block text-gray-400">
							{selection.season === null ? "Special" : `Season ${selection.season}, episode ${(selection.episode as GridEpisode).number}`}
							{", "}
							{formatCount(selection.episode.votes)} IMDb votes
							{isLowVotes(selection.episode.votes) && ", few votes"}
						</span>
					</span>
				</div>
			) : (
				<p className="pt-1.5 text-gray-400">{placeholder}</p>
			)}
		</div>
	)
}

/** Required by the IMDb dataset license (https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX). */
export function ImdbAttribution({ className = "" }: { className?: string }) {
	return (
		<p className={`text-xs text-gray-400 ${className}`}>
			Information courtesy of IMDb (
			<a href="https://www.imdb.com" target="_blank" rel="noreferrer" className="underline decoration-gray-600 underline-offset-2 hover:text-gray-200">
				https://www.imdb.com
			</a>
			). Used with permission.
		</p>
	)
}

/** Build the episode list of a season with gaps: one slot per number from `first` to `last`. */
export const episodeSlots = (episodes: GridEpisode[], first: number, last: number) => {
	const byNumber = new Map(episodes.map((e) => [e.number, e]))
	const slots: { number: number; episode: GridEpisode | null }[] = []
	for (let n = first; n <= last; n++) slots.push({ number: n, episode: byNumber.get(n) ?? null })
	return slots
}
