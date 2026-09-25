// PROTOTYPE — throwaway score-area variants. Lives only on the prototype/score-area branch.
// Shared data shaping, the rate trigger, and the episode-grid link for the variants.
import type React from "react"
import { useRef, useState } from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { ScorePicker } from "~/ui/details/hero/RateButton"
import { useClickOutside } from "~/ui/details/hero/useClickOutside"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"
import Drawer from "~/ui/modal/Drawer"
import { goodwatchScoreDisplay, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"

export type Media = MovieResult | ShowResult

export interface VariantProps {
	media: Media
	hasEpisodeGrid: boolean
}

export type SiteKey = "imdb" | "metacritic" | "rotten"
export type Kind = "critics" | "audience"

export interface SourceScore {
	id: string
	site: SiteKey
	siteName: string
	kind: Kind
	/** The value as the site shows it: 9.5, 87, 96% */
	value: string
	/** The value on a 0 to 100 scale */
	pct: number
	/** Ratings or reviews behind it */
	count: number | null
	url?: string
}

export interface Site {
	key: SiteKey
	name: string
	short: string
	logo: string
	url?: string
	critics: SourceScore | null
	audience: SourceScore | null
}

const num = (v: unknown): number | null => (typeof v === "number" && v > 0 ? v : null)

export function scoreData(media: Media) {
	const d = media.details as unknown as Record<string, unknown>
	const gwPct = num(d.goodwatch_overall_score_normalized_percent)
	const gwScore = gwPct == null ? null : goodwatchScoreDisplay(gwPct)
	const gw = {
		score: gwScore,
		vibe: gwPct == null ? null : goodwatchVibeIndex(gwPct),
		word: gwScore == null ? null : scoreLabels[Math.max(1, Math.round(gwScore / 10))],
		count: num(d.goodwatch_overall_score_voting_count),
	}

	const make = (
		id: string,
		site: SiteKey,
		siteName: string,
		kind: Kind,
		raw: number | null,
		format: (n: number) => string,
		toPct: (n: number) => number,
		count: unknown,
		url: unknown,
	): SourceScore | null =>
		raw == null
			? null
			: { id, site, siteName, kind, value: format(raw), pct: toPct(raw), count: num(count), url: (url as string) || undefined }

	const imdb = make("imdb", "imdb", "IMDb", "audience", num(d.imdb_user_score_original), (n) => n.toFixed(1), (n) => n * 10, d.imdb_user_score_rating_count, d.imdb_url)
	const mc = make("mc", "metacritic", "Metacritic", "critics", num(d.metacritic_meta_score_original), (n) => String(Math.floor(n)), (n) => n, d.metacritic_meta_score_review_count, d.metacritic_url)
	const mcUser = make("mcUser", "metacritic", "Metacritic", "audience", num(d.metacritic_user_score_original), (n) => n.toFixed(1), (n) => n * 10, d.metacritic_user_score_rating_count, d.metacritic_url)
	const rt = make("rt", "rotten", "Rotten Tomatoes", "critics", num(d.rotten_tomatoes_tomato_score_original), (n) => `${Math.floor(n)}%`, (n) => n, d.rotten_tomatoes_tomato_score_review_count, d.rotten_tomatoes_url)
	const rtUser = make("rtUser", "rotten", "Rotten Tomatoes", "audience", num(d.rotten_tomatoes_audience_score_original), (n) => `${Math.floor(n)}%`, (n) => n, d.rotten_tomatoes_audience_score_rating_count, d.rotten_tomatoes_url)

	const allSites: Site[] = [
		{ key: "imdb", name: "IMDb", short: "IMDb", logo: imdbLogo, url: (d.imdb_url as string) || undefined, critics: null, audience: imdb },
		{ key: "metacritic", name: "Metacritic", short: "Metacritic", logo: metacriticLogoIcon, url: (d.metacritic_url as string) || undefined, critics: mc, audience: mcUser },
		{ key: "rotten", name: "Rotten Tomatoes", short: "Tomatoes", logo: rottenLogoIcon, url: (d.rotten_tomatoes_url as string) || undefined, critics: rt, audience: rtUser },
	]
	const sites = allSites.filter((s) => s.critics || s.audience)
	const sources = [imdb, mc, mcUser, rt, rtUser].filter((s): s is SourceScore => s != null)
	return { gw, sites, sources }
}

export const kindLabel = (s: SourceScore) => (s.kind === "critics" ? "Critics" : s.site === "imdb" ? "Users" : "Audience")

export const compact = (n: number | null) =>
	n == null ? null : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// How much the sources agree, in words. Spread is max minus min on the 0 to 100 scale.
export function agreement(sources: SourceScore[]) {
	const pcts = sources.map((s) => s.pct)
	const critics = mean(sources.filter((s) => s.kind === "critics").map((s) => s.pct))
	const audience = mean(sources.filter((s) => s.kind === "audience").map((s) => s.pct))
	if (pcts.length < 2) return { spread: null, critics, audience, headline: pcts.length ? "Only one source so far" : "No outside scores yet", detail: "" }
	const spread = Math.max(...pcts) - Math.min(...pcts)
	const headline = spread <= 10 ? "Everyone agrees" : spread <= 22 ? "Mostly in agreement" : "Opinions are split"
	let detail = ""
	if (critics != null && audience != null) {
		const gap = Math.round(audience - critics)
		detail = Math.abs(gap) <= 4 ? "Critics and audiences land in the same place." : gap > 0 ? `Audiences rate it ${gap} points higher than critics.` : `Critics rate it ${-gap} points higher than audiences.`
	}
	return { spread, critics, audience, headline, detail }
}

export const vibeVar = (vibe: number | null) => (vibe == null ? "rgba(255,255,255,.25)" : `var(--color-vibe-${vibe})`)
export const pctVibe = (pct: number) => goodwatchVibeIndex(pct)

// A button that opens the existing score picker: a popover on desktop, a drawer on phones.
// The variant renders the button content; `score` is the viewer's own score or null.
export function RateTrigger({
	media,
	className = "",
	buttonClassName = "",
	align = "right",
	children,
}: {
	media: Media
	className?: string
	buttonClassName?: string
	align?: "left" | "right"
	children: (state: { score: number | null; open: boolean }) => React.ReactNode
}) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const score = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	useClickOutside(ref, () => setOpen(false))
	return (
		<div ref={ref} className={`relative ${className}`}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-haspopup="dialog"
				className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${buttonClassName}`}
			>
				{children({ score, open })}
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
					<div className="p-2">
						<ScorePicker media={media} onDone={() => setOpen(false)} />
					</div>
				</Drawer>
			</div>
		</div>
	)
}

// The same in-page link as EpisodeGridLink, with the look left to the variant.
export function EpisodesLink({ className = "", children }: { className?: string; children: React.ReactNode }) {
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
		<a href={`#${EPISODE_GRID_ANCHOR}`} onClick={onClick} className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}>
			{children}
		</a>
	)
}

// Loads the display faces the variants use. Prototype only.
export function PrototypeFonts() {
	return (
		<link
			rel="stylesheet"
			href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,400..800&display=swap"
		/>
	)
}

// A small grayscale mark for a site, so the brands stay recognizable without their colors.
export function SiteMark({ site, className = "h-4" }: { site: Site; className?: string }) {
	if (site.key === "imdb") {
		return (
			<span aria-hidden="true" className={`inline-flex items-center rounded-[3px] bg-white/85 px-1 text-[10px] font-black leading-none tracking-tight text-black ${className}`}>
				IMDb
			</span>
		)
	}
	return <img src={site.logo} alt="" aria-hidden="true" className={`grayscale contrast-125 ${className}`} />
}

// Text color that keeps contrast on a filled vibe color (white fails on the yellow-green middle).
const VIBE_HEX: Record<number, string> = { 0: "#7f1d1d", 10: "#991b1b", 20: "#b91c1c", 30: "#c2410c", 40: "#d97706", 50: "#ca8a04", 60: "#a3a323", 70: "#65a32d", 80: "#16934a", 90: "#15803d", 100: "#166534" }
const lum = (hex: string) => {
	const c = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export const onVibe = (vibe: number | null) => {
	if (vibe == null) return "#fff"
	const L = lum(VIBE_HEX[vibe])
	return (1.05) / (L + 0.05) >= (L + 0.05) / 0.05 ? "#fff" : "#000"
}
