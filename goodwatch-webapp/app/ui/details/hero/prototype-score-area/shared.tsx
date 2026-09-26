// PROTOTYPE — throwaway score-area variants. Lives only on the prototype/score-area branch.
// Round 2: the production building blocks (ScoreRing, the rating chips, the rate button, the
// episode-ratings chip) stay as they look today; only layout, grouping, and size steps vary.
// Chips and RateBtn below copy the production classes and add size steps; nothing is restyled.
import { StarIcon, TableCellsIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { useRef, useState } from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"
import ListActions from "~/ui/details/hero/ListActions"
import { ScorePicker } from "~/ui/details/hero/RateButton"
import { BackdropTrailer, PosterTrailer, backdropUrl } from "~/ui/details/hero/Trailer"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import Drawer from "~/ui/modal/Drawer"
import type { Section } from "~/utils/scroll"

export type Media = MovieResult | ShowResult

export interface VariantProps {
	media: Media
	country: string
	hasEpisodeGrid: boolean
	navigateToSection: (section: Section) => void
}

// The production glass surface on the backdrop.
export const GLASS = "md:rounded-xl md:border md:border-white/10 md:bg-black/55 md:backdrop-blur-md"

// ---------------------------------------------------------------------------------------------
// Rating chips: the production RatingChips, with size steps, layouts, and optional hiding of
// sites that have no score at all.

type ChipSize = "xs" | "sm" | "md" | "lg"
const CHIP_SIZE: Record<ChipSize, { chip: string; imdb: string; logo: string; bar: string }> = {
	xs: { chip: "h-6 gap-1 px-1.5 text-xs", imdb: "h-2.5", logo: "h-3", bar: "h-2.5" },
	sm: { chip: "h-7 gap-1 px-1.5 text-[13px]", imdb: "h-3", logo: "h-3.5", bar: "h-3" },
	md: { chip: "h-8 gap-1.5 px-2 text-sm md:h-9", imdb: "h-3.5", logo: "h-4", bar: "h-3.5" },
	lg: { chip: "h-10 gap-2 px-2.5 text-base", imdb: "h-4", logo: "h-5", bar: "h-4" },
}

export function Chips({
	media,
	size = "md",
	layout = "fillPhone",
	hideEmpty = false,
	className = "",
}: {
	media: Media
	size?: ChipSize
	/** fillPhone: equal columns on phones, a row from md (production). fill: equal columns always.
	 * row: one line, no wrapping. wrap: a wrapping row. col: stacked, left-aligned. */
	layout?: "fillPhone" | "fill" | "row" | "wrap" | "col"
	hideEmpty?: boolean
	className?: string
}) {
	const d = media.details
	const imdb = d.imdb_user_score_original ? d.imdb_user_score_original.toFixed(1) : null
	const mc = d.metacritic_meta_score_original ? String(Math.floor(d.metacritic_meta_score_original)) : null
	const mcUser = d.metacritic_user_score_original ? d.metacritic_user_score_original.toFixed(1) : null
	const rt = d.rotten_tomatoes_tomato_score_original ? `${Math.floor(d.rotten_tomatoes_tomato_score_original)}%` : null
	const rtUser = d.rotten_tomatoes_audience_score_original ? `${Math.floor(d.rotten_tomatoes_audience_score_original)}%` : null
	const s = CHIP_SIZE[size]
	const center = layout === "fill" || layout === "fillPhone"

	const pair = (critics: string | null, audience: string | null) => (
		<>
			<span>{critics ?? "–"}</span>
			<span aria-hidden="true" className={`${s.bar} w-px bg-current opacity-40`} />
			<span className="font-medium opacity-90">{audience ?? "–"}</span>
		</>
	)
	const chip = (key: string, href: string | undefined, logo: string, alt: string, value: React.ReactNode, brand: string, title: string) => (
		<a
			key={key}
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			title={title}
			className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-md font-semibold tabular-nums ${s.chip} ${center ? "justify-center" : ""} ${brand} ${
				href ? "hover:brightness-110" : "pointer-events-none opacity-50"
			}`}
		>
			<img src={logo} alt={alt} className={alt === "IMDb" ? s.imdb : s.logo} />
			{value}
		</a>
	)
	const all = [
		{ has: !!imdb, node: chip("imdb", d.imdb_url, imdbLogo, "IMDb", imdb ?? "–", "bg-imdb text-black", `IMDb: ${imdb ?? "no score"}`) },
		{ has: !!(mc || mcUser), node: chip("mc", d.metacritic_url, metacriticLogoIcon, "Metacritic", pair(mc, mcUser), "bg-metacritic text-white", `Metacritic: critics ${mc ?? "–"}, audience ${mcUser ?? "–"}`) },
		{ has: !!(rt || rtUser), node: chip("rt", d.rotten_tomatoes_url, rottenLogoIcon, "Rotten Tomatoes", pair(rt, rtUser), "bg-rotten text-white", `Rotten Tomatoes: critics ${rt ?? "–"}, audience ${rtUser ?? "–"}`) },
	]
	const shown = hideEmpty ? all.filter((c) => c.has) : all
	const cols = { gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }
	if (layout === "fill") return <div className={`grid gap-1.5 ${className}`} style={cols}>{shown.map((c) => c.node)}</div>
	if (layout === "fillPhone")
		return (
			<>
				<div className={`grid gap-1.5 md:hidden ${className}`} style={cols}>{shown.map((c) => c.node)}</div>
				<div className={`hidden items-center gap-1.5 md:flex md:flex-wrap ${className}`}>{shown.map((c) => c.node)}</div>
			</>
		)
	if (layout === "col") return <div className={`flex flex-col items-start gap-1.5 ${className}`}>{shown.map((c) => c.node)}</div>
	return <div className={`flex items-center gap-1.5 ${layout === "wrap" ? "flex-wrap" : ""} ${className}`}>{shown.map((c) => c.node)}</div>
}

// ---------------------------------------------------------------------------------------------
// Rate button: the production RateButton look, with a smaller size step. Opens the production
// score picker: a popover on desktop, a drawer on phones.

export function RateBtn({ media, size = "md", align = "right", className = "" }: { media: Media; size?: "sm" | "md"; align?: "left" | "right"; className?: string }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const sheetRef = useRef<HTMLDivElement>(null)
	const score = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	useClickOutside([ref, sheetRef], () => setOpen(false))
	const look = score
		? `bg-vibe-${score * 10} text-white`
		: "bg-yellow-400 text-black hover:bg-yellow-300 md:border-2 md:border-yellow-400 md:bg-transparent md:text-yellow-300 md:hover:bg-yellow-400/10"
	return (
		<div ref={ref} className={`relative ${className}`}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-haspopup="dialog"
				className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold shadow-lg shadow-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
					size === "md" ? "h-11 px-4 text-base" : "h-9 px-3 text-sm"
				} ${look}`}
			>
				<StarIcon className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
				{score ? `Your score: ${score}` : "Rate this"}
			</button>
			{open && (
				<dialog
					open
					aria-label={`Rate ${media.details.title}`}
					className={`absolute top-full z-50 mt-3 hidden w-[26rem] rounded-2xl border border-white/10 bg-stone-900 p-5 text-white shadow-2xl shadow-black/70 md:block ${align === "right" ? "left-auto right-0" : "left-0 right-auto"}`}
				>
					<ScorePicker media={media} onDone={() => setOpen(false)} />
				</dialog>
			)}
			<div className="md:hidden">
				<Drawer open={open} onClose={() => setOpen(false)}>
					<div ref={sheetRef} className="p-2">
						<ScorePicker media={media} onDone={() => setOpen(false)} />
					</div>
				</Drawer>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------
// Episode ratings as a quiet text link (the chip itself is the production EpisodeGridLink).

export function EpisodesText({ className = "" }: { className?: string }) {
	const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const section = document.getElementById(EPISODE_GRID_ANCHOR)
		if (!section) return
		event.preventDefault()
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
		history.replaceState(history.state, "", `#${EPISODE_GRID_ANCHOR}`)
		section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true })
	}
	return (
		<a
			href={`#${EPISODE_GRID_ANCHOR}`}
			onClick={onClick}
			className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-300 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
		>
			<TableCellsIcon aria-hidden="true" className="h-4 w-4 text-gray-400" />
			Episode ratings
		</a>
	)
}

// ---------------------------------------------------------------------------------------------
// The production hero frame with slots, so a variant can move the score block around it.
// Production: poster left, backdrop panel right with the score bar on top and the
// where-to-watch glass at the bottom.

export function HeroFrame({
	media,
	country,
	navigateToSection,
	top,
	abovePanel,
	posterBelow,
	bottomTop,
	height = "fixed",
}: VariantProps & {
	/** Inside the backdrop panel, at the top (where the production score bar sits). */
	top?: React.ReactNode
	/** Above the backdrop panel in the right column, on the page background. */
	abovePanel?: React.ReactNode
	/** Under the poster in the poster column (md and up only). */
	posterBelow?: React.ReactNode
	/** Inside the bottom glass, above where-to-watch. */
	bottomTop?: React.ReactNode
	/** fixed: the production 28.5rem hero. min: at least that tall. auto: as tall as the columns. */
	height?: "fixed" | "min" | "auto"
}) {
	const heightClass = { fixed: "md:h-[28.5rem] md:grid-rows-[minmax(0,1fr)]", min: "md:min-h-[28.5rem]", auto: "" }[height]
	return (
		<div className={`grid gap-4 md:grid-cols-[auto_1fr] [&>*]:min-w-0 ${heightClass}`}>
			{posterBelow ? (
				<div className="hidden w-[19rem] flex-col gap-3 md:flex">
					<PosterTrailer media={media} className="aspect-[2/3] w-full" />
					{posterBelow}
				</div>
			) : (
				<PosterTrailer media={media} className="hidden aspect-[2/3] md:block md:h-full md:w-[19rem]" />
			)}
			<div className="flex min-h-0 min-w-0 flex-col gap-4">
				{abovePanel}
				<div className="relative flex min-h-0 grow flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl md:bg-transparent">
					<div className="absolute inset-0 hidden overflow-hidden rounded-xl md:block" aria-hidden="true">
						<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%]" />
						<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
					</div>
					<BackdropTrailer media={media} className="h-44 rounded-t-2xl md:hidden" />
					{top}
					{top && <div className="mx-4 mt-4 h-px bg-white/10 md:hidden" />}
					<div className="hidden min-h-8 grow md:block" aria-hidden="true" />
					<div className={`relative flex flex-col gap-4 p-4 md:m-3 md:mt-0 ${GLASS}`}>
						{bottomTop}
						<WhereToWatch media={media} country={country} navigateToSection={navigateToSection} />
						<ListActions media={media} />
					</div>
				</div>
			</div>
		</div>
	)
}
