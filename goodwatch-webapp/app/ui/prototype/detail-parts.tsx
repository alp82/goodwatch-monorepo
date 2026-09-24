// PROTOTYPE - throwaway. Compact building blocks for the detail-page hero
// variants: score badge, rating chips, my score, actions, streaming, trailer.

import { Dialog, DialogPanel } from "@headlessui/react"
import { BookmarkIcon, CheckIcon, StarIcon } from "@heroicons/react/20/solid"
import { Link as RemixLink, useLocation } from "@remix-run/react"
import { AdjustmentsHorizontalIcon, EyeIcon, ForwardIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/solid"
import React, { useEffect, useRef, useState } from "react"
import ReactPlayer from "react-player/youtube"
import { useIsOnWishlist, useIsSkipped, useIsWatched, useUserScore } from "~/hooks/useUserDataAccessors"
import { useUserStreamingProviders } from "~/routes/api.user-settings.get"
import type { MovieResult, ShowResult, StreamingType } from "~/server/types/details-types"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import Drawer from "~/ui/modal/Drawer"
import CountrySelector from "~/ui/streaming/CountrySelector"
import SkippedAction from "~/ui/user/actions/SkippedAction"
import ToWatchAction from "~/ui/user/actions/ToWatchAction"
import WatchHistoryAction from "~/ui/user/actions/WatchHistoryAction"
import ScoreSelector from "~/ui/user/ScoreSelector"
import ScoreAction from "~/ui/user/actions/ScoreAction"
import { extractRatings, scoreLabels } from "~/utils/ratings"
import type { Section } from "~/utils/scroll"
import {
	duplicateProviderMapping,
	getShorterProviderLabel,
	getStreamingUrl,
	ignoredProviders,
} from "~/utils/streaming-links"

export type Media = MovieResult | ShowResult

// --- Ratings ---

export function useRatings(media: Media) {
	const r = extractRatings(media.details)
	const gw = r.goodwatch_overall_score_normalized_percent ? Math.floor(r.goodwatch_overall_score_normalized_percent) : null
	return {
		gw,
		vibe: gw == null ? null : Math.floor(gw / 10) * 10,
		imdb: r.imdb_user_score_original ? r.imdb_user_score_original.toFixed(1) : null,
		imdbUrl: r.imdb_url,
		mc: r.metacritic_meta_score_original ? Math.floor(r.metacritic_meta_score_original) : null,
		mcUser: r.metacritic_user_score_original ? r.metacritic_user_score_original.toFixed(1) : null,
		mcUrl: r.metacritic_url,
		rt: r.rotten_tomatoes_tomato_score_original ? Math.floor(r.rotten_tomatoes_tomato_score_original) : null,
		rtAudience: r.rotten_tomatoes_audience_score_original ? Math.floor(r.rotten_tomatoes_audience_score_original) : null,
		rtUrl: r.rotten_tomatoes_url,
	}
}

// Ring filled to the score, in the app's vibe color scale.
export function ScoreRing({ media, size = 56, label = true }: { media: Media; size?: number; label?: boolean }) {
	const { gw, vibe } = useRatings(media)
	const stroke = size / 11
	const r = (size - stroke) / 2
	const c = 2 * Math.PI * r
	return (
		<div className="flex items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
			<div className="relative shrink-0" style={{ width: size, height: size }}>
				<svg width={size} height={size} className="-rotate-90" aria-hidden="true">
					<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
					{gw != null && (
						<circle
							cx={size / 2}
							cy={size / 2}
							r={r}
							fill="none"
							stroke={`var(--color-vibe-${vibe})`}
							strokeWidth={stroke}
							strokeLinecap="round"
							strokeDasharray={`${(gw / 100) * c} ${c}`}
						/>
					)}
				</svg>
				<span
					className="absolute inset-0 flex items-center justify-center font-bold tabular-nums"
					style={{ fontSize: size * 0.36 }}
				>
					{gw ?? "–"}
				</span>
			</div>
			{label && (
				<span className="flex flex-col leading-tight">
					<span className="text-base font-semibold" style={gw == null ? undefined : { color: `var(--color-vibe-${vibe})` }}>
						{gw == null ? "Not rated yet" : scoreLabels[Math.max(1, Math.round(gw / 10))]}
					</span>
					<span className="text-xs text-gray-300">GoodWatch score</span>
				</span>
			)}
		</div>
	)
}

// External ratings as small linked chips. `tone` picks a dark or brand style.
export function RatingChips({ media, tone = "dark", size = "sm", fill = false }: { media: Media; tone?: "dark" | "brand"; size?: "sm" | "md"; fill?: boolean }) {
	const r = useRatings(media)
	const h = size === "md" ? "h-9" : "h-7"
	const pair = (critics: string | null, audience: string | null) => (
		<>
			<span>{critics ?? "–"}</span>
			<span aria-hidden="true" className="h-3.5 w-px bg-current opacity-40" />
			<span className="font-medium opacity-90">{audience ?? "–"}</span>
		</>
	)
	const chip = (href: string, logo: string, alt: string, value: React.ReactNode, brand: string, title?: string) => (
		<a
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			title={title}
			className={`${h} inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-semibold tabular-nums ${fill ? "justify-center" : ""} ${
				tone === "brand" ? brand : "bg-white/8 text-gray-100 hover:bg-white/15"
			} ${href ? "" : "opacity-50 pointer-events-none"}`}
		>
			<img src={logo} alt={alt} className={alt === "IMDb" ? "h-3.5" : "h-4"} />
			{value}
		</a>
	)
	return (
		<div className={fill ? "grid grid-cols-3 gap-1.5" : "flex flex-wrap items-center gap-1.5"}>
			{chip(r.imdbUrl, imdbLogo, "IMDb", r.imdb ?? "–", "bg-imdb text-black")}
			{chip(
				r.mcUrl,
				metacriticLogoIcon,
				"Metacritic",
				pair(r.mc == null ? null : String(r.mc), r.mcUser),
				"bg-metacritic text-white",
				`Metacritic: critics ${r.mc ?? "–"}, audience ${r.mcUser ?? "–"}`,
			)}
			{chip(
				r.rtUrl,
				rottenLogoIcon,
				"Rotten Tomatoes",
				pair(r.rt == null ? null : `${r.rt}%`, r.rtAudience == null ? null : `${r.rtAudience}%`),
				"bg-rotten text-white",
				`Rotten Tomatoes: critics ${r.rt ?? "–"}%, audience ${r.rtAudience ?? "–"}%`,
			)}
		</div>
	)
}

// My score with the existing ScoreSelector in a popover (desktop) or drawer (mobile).
export function MyScore({ media, compact = false }: { media: Media; compact?: boolean }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const score = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	useClickOutside(ref, () => setOpen(false))
	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				className={`inline-flex items-center gap-1.5 rounded-md cursor-pointer font-semibold text-sm ${
					score ? `bg-vibe-${score * 10}/35 text-vibe-${score * 10}` : "bg-white/8 text-gray-200 hover:bg-white/15"
				} ${compact ? "h-7 px-2" : "h-9 px-3"}`}
			>
				<StarIcon className="h-4 w-4 text-yellow-400" />
				{score ? `${score} · ${scoreLabels[score]}` : "Rate"}
			</button>
			{open && (
				<div className="hidden md:block absolute z-50 top-full mt-2 right-0 w-[34rem] rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
					<ScoreSelector media={media} onCancel={() => setOpen(false)} />
				</div>
			)}
			<div className="md:hidden">
				<Drawer open={open} onClose={() => setOpen(false)}>
					<ScoreSelector media={media} onCancel={() => setOpen(false)} />
				</Drawer>
			</div>
		</div>
	)
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
		}
		document.addEventListener("mousedown", handler)
		return () => document.removeEventListener("mousedown", handler)
	})
}

// --- Actions ---

type ActionStyle = "pill" | "icon" | "block" | "glass" | "compact"

const ACTIONS = {
	want: { Icon: BookmarkIcon, short: "Want", on: "Want to See", off: "Want to See", active: "bg-amber-500 text-black", ring: "text-amber-300" },
	seen: { Icon: EyeIcon, short: "Seen", on: "Seen", off: "Mark as Seen", active: "bg-green-500 text-black", ring: "text-green-300" },
	skip: { Icon: ForwardIcon, short: "Skip", on: "Skipped", off: "Skip", active: "bg-pink-500 text-black", ring: "text-pink-300" },
} as const

function ActionInner({ kind, active, look: variant, ...rest }: { kind: keyof typeof ACTIONS; active: boolean; look: ActionStyle } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
	const a = ACTIONS[kind]
	const label = active ? a.on : a.off
	const base = "inline-flex items-center justify-center gap-2 font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
	const cls = {
		pill: `h-9 px-3.5 rounded-full text-sm ${active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"}`,
		icon: `h-9 w-9 rounded-full ${active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"}`,
		block: `h-11 w-full px-2 sm:px-4 rounded-lg text-xs sm:text-sm ${active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"}`,
			compact: `h-14 flex-1 min-w-0 flex-col !gap-1 rounded-lg px-1 text-xs ${active ? a.active : "bg-white/8 text-gray-100 hover:bg-white/15"}`,
		glass: `w-full flex-col gap-0.5 py-2 rounded-md text-[11px] leading-none ${active ? a.active : "bg-black/60 backdrop-blur-md text-white hover:bg-black/80"}`,
	}[variant]
	return (
		<button type="button" aria-pressed={active} aria-label={variant === "icon" ? label : undefined} title={label} className={`${base} ${cls}`} {...rest}>
			<a.Icon className={`h-4 w-4 ${active ? "" : a.ring}`} />
			{variant === "compact" ? (
				<span className="truncate">{active ? a.on : a.short}</span>
			) : variant === "block" ? (
				<>
					<span className="sm:hidden">{active ? a.on : a.short}</span>
					<span className="hidden sm:inline truncate">{label}</span>
				</>
			) : (
				variant !== "icon" && <span className="truncate">{label}</span>
			)}
		</button>
	)
}

export function Actions({ media, style, withSkip = true, className = "" }: { media: Media; style: ActionStyle; withSkip?: boolean; className?: string }) {
	const { mediaType, details } = media
	const want = useIsOnWishlist(mediaType, details.tmdb_id)
	const seen = useIsWatched(mediaType, details.tmdb_id)
	const skipped = useIsSkipped(mediaType, details.tmdb_id)
	return (
		<div className={`flex items-center gap-2 ${style === "block" || style === "glass" || style === "compact" ? "[&>*]:flex-1 [&>*]:min-w-0" : ""} ${className}`}>
			<ToWatchAction media={media}>
				<ActionInner kind="want" active={!!want} look={style} />
			</ToWatchAction>
			<WatchHistoryAction media={media}>
				<ActionInner kind="seen" active={!!seen} look={style} />
			</WatchHistoryAction>
			{withSkip && (
				<SkippedAction media={media}>
					<ActionInner kind="skip" active={!!skipped} look={style} />
				</SkippedAction>
			)}
		</div>
	)
}

// --- Streaming ---

export function useStreamingLinks(media: Media, country: string, types: StreamingType[]) {
	const { details, mediaType, streaming_availabilities = [], streaming_services = [] } = media
	const owned = useUserStreamingProviders().flatMap((p) => (p.id in duplicateProviderMapping ? [p.id, ...duplicateProviderMapping[p.id]] : [p.id]))
	const seen = new Set<string>()
	return streaming_availabilities
		.filter((l) => types.includes(l.streaming_type) && !ignoredProviders.includes(l.streaming_service_id))
		.map((l) => {
			const s = streaming_services.find((x) => x.tmdb_id === l.streaming_service_id)
			return {
				id: l.streaming_service_id,
				name: s ? brandName(getShorterProviderLabel(s.name)) : "",
				logo: s ? `https://www.themoviedb.org/t/p/original/${s.logo}` : "",
				url: getStreamingUrl(l, details as never, country, mediaType),
				type: l.streaming_type,
				owned: owned.includes(l.streaming_service_id),
				order: s?.order_default ?? 999,
			}
		})
		.filter((l) => l.name)
		.sort((a, b) => Number(b.owned) - Number(a.owned) || a.order - b.order)
		// JustWatch lists add-on channels and plan tiers separately; keep one per brand.
		.filter((l) => (seen.has(l.name) ? false : (seen.add(l.name), true)))
}

const brandName = (name: string) =>
	name
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Roku Premium Channel|Channel)$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")
		.replace(/\s+Plus$/i, "+")
		.replace(/^MGM Plus$/i, "MGM+")

const TYPE_LABEL: Record<string, string> = { flatrate: "Stream", rent: "Rent", buy: "Buy", free: "Free", ads: "Free with ads" }

// Logos with a type switch and a country picker behind a settings button.
// `layout`: logos (row of icons), named (icon + name), list (rows).
export function Streaming({
	media,
	country,
	navigateToSection,
	layout = "logos",
	max = 6,
	logoSize = 40,
	showTitle = true,
}: {
	media: Media
	country: string
	navigateToSection: (s: Section) => void
	layout?: "logos" | "named" | "list"
	max?: number
	logoSize?: number
	showTitle?: boolean
}) {
	const [type, setType] = useState<"flatrate" | "rent" | "buy">("flatrate")
	const [settings, setSettings] = useState(false)
	const [all, setAll] = useState(false)
	const links = useStreamingLinks(media, country, type === "flatrate" ? ["flatrate", "flatrate_and_buy", "free", "ads"] : [type])
	const shown = all ? links : links.slice(0, max)
	const flag = country ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg` : null

	return (
		<div id="streaming" className="min-w-0">
			<div className="flex items-center gap-2">
				{showTitle && <h2 className="text-sm font-semibold text-gray-200">Where to watch</h2>}
				<div role="tablist" aria-label="Offer type" className="flex rounded-full bg-white/8 p-0.5 text-xs">
					{(["flatrate", "rent", "buy"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={type === t}
							onClick={() => setType(t)}
							className={`px-2.5 py-1 rounded-full cursor-pointer ${type === t ? "bg-white text-black font-semibold" : "text-gray-300 hover:text-white"}`}
						>
							{TYPE_LABEL[t]}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => setSettings(!settings)}
					aria-expanded={settings}
					aria-label="Change country"
					className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-gray-300 hover:bg-white/10 cursor-pointer"
				>
					{flag && <img src={flag} alt="" className="h-2.5 rounded-[1px]" />}
					{country || "Country"}
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
				</button>
			</div>
			{settings && (
				<div className="mt-2 rounded-lg bg-black/40 p-2">
					<CountrySelector
						mediaType={media.mediaType}
						countryCodes={media.details.streaming_country_codes}
						currentCountryCode={country}
						navigateToSection={navigateToSection}
					/>
				</div>
			)}
			<div className={`mt-2 ${layout === "list" ? "flex flex-col gap-1" : "flex flex-wrap items-center gap-2"}`}>
				{shown.length === 0 && (
					<p className="text-sm text-gray-400">
						No {TYPE_LABEL[type].toLowerCase()} option in {country || "your country"} yet.
					</p>
				)}
				{shown.map((l) =>
					layout === "list" ? (
						<a
							key={l.id}
							href={l.url}
							target="_blank"
							rel="noreferrer"
							className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/8"
						>
							<img src={l.logo} alt="" className="h-8 w-8 rounded-md" />
							<span className="text-sm font-medium">{l.name}</span>
							{l.owned && <span className="text-xs text-green-400">Your service</span>}
							<span className="ml-auto text-xs text-gray-400">{TYPE_LABEL[l.type] ?? "Stream"}</span>
						</a>
					) : (
						<a
							key={l.id}
							href={l.url}
							target="_blank"
							rel="noreferrer"
							title={`${TYPE_LABEL[l.type] ?? "Watch"} on ${l.name}`}
							className={`flex items-center gap-2 rounded-lg ${layout === "named" ? "bg-white/8 hover:bg-white/15 pr-3" : "hover:brightness-125"} ${l.owned ? "ring-2 ring-green-500/70" : ""}`}
						>
							<img src={l.logo} alt={layout === "named" ? "" : l.name} className="rounded-lg" style={{ width: logoSize, height: logoSize }} />
							{layout === "named" && <span className="text-sm font-medium whitespace-nowrap">{l.name}</span>}
						</a>
					),
				)}
				{!all && links.length > max && (
					<button type="button" onClick={() => setAll(true)} className="text-xs text-gray-300 hover:text-white px-1 cursor-pointer">
						+{links.length - max} more
					</button>
				)}
			</div>
		</div>
	)
}

// --- Trailer ---

export function TrailerButton({ media, style = "pill" }: { media: Media; style?: "pill" | "center" | "chip" }) {
	const [open, setOpen] = useState(false)
	const key = media.videos?.trailers?.[0]?.key
	if (!key) return null
	const cls = {
		pill: "h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-sm",
		center: "h-14 pl-4 pr-6 rounded-full bg-black/55 backdrop-blur-md hover:bg-black/75 text-lg border border-white/15",
		chip: "h-8 px-2.5 rounded-md bg-black/60 backdrop-blur-md hover:bg-black/80 text-xs",
	}[style]
	return (
		<>
			<button type="button" onClick={() => setOpen(true)} className={`inline-flex items-center gap-2 font-semibold cursor-pointer ${cls}`}>
				<PlayIcon className={style === "center" ? "h-7 w-7" : "h-4 w-4"} />
				Trailer
			</button>
			<Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
				<div className="fixed inset-0 bg-black/80" aria-hidden="true" />
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="relative w-full max-w-5xl aspect-video">
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close trailer"
							className="absolute -top-11 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
						>
							<XMarkIcon className="h-5 w-5" />
						</button>
						<ReactPlayer url={`https://www.youtube.com/watch?v=${key}`} width="100%" height="100%" controls config={{ playerVars: { autoplay: 1 } }} />
					</DialogPanel>
				</div>
			</Dialog>
		</>
	)
}

export const backdropUrl = (media: Media, size = "w1920_and_h800_multi_faces") =>
	`https://www.themoviedb.org/t/p/${size}/${media.details.backdrop_path}`
export const posterUrl = (media: Media) => `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${media.details.poster_path}`

// --- Round 4: fixed-height pieces for the info panel ---

// A clearly clickable Rate button. Shows your score once you rated.
export function RateButton({ media, look = "solid", className = "" }: { media: Media; look?: "solid" | "outline" | "icon"; className?: string }) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const score = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	useClickOutside(ref, () => setOpen(false))
	const cls = score
		? `bg-vibe-${score * 10} text-white`
		: look === "solid"
			? "bg-yellow-400 text-black hover:bg-yellow-300"
			: look === "icon"
				? "border border-yellow-400/70 text-yellow-300 hover:bg-yellow-400/10"
			: "border-2 border-yellow-400 text-yellow-300 hover:bg-yellow-400/10"
	return (
		<div ref={ref} className={`relative ${className}`}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-haspopup="dialog"
				aria-label={look === "icon" ? (score ? `Your score: ${score}` : "Rate this") : undefined}
				className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
					look === "icon" ? "h-14 w-full flex-col !gap-1 px-1 text-xs" : "h-11 w-full px-4 text-base shadow-lg shadow-black/30"
				} ${cls}`}
			>
				<StarIcon className="h-5 w-5" />
				{look === "icon" ? (score ? String(score) : "Rate") : score ? `Your score: ${score}` : "Rate this"}
			</button>
			{open && (
				<div
					role="dialog"
					aria-label={`Rate ${media.details.title}`}
					className="hidden md:block absolute z-50 top-full right-0 mt-3 w-[26rem] rounded-2xl border border-white/10 bg-stone-900 p-5 shadow-2xl shadow-black/70"
				>
					<span aria-hidden="true" className="absolute -top-1.5 right-8 h-3 w-3 rotate-45 border-l border-t border-white/10 bg-stone-900" />
					<ScorePicker media={media} onDone={() => setOpen(false)} />
				</div>
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

// Ten bars that grow with the score, in the score colors. Hover previews the
// label; clicking saves through the existing ScoreAction.
function ScorePicker({ media, onDone }: { media: Media; onDone: () => void }) {
	const current = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	const [hover, setHover] = useState<number | null>(null)
	const shown = hover ?? current
	return (
		<div>
			<div className="flex items-baseline justify-between gap-4">
				<h3 className="text-sm font-semibold text-gray-300">Your score for {media.details.title}</h3>
				{current && (
					<ScoreAction media={media} score={null} onChange={onDone}>
						<button type="button" className="text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white cursor-pointer">
							Clear
						</button>
					</ScoreAction>
				)}
			</div>
			<p className="mt-2 flex h-9 items-baseline gap-2">
				{shown ? (
					<>
						<span className="text-3xl font-bold tabular-nums" style={{ color: `var(--color-vibe-${shown * 10})` }}>
							{shown}
						</span>
						<span className="text-lg font-semibold text-white">{scoreLabels[shown]}</span>
					</>
				) : (
					<span className="text-lg text-gray-400">Pick a score from 1 to 10</span>
				)}
			</p>
			<div className="mt-4 flex h-24 items-end gap-1.5" onPointerLeave={() => setHover(null)}>
				{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
					const lit = shown != null && n <= shown
					return (
						<ScoreAction key={n} media={media} score={n as never} onChange={onDone}>
							<button
								type="button"
								aria-label={`${n}, ${scoreLabels[n]}`}
								aria-pressed={current === n}
								onPointerEnter={() => setHover(n)}
								onFocus={() => setHover(n)}
								className="flex h-full flex-1 cursor-pointer items-end rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
							>
								<span
									className="block w-full rounded-md transition-[height,background-color] duration-150 motion-reduce:transition-none"
									style={{
										height: `${28 + n * 7.2}%`,
										background: lit ? `var(--color-vibe-${n * 10})` : "rgba(255,255,255,.1)",
									}}
								/>
							</button>
						</ScoreAction>
					)
				})}
			</div>
			<div className="mt-1.5 flex justify-between text-[11px] text-gray-500">
				<span>1 Unwatchable</span>
				<span>10 Masterpiece</span>
			</div>
		</div>
	)
}

// Where to watch as one row of named chips. The row never wraps, so switching
// Stream / Rent / Buy or picking a country can't change the panel height.
export function StreamingChips({
	media,
	country,
	navigateToSection,
	max = 3,
	title = "Where to watch",
}: {
	media: Media
	country: string
	navigateToSection: (s: Section) => void
	max?: number
	title?: string
}) {
	const [type, setType] = useState<"flatrate" | "rent" | "buy">("flatrate")
	const [popover, setPopover] = useState<"none" | "country" | "all">("none")
	const ref = useRef<HTMLDivElement>(null)
	useClickOutside(ref, () => setPopover("none"))
	const links = useStreamingLinks(media, country, type === "flatrate" ? ["flatrate", "flatrate_and_buy", "free", "ads"] : [type])
	const shown = links.slice(0, max)
	const flag = country ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg` : null
	const chip = (l: (typeof links)[number]) => (
		<a
			key={l.id}
			href={l.url}
			target="_blank"
			rel="noreferrer"
			title={`${TYPE_LABEL[l.type] ?? "Watch"} on ${l.name}`}
			className={`flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/10 pl-1 pr-3.5 hover:bg-white/20 ${l.owned ? "ring-2 ring-green-500/70" : ""}`}
		>
			<img src={l.logo} alt="" className="h-8 w-8 rounded-full" />
			<span className="text-sm font-medium whitespace-nowrap">{l.name}</span>
		</a>
	)

	return (
		<div id="streaming" ref={ref} className="relative min-w-0">
			<div className="flex items-center gap-2">
				{title && <h2 className="text-sm font-semibold text-gray-200">{title}</h2>}
				<div role="tablist" aria-label="Offer type" className="flex rounded-full bg-white/8 p-0.5 text-xs">
					{(["flatrate", "rent", "buy"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={type === t}
							onClick={() => setType(t)}
							className={`px-2.5 py-1 rounded-full cursor-pointer ${type === t ? "bg-white text-black font-semibold" : "text-gray-300 hover:text-white"}`}
						>
							{TYPE_LABEL[t]}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => setPopover(popover === "country" ? "none" : "country")}
					aria-expanded={popover === "country"}
					aria-label="Change country"
					className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-gray-300 hover:bg-white/10 cursor-pointer"
				>
					{flag && <img src={flag} alt="" className="h-2.5 rounded-[1px]" />}
					{country || "Country"}
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
				</button>
			</div>
			<div className="mt-2 flex h-10 items-center gap-2 overflow-hidden">
				{shown.length === 0 && (
					<p className="text-sm text-gray-400">
						No {TYPE_LABEL[type].toLowerCase()} option in {country || "your country"} yet.
					</p>
				)}
				{shown.map(chip)}
				{links.length > max && (
					<button
						type="button"
						onClick={() => setPopover(popover === "all" ? "none" : "all")}
						aria-expanded={popover === "all"}
						className="flex h-10 shrink-0 items-center rounded-full bg-white/10 px-3.5 text-sm font-medium hover:bg-white/20 cursor-pointer"
					>
						+{links.length - max}
					</button>
				)}
			</div>
			{popover !== "none" && (
				<div className="absolute z-40 top-full mt-2 left-0 right-0 max-w-md rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
					{popover === "country" ? (
						<CountrySelector
							mediaType={media.mediaType}
							countryCodes={media.details.streaming_country_codes}
							currentCountryCode={country}
							navigateToSection={navigateToSection}
						/>
					) : (
						<div className="flex flex-wrap gap-2">{links.map(chip)}</div>
					)}
				</div>
			)}
		</div>
	)
}

// --- Round 5: rectangular streaming tiles in a fixed number of rows ---

// The prototype-only `?owned=1` switch marks the first service as yours so
// the badge can be judged without saved services.

export function StreamingTiles({
	media,
	country,
	navigateToSection,
	rows = 2,
	named = false,
	title = "Where to watch",
}: {
	media: Media
	country: string
	navigateToSection: (s: Section) => void
	rows?: number
	named?: boolean
	title?: string
}) {
	const [type, setType] = useState<"flatrate" | "rent" | "buy">("flatrate")
	const [popover, setPopover] = useState<"none" | "country" | "all">("none")
	const ref = useRef<HTMLDivElement>(null)
	const gridRef = useRef<HTMLDivElement>(null)
	useClickOutside(ref, () => setPopover("none"))
	const demoOwned = new URLSearchParams(useLocation().search).get("owned") === "1"
	const raw = useStreamingLinks(media, country, type === "flatrate" ? ["flatrate", "flatrate_and_buy", "free", "ads"] : [type])
	const links = demoOwned ? raw.map((l, i) => (i === 0 ? { ...l, owned: true } : l)) : raw
	const anyOwned = links.some((l) => l.owned)

	const tileW = named ? 152 : 48
	const tileH = 48
	const gap = 8
	const [cols, setCols] = useState(named ? 3 : 9)
	useEffect(() => {
		const el = gridRef.current
		if (!el) return
		const measure = () => setCols(Math.max(1, Math.floor((el.clientWidth + gap) / (tileW + gap))))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [tileW])
	const capacity = cols * rows
	const overflow = links.length > capacity
	const shown = overflow ? links.slice(0, capacity - 1) : links
	const flag = country ? `https://purecatamphetamine.github.io/country-flag-icons/3x2/${country}.svg` : null

	const tile = (l: (typeof links)[number]) => (
		<a
			key={l.id}
			href={l.url}
			target="_blank"
			rel="noreferrer"
			title={l.owned ? `${l.name}: one of your services` : `${TYPE_LABEL[l.type] ?? "Watch"} on ${l.name}`}
			className={`relative flex shrink-0 items-center gap-2 rounded-lg border-2 hover:brightness-125 ${
				l.owned ? "border-green-500" : "border-white/15"
			} ${named ? "w-[152px] bg-white/8 pr-2" : "bg-white/10"}`}
			style={{ height: tileH }}
		>
			<img src={l.logo} alt={named ? "" : l.name} className="h-full aspect-square rounded-md" />
			{named && <span className="truncate text-sm font-medium">{l.name}</span>}
			{l.owned && (
				<span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
					<CheckIcon className="h-3 w-3" />
				</span>
			)}
		</a>
	)

	return (
		<div id="streaming" ref={ref} className="relative min-w-0">
			<div className="flex items-center gap-2">
				{title && <h2 className="whitespace-nowrap text-sm font-semibold text-gray-200 max-[430px]:sr-only">{title}</h2>}
				<div role="tablist" aria-label="Offer type" className="flex rounded-full bg-white/8 p-0.5 text-xs">
					{(["flatrate", "rent", "buy"] as const).map((t) => (
						<button
							key={t}
							type="button"
							role="tab"
							aria-selected={type === t}
							onClick={() => setType(t)}
							className={`px-2.5 py-1 rounded-full cursor-pointer ${type === t ? "bg-white text-black font-semibold" : "text-gray-300 hover:text-white"}`}
						>
							{TYPE_LABEL[t]}
						</button>
					))}
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-3 text-xs">
					{anyOwned ? (
						<span className="inline-flex items-center gap-1 text-green-300">
							<span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-black">
								<CheckIcon className="h-2.5 w-2.5" />
							</span>
							Your services
						</span>
					) : (
						<RemixLink to="/settings/streaming" className="hidden md:inline text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white">
							Set your services
						</RemixLink>
					)}
					<div className="relative">
						<button
							type="button"
							onClick={() => setPopover(popover === "country" ? "none" : "country")}
							aria-expanded={popover === "country"}
							aria-label="Change country"
							className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-gray-300 hover:bg-white/10 cursor-pointer"
						>
							{flag && <img src={flag} alt="" className="h-2.5 rounded-[1px]" />}
							{country || "Country"}
							<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
						</button>
						{popover === "country" && (
							<div className="absolute z-40 top-full right-0 mt-2 w-72 rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl">
								<h3 className="mb-2 text-xs font-semibold text-gray-400">Show services in</h3>
								<CountrySelector
									mediaType={media.mediaType}
									countryCodes={media.details.streaming_country_codes}
									currentCountryCode={country}
									navigateToSection={navigateToSection}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
			<div
				ref={gridRef}
				className="mt-2.5 flex flex-wrap content-start overflow-hidden"
				style={{ gap, height: rows * tileH + (rows - 1) * gap + 4, paddingTop: 4, paddingRight: 4 }}
			>
				{shown.length === 0 && (
					<p className="text-sm text-gray-400">
						No {TYPE_LABEL[type].toLowerCase()} option in {country || "your country"} yet.
					</p>
				)}
				{shown.map(tile)}
				{overflow && (
					<button
						type="button"
						onClick={() => setPopover(popover === "all" ? "none" : "all")}
						aria-expanded={popover === "all"}
						aria-label={`Show all ${links.length} services`}
						className="flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-sm font-semibold text-gray-200 hover:border-white/60 cursor-pointer"
						style={{ height: tileH, width: named ? tileW : tileH }}
					>
						+{links.length - shown.length}
					</button>
				)}
			</div>
			{popover === "all" && (
				<div className="absolute z-40 bottom-0 left-0 right-0 max-w-2xl translate-y-[calc(100%+0.5rem)] rounded-xl border border-white/10 bg-stone-900/95 p-3 shadow-2xl backdrop-blur-xl">
					<div className="flex flex-wrap gap-2 pt-1">{links.map(tile)}</div>
				</div>
			)}
		</div>
	)
}

// High-contrast trailer button that reads on dark and light images alike.
export function TrailerSolid({ media, size = "md", className = "" }: { media: Media; size?: "md" | "lg"; className?: string }) {
	const [open, setOpen] = useState(false)
	const key = media.videos?.trailers?.[0]?.key
	if (!key) return null
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`inline-flex items-center justify-center gap-2 rounded-full bg-white font-bold text-black shadow-[0_0_0_1px_rgba(0,0,0,.4),0_8px_24px_rgba(0,0,0,.6)] hover:bg-amber-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
					size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm"
				} ${className}`}
			>
				<span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
					<PlayIcon className="h-3.5 w-3.5 translate-x-px" />
				</span>
				Play trailer
			</button>
			<Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
				<div className="fixed inset-0 bg-black/80" aria-hidden="true" />
				<div className="fixed inset-0 flex items-center justify-center p-4">
					<DialogPanel className="relative w-full max-w-5xl aspect-video">
						<button
							type="button"
							onClick={() => setOpen(false)}
							aria-label="Close trailer"
							className="absolute -top-11 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
						>
							<XMarkIcon className="h-5 w-5" />
						</button>
						<ReactPlayer url={`https://www.youtube.com/watch?v=${key}`} width="100%" height="100%" controls config={{ playerVars: { autoplay: 1 } }} />
					</DialogPanel>
				</div>
			</Dialog>
		</>
	)
}

// --- Round 6: the whole poster plays the trailer ---

export function TrailerDialog({ media, open, onClose }: { media: Media; open: boolean; onClose: () => void }) {
	const key = media.videos?.trailers?.[0]?.key
	if (!key) return null
	return (
		<Dialog open={open} onClose={onClose} className="relative z-50">
			<div className="fixed inset-0 bg-black/80" aria-hidden="true" />
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="relative w-full max-w-5xl aspect-video">
					<button
						type="button"
						onClick={onClose}
						aria-label="Close trailer"
						className="absolute -top-11 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 cursor-pointer"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
					<ReactPlayer url={`https://www.youtube.com/watch?v=${key}`} width="100%" height="100%" controls config={{ playerVars: { autoplay: 1 } }} />
				</DialogPanel>
			</div>
		</Dialog>
	)
}

// Poster as one big trailer button. Without a trailer it is a plain image.
export function PosterTrailer({ media, className = "", compact = false }: { media: Media; className?: string; compact?: boolean }) {
	const [open, setOpen] = useState(false)
	const hasTrailer = !!media.videos?.trailers?.[0]?.key
	const img = (
		<img
			src={posterUrl(media)}
			alt={`Poster for ${media.details.title}`}
			className="h-full w-full rounded-xl object-cover bg-white/5"
			draggable={false}
		/>
	)
	if (!hasTrailer) return <div className={`relative ${className}`}>{img}</div>
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={`Play trailer for ${media.details.title}`}
				className={`group relative block overflow-hidden rounded-xl shadow-2xl shadow-black/60 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${className}`}
			>
				{img}
				<span aria-hidden="true" className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/35 motion-reduce:transition-none" />
				{compact ? (
					<span
						aria-hidden="true"
						className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-red-600 shadow-[0_0_0_1px_rgba(0,0,0,.4),0_6px_16px_rgba(0,0,0,.6)]"
					>
						<PlayIcon className="h-5 w-5 translate-x-px" />
					</span>
				) : (
				<span
					aria-hidden="true"
					className="absolute left-1/2 top-1/2 inline-flex h-12 -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-5 font-bold text-black shadow-[0_0_0_1px_rgba(0,0,0,.4),0_8px_24px_rgba(0,0,0,.6)] transition-transform group-hover:scale-105 motion-reduce:transition-none"
				>
					<span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
						<PlayIcon className="h-3.5 w-3.5 translate-x-px" />
					</span>
					Play trailer
				</span>
				)}
			</button>
			<TrailerDialog media={media} open={open} onClose={() => setOpen(false)} />
		</>
	)
}
