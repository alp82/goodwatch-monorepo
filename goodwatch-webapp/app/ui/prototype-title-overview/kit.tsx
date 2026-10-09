// PROTOTYPE - throwaway. The small parts the four variants of /prototype/title-overview share: the ring, the site
// marks, the score picker and the surfaces it opens in, the status pill with its menu, the action buttons, the
// streaming tiles, the poster. Layout is each variant's own (variants.tsx).
import { ArrowDownIcon, BookmarkIcon, CheckIcon, ChevronDownIcon, EyeIcon, NoSymbolIcon, PlayIcon, StarIcon, TableCellsIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogoIcon from "~/img/rotten-logo-icon-64.webp"
import type { Score } from "~/server/scores.server"
import { RATING_LEVELS, levelOf } from "~/ui/taste-quiz/quiz-flow"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { type Action, type Api, type MenuEntry, type Offer, PROVIDERS, type Provider, type ProviderKey, STATUS_LOOK, type Status, type Title, type Tracking, img } from "./model"

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
export const EYEBROW = "text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400"

/** The colour of a 1-10 score, the word for it, and the text colour that reads on it. */
export const tone = (score: number) => getVibeColorValue(score as Score)
export const word = (score: number) => scoreLabels[score]
export const ink = (score: number) => (score <= 3 ? "#fff" : "#0a0a0a")
/** The same for the GoodWatch score, 0 to 100. */
export const gwTone = (gw: number) => `var(--color-vibe-${Math.min(100, Math.floor(gw / 10) * 10)})`
export const gwWord = (gw: number) => scoreLabels[Math.max(1, Math.round(gw / 10))]

/** The same thing at two sizes: `phone` below md, `wide` from md up. */
export function Sized({ phone, wide, children }: { phone: number; wide: number; children: (size: number) => ReactNode }) {
	return (
		<>
			<span className="contents md:hidden">{children(phone)}</span>
			<span className="hidden md:contents">{children(wide)}</span>
		</>
	)
}

/**
 * Keeps a popover that hangs under its anchor on the screen: it is pushed left or right until both edges are inside,
 * and scrolled into view. A sheet or a dialog (fixed to the screen) is left alone.
 */
export function useFit(open: boolean) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = ref.current
		if (!open || !el) return
		const fit = () => {
			el.style.marginLeft = ""
			if (getComputedStyle(el).position === "fixed") return
			const pad = 12
			const screen = document.documentElement.clientWidth
			const r = el.getBoundingClientRect()
			let by = 0
			if (r.right > screen - pad) by = screen - pad - r.right
			if (r.left + by < pad) by = pad - r.left
			if (by) el.style.marginLeft = `${by}px`
		}
		fit()
		// At once: the site scrolls smoothly, and a menu that is still on its way can't be pressed.
		el.scrollIntoView({ block: "nearest", behavior: "instant" })
		window.addEventListener("resize", fit)
		return () => window.removeEventListener("resize", fit)
	}, [open])
	return ref
}

// ---------------------------------------------------------------------------------------------------------
// Ring
// ---------------------------------------------------------------------------------------------------------

export function Ring({ size, fraction, color, dashed = false, children }: { size: number; fraction: number; color: string; dashed?: boolean; children: ReactNode }) {
	const stroke = size / 11
	const r = (size - stroke) / 2
	const c = 2 * Math.PI * r
	return (
		<span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={dashed ? color : "rgba(255,255,255,.12)"} strokeOpacity={dashed ? 0.7 : 1} strokeWidth={dashed ? 2 : stroke} strokeDasharray={dashed ? "4 6" : undefined} />
				{fraction > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${fraction * c} ${c}`} />}
			</svg>
			<span className="relative font-bold leading-none tabular-nums" style={{ fontSize: size * 0.36 }}>
				{children}
			</span>
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The three sites
// ---------------------------------------------------------------------------------------------------------

export type SiteId = "imdb" | "mc" | "rt"
export const SITES: Record<SiteId, { name: string; short: string; logo: string; chip: string; h: string }> = {
	imdb: { name: "IMDb", short: "IMDb", logo: imdbLogo, chip: "bg-imdb text-black", h: "h-2.5" },
	mc: { name: "Metacritic", short: "Metacritic", logo: metacriticLogoIcon, chip: "bg-metacritic text-white ring-1 ring-white/15", h: "h-3.5" },
	rt: { name: "Rotten Tomatoes", short: "Rotten T.", logo: rottenLogoIcon, chip: "bg-rotten text-white", h: "h-3.5" },
}

/** What each site says, critics and audience apart. IMDb has an audience score only. */
export const siteScores = (t: Title): { id: SiteId; critics: string | null; audience: string | null }[] => [
	{ id: "imdb", critics: null, audience: t.imdb },
	{ id: "mc", critics: t.mcCritics, audience: t.mcAudience },
	{ id: "rt", critics: t.rtCritics, audience: t.rtAudience },
]

/** A site's logo on its brand colour. */
export function SiteMark({ id, className = "" }: { id: SiteId; className?: string }) {
	const s = SITES[id]
	return (
		<span className={`inline-flex h-5 shrink-0 items-center justify-center rounded px-1 ${id === "imdb" ? "w-9" : "w-5"} ${s.chip} ${className}`}>
			<img src={s.logo} alt={s.name} className={s.h} />
		</span>
	)
}

/** A site's logo and one number on its brand colour, as the real page's chips. */
export function SiteChip({ id, value }: { id: SiteId; value: string | null }) {
	const s = SITES[id]
	return (
		<span title={s.name} className={`inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[13px] font-semibold tabular-nums ${s.chip}`}>
			<img src={s.logo} alt={s.name} className={s.h} />
			<span className={value ? "" : "opacity-50"}>{value ?? "–"}</span>
		</span>
	)
}

export function EpisodeRatingsLink({ className = "" }: { className?: string }) {
	return (
		<a href="#episodes" className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-gray-300 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white/60 ${FOCUS} ${className}`}>
			<TableCellsIcon aria-hidden="true" className="h-3.5 w-3.5 text-gray-400" />
			Episode ratings
		</a>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The score picker, and the surfaces it opens in
// ---------------------------------------------------------------------------------------------------------

const SCORES = Array.from({ length: 10 }, (_, i) => i + 1)

/**
 * The full picker: Dislike / Okay / Good / Excellent over the 1-10 strip, the word for the score under the pointer,
 * and Clear score. `even` gives the four levels the same width, for narrow boxes.
 */
export function ScorePicker({ value, kind, onRate, onClear, even = false }: { value: number | null; kind: string; onRate: (score: number) => void; onClear: () => void; even?: boolean }) {
	const [hot, setHot] = useState<number | null>(null)
	const shown = hot ?? value
	const hotLevel = hot == null ? null : levelOf(hot)
	return (
		<div data-score-picker onMouseLeave={() => setHot(null)}>
			<div className="mb-3 flex min-h-6 items-center justify-between gap-3">
				<p className="text-sm font-semibold text-gray-300">
					{shown ? (
						<>
							<span className="tabular-nums" style={{ color: tone(shown) }}>
								{shown} · {word(shown)}
							</span>
							{hot == null && <span className="font-normal text-gray-400"> is your score</span>}
						</>
					) : (
						`How was this ${kind}?`
					)}
				</p>
				{value != null && (
					<button type="button" data-clear-score onClick={onClear} className={`shrink-0 cursor-pointer rounded text-xs text-gray-400 underline decoration-white/25 underline-offset-2 hover:text-white ${FOCUS}`}>
						Clear score
					</button>
				)}
			</div>
			<div className={`grid gap-1 ${even ? "grid-cols-4" : "grid-cols-10"}`}>
				{RATING_LEVELS.map((level, i) => {
					const on = value != null && levelOf(value) === i
					const color = tone(level.score)
					return (
						<button
							key={level.name}
							type="button"
							data-level={level.name}
							aria-pressed={on}
							onClick={() => onRate(level.score)}
							onMouseEnter={() => setHot(level.score)}
							onFocus={() => setHot(level.score)}
							className={`flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-1 text-[11px] font-extrabold tracking-tight ring-2 transition sm:text-sm ${on ? "" : "bg-gray-800 hover:bg-gray-700"} ${hotLevel === i ? "ring-amber-400" : "ring-transparent"} focus-visible:outline-none`}
							style={{ gridColumn: even ? undefined : `span ${level.hi - level.lo + 1}`, ...(on ? { background: `${color}55`, boxShadow: `inset 0 0 0 2px ${color}` } : {}) }}
						>
							<span className={`h-5 w-1 shrink-0 rounded-full ${even ? "hidden" : "hidden sm:block"}`} style={{ background: color }} />
							{level.name}
						</button>
					)
				})}
			</div>
			<div className="mt-1 grid grid-cols-10 gap-1">
				{SCORES.map((score) => {
					const picked = value === score
					const on = hotLevel != null && levelOf(score) === hotLevel
					const off = hotLevel != null && !on
					return (
						<button
							key={score}
							type="button"
							data-score={score}
							aria-pressed={picked}
							aria-label={`${score}, ${word(score)}`}
							onClick={() => onRate(score)}
							onMouseEnter={() => setHot(score)}
							onFocus={() => setHot(score)}
							className={`flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-black tabular-nums transition hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-amber-400 ${picked ? "text-gray-950 ring-2 ring-white" : on ? "text-white" : off ? "text-white/35" : "text-white/80"}`}
							style={{ background: `${tone(score)}${picked || hot === score ? "" : on ? "77" : off ? "22" : "44"}` }}
						>
							{score}
						</button>
					)
				})}
			</div>
		</div>
	)
}

/**
 * Where the picker opens. On a phone always a sheet from the bottom. From md up: "popover" hangs under its anchor
 * (the nearest positioned parent), "dialog" sits in the middle of the screen over a dimmed page.
 * No ancestor may have a transform, a filter or a container type: the sheet is fixed to the screen.
 */
export function Floating({ open, onClose, title, wide = "popover", width = "md:w-[30rem]", children }: { open: boolean; onClose: () => void; title: string; wide?: "popover" | "dialog"; width?: string; children: ReactNode }) {
	const ref = useFit(open)
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, onClose])
	if (!open) return null
	const place =
		wide === "dialog"
			? "md:left-1/2 md:top-1/2 md:bottom-auto md:right-auto md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:p-5"
			: `md:absolute md:bottom-auto md:left-0 md:right-auto md:top-full md:mt-3 md:max-w-[calc(100vw-1.5rem)] md:rounded-2xl md:border md:p-4 ${width}`
	return (
		<>
			<button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className={`fixed inset-0 z-[200] cursor-default bg-black/70 ${wide === "dialog" ? "" : "md:bg-transparent"}`} />
			<div ref={ref} role="dialog" aria-label={title} data-floating className={`fixed inset-x-0 bottom-0 z-[201] rounded-t-3xl border-t border-white/15 bg-stone-900 p-4 pb-7 text-left shadow-[0_-12px_48px_rgba(0,0,0,.6)] md:shadow-2xl md:border-white/15 ${place}`}>
				<div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" aria-hidden="true" />
				<div className="mb-3 flex items-center justify-between gap-3">
					<h3 className="text-base font-bold text-white">{title}</h3>
					<button type="button" onClick={onClose} aria-label="Close" className={`-mr-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
				{children}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Status, progress, Next episode
// ---------------------------------------------------------------------------------------------------------

/** A button with a menu under it. The menu stays on the screen (useFit) and closes on a press outside or Escape. */
export function Menu({ label, entries, className = "", children }: { label: string; entries: MenuEntry[]; className?: string; children: (state: { open: boolean; toggle: () => void }) => ReactNode }) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const box = useFit(open)
	useEffect(() => {
		if (!open) return
		const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("pointerdown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [open])
	return (
		<div ref={root} className={`relative ${className}`}>
			{children({ open, toggle: () => setOpen(!open) })}
			{open && (
				<div ref={box} role="menu" aria-label={label} className="absolute left-0 top-full z-[150] mt-1 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-stone-900 p-1 shadow-2xl">
					{entries.map((entry) => (
						<button
							key={entry.id}
							type="button"
							role="menuitem"
							data-status-action={entry.id}
							onClick={() => {
								setOpen(false)
								entry.run()
							}}
							className={`block min-h-11 w-full cursor-pointer rounded-lg px-3 py-2 text-left hover:bg-white/10 ${FOCUS}`}
						>
							<span className="block text-sm font-semibold text-white">{entry.label}</span>
							{entry.note && <span className="block text-xs text-gray-400">{entry.note}</span>}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export function StatusPill({ status, tracking, api, size = "h-9" }: { status: Status; tracking: Tracking; api: Api; size?: string }) {
	if (status === "not_started") return null
	return (
		<Menu label="Change the status" entries={api.menu} className="shrink-0">
			{({ open, toggle }) => (
				<button type="button" data-status-pill aria-haspopup="menu" aria-expanded={open} onClick={toggle} className={`inline-flex ${size} cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-semibold ${STATUS_LOOK[status]} ${FOCUS}`}>
					{tracking.label}
					<ChevronDownIcon className="h-3.5 w-3.5" />
				</button>
			)}
		</Menu>
	)
}

export function ProgressBar({ percent, className = "" }: { percent: number; className?: string }) {
	return (
		<span className={`block h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`} aria-hidden="true">
			<span className="block h-full rounded-full bg-green-500 transition-[width] duration-300" style={{ width: `${percent}%` }} />
		</span>
	)
}

/** The chip that says where the line leads: down to the episode list. */
export function GoChip({ children, className = "" }: { children: ReactNode; className?: string }) {
	return (
		<span className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15 group-hover:bg-white/20 ${className}`}>
			{children}
			<ArrowDownIcon className="h-3.5 w-3.5" />
		</span>
	)
}

/** "Next episode · S3 E1 · Episode 1" as one link down to the episode list. */
export function NextLine({ tracking, className = "" }: { tracking: Tracking; className?: string }) {
	return (
		<a href="#episodes" data-next-episode className={`group flex min-w-0 items-center gap-3 rounded-lg ${FOCUS} ${className}`}>
			<span className="min-w-0 flex-1">
				<span className={`block ${EYEBROW}`}>{tracking.eyebrow}</span>
				<span className="block truncate text-sm font-semibold text-white">{tracking.line}</span>
			</span>
			<GoChip>{tracking.chip}</GoChip>
		</a>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Want to See, Seen, Drop, Not interested
// ---------------------------------------------------------------------------------------------------------

const ACTION_LOOK = {
	want: { Icon: BookmarkIcon, on: "bg-amber-500 text-black", tint: "text-amber-300" },
	seen: { Icon: EyeIcon, on: "bg-green-500 text-black", tint: "text-green-300" },
	drop: { Icon: NoSymbolIcon, on: "bg-pink-500 text-black", tint: "text-pink-300" },
	hide: { Icon: NoSymbolIcon, on: "bg-pink-500 text-black", tint: "text-pink-300" },
} as const

export function ActionButton({
	action,
	quiet = false,
	compact = false,
	phoneIcon = false,
	iconOnly = false,
	className = "",
}: { action: Action; quiet?: boolean; compact?: boolean; /** Below sm, the icon alone. */ phoneIcon?: boolean; /** The icon alone at every width; the name stays for screen readers and as the tooltip. */ iconOnly?: boolean; className?: string }) {
	const look = ACTION_LOOK[action.id]
	return (
		<button
			type="button"
			data-action={action.id}
			aria-pressed={action.active}
			disabled={action.disabled}
			title={iconOnly ? `${action.label}. ${action.hint ?? ""}` : action.hint}
			onClick={action.run}
			className={`inline-flex min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS} ${
				action.active ? look.on : quiet ? "text-gray-300 hover:bg-white/10 hover:text-white" : "bg-white/10 text-gray-100 hover:bg-white/20"
			} ${compact ? "h-9 px-2.5 text-xs" : quiet ? "h-9 px-3 text-xs" : "h-11 px-3 text-sm"} ${className}`}
		>
			<look.Icon className={`h-4 w-4 shrink-0 ${action.active ? "" : look.tint}`} />
			<span className={`truncate ${iconOnly ? "sr-only" : phoneIcon ? "max-sm:sr-only" : ""}`}>{action.label}</span>
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Where to watch
// ---------------------------------------------------------------------------------------------------------

const OFFERS: Record<Offer, string> = { stream: "Stream", rent: "Rent", buy: "Buy" }

/**
 * The streaming block: offer types, tiles, the legend. `max` is how many tiles show before "+N" (which opens the
 * rest in place); `named` puts the service's name beside its logo from md up. A title with no offer at all is one line.
 */
export function WhereToWatch({ providers, max, named = true, kind }: { providers: ProviderKey; max: { phone: number; wide: number }; named?: boolean; kind: string }) {
	const [offer, setOffer] = useState<Offer>("stream")
	const [all, setAll] = useState(false)
	const { offers } = PROVIDERS[providers]
	const list = offers[offer]
	const nothing = !offers.stream.length && !offers.rent.length && !offers.buy.length
	const country = (
		<span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs text-gray-300">
			<span aria-hidden="true" className="inline-block h-2.5 w-4 overflow-hidden rounded-[1px]" style={{ background: "linear-gradient(#000 33%, #d00 33% 66%, #fc0 66%)" }} />
			DE
		</span>
	)
	if (nothing)
		return (
			<div data-where-to-watch="none" className="flex items-center gap-3">
				<div className="min-w-0">
					<h2 className="text-sm font-semibold text-gray-200">Where to watch</h2>
					<p className="mt-0.5 text-sm text-gray-400">No service in Germany has this {kind} yet.</p>
				</div>
				{country}
			</div>
		)
	const tile = (p: Provider) => (
		<a
			key={p.name}
			href="#streaming"
			title={p.owned ? `${p.name}: one of your services` : `${OFFERS[offer]} on ${p.name}`}
			className={`relative flex h-12 shrink-0 items-center gap-2 rounded-lg border-2 bg-white/10 hover:brightness-125 ${named ? "md:w-[9.5rem] md:pr-2" : ""} ${p.owned ? "border-green-500" : "border-white/15"}`}
		>
			<img src={img("w92", p.logo)} alt={p.name} width={44} height={44} className="aspect-square h-full w-auto rounded-md" />
			{named && <span className="hidden truncate text-sm font-medium md:inline">{p.name}</span>}
			{p.owned && (
				<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
					<CheckIcon className="h-3 w-3" />
				</span>
			)}
		</a>
	)
	const more = (count: number, hide: string) =>
		count > 0 && (
			<button type="button" onClick={() => setAll(true)} aria-label={`Show all ${list.length} services`} className={`h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-white/25 text-sm font-semibold text-gray-200 hover:border-white/60 ${hide}`}>
				+{count}
			</button>
		)
	return (
		<div data-where-to-watch={providers} className="min-w-0">
			<div className="flex flex-wrap items-center gap-x-2 gap-y-2">
				<h2 className="whitespace-nowrap text-sm font-semibold text-gray-200">Where to watch</h2>
				<div role="tablist" aria-label="Offer type" className="flex rounded-full bg-white/8 p-0.5 text-xs">
					{(Object.keys(OFFERS) as Offer[]).map((o) => (
						<button
							key={o}
							type="button"
							role="tab"
							aria-selected={offer === o}
							onClick={() => {
								setOffer(o)
								setAll(false)
							}}
							className={`cursor-pointer rounded-full px-2.5 py-1 ${offer === o ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
						>
							{OFFERS[o]}
						</button>
					))}
				</div>
				{country}
			</div>
			<div className="mt-2.5 flex flex-wrap gap-2 pr-1 pt-1">
				{list.length === 0 && <p className="flex h-12 items-center text-sm text-gray-400">No {OFFERS[offer].toLowerCase()} option in Germany yet.</p>}
				{list.map((p, i) => (
					<span key={p.name} className={all ? "contents" : `${i < max.phone ? "contents" : "hidden"} ${i < max.wide ? "md:contents" : "md:hidden"}`}>
						{tile(p)}
					</span>
				))}
				{!all && more(list.length - max.phone, "flex md:hidden")}
				{!all && more(list.length - max.wide, "hidden md:flex")}
			</div>
			{list.some((p) => p.owned) && (
				<p className="mt-2 flex items-center gap-1 text-xs text-green-300">
					<span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-black">
						<CheckIcon className="h-2.5 w-2.5" />
					</span>
					On your services
				</p>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Poster, trailer, backdrop
// ---------------------------------------------------------------------------------------------------------

/** The trailer button. It always says so: "Play trailer", or "Trailer" where there is less room. */
export function TrailerPill({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
	return (
		<button
			type="button"
			data-trailer
			aria-label="Play trailer"
			className={`inline-flex cursor-pointer items-center whitespace-nowrap rounded-full bg-white font-semibold text-black shadow-xl hover:bg-gray-100 ${compact ? "h-9 gap-1.5 pl-1.5 pr-3 text-xs" : "h-11 gap-2 pl-2 pr-4 text-sm"} ${FOCUS} ${className}`}
		>
			<span className={`flex items-center justify-center rounded-full bg-red-600 text-white ${compact ? "h-6 w-6" : "h-7 w-7"}`}>
				<PlayIcon className="h-3.5 w-3.5 translate-x-px" />
			</span>
			{compact ? "Trailer" : "Play trailer"}
		</button>
	)
}

/** The poster. A press opens it full screen (PosterView); the trailer button on it, if any, stays its own press. */
export function Poster({ title, trailer = "pill", className = "" }: { title: Title; trailer?: "pill" | "dot" | "none"; className?: string }) {
	const thumb = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	return (
		<div className={`relative overflow-hidden rounded-xl bg-stone-900 ring-1 ring-white/10 ${className}`}>
			<button
				ref={thumb}
				type="button"
				data-poster
				aria-haspopup="dialog"
				aria-label={`${title.name} poster. Show it full screen`}
				onClick={() => setOpen(true)}
				className="block h-full w-full cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
				style={{ opacity: open ? 0 : 1 }}
			>
				<img src={img("w500", title.poster)} alt="" className="h-full w-full object-cover" />
			</button>
			{trailer === "pill" && <TrailerPill className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />}
			{trailer === "dot" && <TrailerPill compact className="absolute bottom-2 right-2" />}
			{open && <PosterView title={title} thumb={thumb} onClose={() => setOpen(false)} />}
		</div>
	)
}

/**
 * The poster over the whole screen. It grows out of the small poster's place and goes back into it (first-last-
 * invert-play: the big image is laid out where it ends, then moved from, or to, the small one's box with a
 * transform). With "reduce motion" it only fades. A press anywhere, Escape or the close button closes it.
 */
function PosterView({ title, thumb, onClose }: { title: Title; thumb: RefObject<HTMLButtonElement | null>; onClose: () => void }) {
	const picture = useRef<HTMLImageElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const leaving = useRef(false)
	const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
	/** The transform that puts the big picture exactly over the small one. */
	const overThumb = () => {
		const small = thumb.current?.getBoundingClientRect()
		const big = picture.current?.getBoundingClientRect()
		if (!small || !big || !big.width) return "none"
		return `translate(${small.left - big.left}px, ${small.top - big.top}px) scale(${small.width / big.width}, ${small.height / big.height})`
	}
	const close = () => {
		if (leaving.current) return
		leaving.current = true
		if (still() || !picture.current) return onClose()
		shade.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: "ease-in", fill: "forwards" })
		const back = picture.current.animate([{ transform: "none" }, { transform: overThumb() }], { duration: 260, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" })
		back.onfinish = onClose
		back.oncancel = onClose
		// A browser that drops the animation (a hidden tab, a busy page) must not leave the poster up.
		window.setTimeout(onClose, 400)
	}
	useLayoutEffect(() => {
		const moving = !still()
		shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: moving ? 320 : 150, easing: "ease-out" })
		if (moving) picture.current?.animate([{ transform: overThumb() }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" })
		else picture.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 })
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
	return createPortal(
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, and the close button is the keyboard's way.
		<div data-poster-view role="dialog" aria-modal="true" aria-label={`${title.name} poster`} onClick={close} className="fixed inset-0 z-[2000] flex cursor-zoom-out items-center justify-center p-4">
			<div ref={shade} className="absolute inset-0 bg-black/90" />
			<img
				ref={picture}
				src={img("w780", title.poster)}
				alt={`${title.name} poster`}
				className="relative aspect-[2/3] w-[min(92vw,calc(92dvh*2/3))] origin-top-left rounded-xl object-cover shadow-2xl"
				style={{ backgroundImage: `url(${img("w500", title.poster)})`, backgroundSize: "cover" }}
			/>
			<button type="button" data-poster-close aria-label="Close" onClick={close} className={`absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 ${FOCUS}`}>
				<XMarkIcon className="h-6 w-6" />
			</button>
		</div>,
		document.body,
	)
}

/** The blurred, darkened backdrop behind a panel. The panel's content sits over it with `relative`. */
export function PanelBackdrop({ title, rounded = "rounded-2xl" }: { title: Title; rounded?: string }) {
	return (
		<div className={`pointer-events-none absolute inset-0 overflow-hidden ${rounded}`} aria-hidden="true">
			<img src={img("w780", title.backdrop)} alt="" className="h-full w-full scale-110 object-cover object-[center_25%] blur-[3px]" />
			<div className="absolute inset-0 bg-black/70" />
			<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
		</div>
	)
}

/** Phones have no poster column: the backdrop as a banner with the trailer on it. */
export function PhoneBanner({ title }: { title: Title }) {
	return (
		<div className="relative h-44 overflow-hidden rounded-t-2xl md:hidden">
			<img src={img("w780", title.backdrop)} alt="" className="h-full w-full object-cover object-[center_25%]" />
			<div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80" />
			<TrailerPill className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
		</div>
	)
}

export function Divider({ className = "" }: { className?: string }) {
	return <div aria-hidden="true" className={`h-px shrink-0 bg-white/10 ${className}`} />
}

export { StarIcon }
