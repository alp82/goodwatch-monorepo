// PROTOTYPE - throwaway. Compact building blocks for the detail-page hero
// variants: score badge, rating chips, my score, actions, streaming, trailer.

import { Dialog, DialogPanel } from "@headlessui/react"
import { BookmarkIcon, StarIcon } from "@heroicons/react/20/solid"
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
				<span className="text-xs leading-tight text-gray-400">
					GoodWatch
					<br />
					score
				</span>
			)}
		</div>
	)
}

// External ratings as small linked chips. `tone` picks a dark or brand style.
export function RatingChips({ media, tone = "dark", size = "sm" }: { media: Media; tone?: "dark" | "brand"; size?: "sm" | "md" }) {
	const r = useRatings(media)
	const h = size === "md" ? "h-9" : "h-7"
	const chip = (href: string, logo: string, alt: string, value: React.ReactNode, brand: string) => (
		<a
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			className={`${h} inline-flex items-center gap-1.5 rounded-md px-2 text-sm font-semibold tabular-nums ${
				tone === "brand" ? brand : "bg-white/8 text-gray-100 hover:bg-white/15"
			} ${href ? "" : "opacity-50 pointer-events-none"}`}
		>
			<img src={logo} alt={alt} className={alt === "IMDb" ? "h-3.5" : "h-4"} />
			{value}
		</a>
	)
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			{chip(r.imdbUrl, imdbLogo, "IMDb", r.imdb ?? "–", "bg-imdb text-black")}
			{chip(r.mcUrl, metacriticLogoIcon, "Metacritic", r.mc ?? "–", "bg-metacritic text-white")}
			{chip(
				r.rtUrl,
				rottenLogoIcon,
				"Rotten Tomatoes",
				r.rt == null ? "–" : `${r.rt}%`,
				"bg-rotten text-white",
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

type ActionStyle = "pill" | "icon" | "block" | "glass"

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
			glass: `w-full flex-col gap-0.5 py-2 rounded-md text-[11px] leading-none ${active ? a.active : "bg-black/60 backdrop-blur-md text-white hover:bg-black/80"}`,
	}[variant]
	return (
		<button type="button" aria-pressed={active} aria-label={variant === "icon" ? label : undefined} title={label} className={`${base} ${cls}`} {...rest}>
			<a.Icon className={`h-4 w-4 ${active ? "" : a.ring}`} />
			{variant === "block" ? (
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
		<div className={`flex items-center gap-2 ${style === "block" || style === "glass" ? "[&>*]:flex-1 [&>*]:min-w-0" : ""} ${className}`}>
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
