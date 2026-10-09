// PROTOTYPE - throwaway. Round 2 of /prototype/title-overview: the two descendants of round 1's D (Banner) that the
// owner said have potential, G (Strip and three cards) and H (One control), kept as they were for comparison. E and
// F were rejected and are gone. Round 3 (round3.tsx) builds on G's structure and H's compactness and reuses the
// parts exported here: the banner, D's ratings bar, A's two rings, the tracking line, the compact actions.
import { ChevronDownIcon, EllipsisHorizontalIcon, PencilIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useState } from "react"
import {
	ActionButton,
	EYEBROW,
	EpisodeRatingsLink,
	FOCUS,
	Floating,
	GoChip,
	Menu,
	NextLine,
	Poster,
	ProgressBar,
	Ring,
	SITES,
	ScorePicker,
	SiteChip,
	SiteMark,
	Sized,
	StarIcon,
	StatusPill,
	TrailerPill,
	WhereToWatch,
	gwTone,
	gwWord,
	ink,
	siteScores,
	tone,
	word,
} from "./kit"
import { type Api, type Member, type Offer, PROVIDERS, type Provider, type ProviderKey, type Title, img } from "./model"
import type { VariantProps } from "./variants"

const PANEL = "relative min-w-0 rounded-2xl border border-white/10 bg-stone-950"
const BOX = "rounded-xl bg-white/[0.07] ring-1 ring-white/10"
const AMBER = "#fbbf24"

// ---------------------------------------------------------------------------------------------------------
// Banner, title
// ---------------------------------------------------------------------------------------------------------

/** The backdrop behind a banner, darkened at the bottom and the left, where the text is. Content sits over it with `relative`. */
export function BannerImage({ title, rounded }: { title: Title; rounded: string }) {
	return (
		<div className={`pointer-events-none absolute inset-0 overflow-hidden ${rounded}`} aria-hidden="true">
			<img src={img("w1280", title.backdrop)} alt="" className="h-full w-full object-cover object-[center_22%]" />
			<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
			<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
		</div>
	)
}

export function TitleBlock({ title, className = "" }: { title: Title; className?: string }) {
	return (
		<div className={`min-w-0 ${className}`}>
			<h1 className="text-2xl font-bold leading-tight tracking-tight text-white [text-shadow:0_2px_14px_rgba(0,0,0,.7)] md:text-4xl">{title.name}</h1>
			<p className="mt-1 text-xs text-gray-300 [text-shadow:0_1px_8px_rgba(0,0,0,.8)] md:text-sm">{title.facts.join(" · ")}</p>
		</div>
	)
}

/** The trailer button in a banner's top right corner: a dot on a phone, the pill from md up. */
export function BannerTrailer() {
	return (
		<>
			<div className="absolute right-3 top-3 md:hidden">
				<TrailerPill compact />
			</div>
			<div className="absolute right-5 top-4 hidden md:block">
				<TrailerPill />
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Ratings: D's bar (ring, pill, chip runs), the one-chip summary, and A's two rings
// ---------------------------------------------------------------------------------------------------------

function GoodWatch({ title, phone, wide, words = "sm" }: { title: Title; phone: number; wide: number; words?: "sm" | "always" }) {
	return (
		<div className="flex shrink-0 items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
			<Sized phone={phone} wide={wide}>
				{(size) => (
					<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
						{title.gw}
					</Ring>
				)}
			</Sized>
			<div className={`leading-tight ${words === "sm" ? "hidden sm:block" : ""}`}>
				<p className="text-base font-bold" style={{ color: gwTone(title.gw) }}>
					{gwWord(title.gw)}
				</p>
				<p className="whitespace-nowrap text-xs text-gray-300">GoodWatch score</p>
			</div>
		</div>
	)
}

/** Your score as D's pill: the number on its colour and the word. Opens the picker as a dialog (a sheet on a phone). */
function OwnPill({ title, m, api }: { title: Title; m: Member; api: Api }) {
	const [picking, setPicking] = useState(false)
	const s = m.score
	return (
		<>
			<button
				type="button"
				data-own-score={s ?? "none"}
				aria-haspopup="dialog"
				aria-expanded={picking}
				onClick={() => setPicking(true)}
				className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition hover:brightness-110 ${s ? "pl-1.5 pr-3" : "bg-amber-400 px-4 text-black"} ${FOCUS}`}
				style={s ? { background: `${tone(s)}26`, boxShadow: `inset 0 0 0 1.5px ${tone(s)}` } : undefined}
			>
				{s ? (
					<>
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums" style={{ background: tone(s), color: ink(s) }}>
							{s}
						</span>
						<span className="min-w-0 leading-tight">
							<span className={`block whitespace-nowrap ${EYEBROW}`}>Your score</span>
							<span className="block truncate text-sm font-bold text-white">{word(s)}</span>
						</span>
						<PencilIcon className="h-3.5 w-3.5 shrink-0 text-gray-300" />
					</>
				) : (
					<>
						<StarIcon className="h-5 w-5 shrink-0" />
						<span className="whitespace-nowrap text-sm font-bold">Rate this {title.kind}</span>
					</>
				)}
			</button>
			<Floating open={picking} onClose={() => setPicking(false)} title={`Your score for ${title.name}`} wide="dialog">
				<ScorePicker
					value={s}
					kind={title.kind}
					onRate={(score) => {
						api.rate(score)
						setPicking(false)
					}}
					onClear={api.clear}
				/>
			</Floating>
		</>
	)
}

/** D's ratings bar without the chips: the GoodWatch ring, a hairline, your score. */
export function ScoreBar({ title, m, api, ring = { phone: 48, wide: 56 } }: { title: Title; m: Member; api: Api; ring?: { phone: number; wide: number } }) {
	return (
		<div data-ratings className="flex min-w-0 items-center gap-3">
			<GoodWatch title={title} {...ring} />
			<span className="h-9 w-px shrink-0 bg-white/15" aria-hidden="true" />
			<OwnPill title={title} m={m} api={api} />
		</div>
	)
}

/** D's two labelled runs of site chips. */
function SourceRuns({ title, link = true, className = "" }: { title: Title; link?: boolean; className?: string }) {
	const sites = siteScores(title)
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
			<span className="flex items-center gap-1.5">
				<span className={`mr-0.5 ${EYEBROW}`}>Critics</span>
				{sites
					.filter((site) => site.id !== "imdb")
					.map((site) => (
						<SiteChip key={site.id} id={site.id} value={site.critics} />
					))}
			</span>
			<span className="flex items-center gap-1.5">
				<span className={`mr-0.5 ${EYEBROW}`}>Audience</span>
				{sites.map((site) => (
					<SiteChip key={site.id} id={site.id} value={site.audience} />
				))}
			</span>
			{link && title.kind === "show" && <EpisodeRatingsLink className="lg:ml-auto" />}
		</div>
	)
}

/** The three sites as one chip, "Critics 78% | Audience 7.8". A press opens the table (and the way to the episode ratings). */
function SourcesSummary({ title }: { title: Title }) {
	const [open, setOpen] = useState(false)
	const sites = siteScores(title)
	const critics = title.rtCritics ?? title.mcCritics
	const audience = title.imdb ?? title.rtAudience
	return (
		<div className="relative">
			<button
				type="button"
				data-sources
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className={`inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-stone-950/80 px-2.5 text-xs text-gray-300 ring-1 ring-white/15 hover:bg-stone-800 ${FOCUS}`}
			>
				<span>
					Critics <span className="font-bold tabular-nums text-white">{critics ?? "–"}</span>
				</span>
				<span className="h-3.5 w-px bg-white/20" aria-hidden="true" />
				<span>
					Audience <span className="font-bold tabular-nums text-white">{audience ?? "–"}</span>
				</span>
				<ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
			</button>
			<Floating open={open} onClose={() => setOpen(false)} title="Ratings from other sites" width="md:w-[24rem]">
				<table className="w-full text-sm">
					<thead>
						<tr className={EYEBROW}>
							<th className="pb-1.5 text-left font-semibold">From</th>
							<th className="w-20 pb-1.5 text-right font-semibold">Critics</th>
							<th className="w-20 pb-1.5 text-right font-semibold">Audience</th>
						</tr>
					</thead>
					<tbody>
						{sites.map((site) => (
							<tr key={site.id} className="border-t border-white/10">
								<td className="py-2">
									<span className="flex items-center gap-2 text-gray-200">
										<SiteMark id={site.id} />
										{SITES[site.id].name}
									</span>
								</td>
								{[site.critics, site.audience].map((value, i) => (
									<td key={i === 0 ? "critics" : "audience"} className={`text-right font-semibold tabular-nums ${value ? "text-white" : "text-gray-600"}`}>
										{value ?? "–"}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				{title.kind === "show" && (
					<p className="mt-3 border-t border-white/10 pt-3">
						<EpisodeRatingsLink />
					</p>
				)}
			</Floating>
		</div>
	)
}

/** A's two rings, small: GoodWatch and yours. Your ring opens the picker as a popover (a sheet on a phone). */
export function ScorePair({ title, m, api }: { title: Title; m: Member; api: Api }) {
	const [picking, setPicking] = useState(false)
	const s = m.score
	return (
		<div data-ratings className="flex items-center gap-4 md:gap-6">
			<div className="flex items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
				<Sized phone={52} wide={64}>
					{(size) => (
						<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
							{title.gw}
						</Ring>
					)}
				</Sized>
				<div className="leading-tight">
					<p className={EYEBROW}>GoodWatch</p>
					<p className="text-base font-bold md:text-lg" style={{ color: gwTone(title.gw) }}>
						{gwWord(title.gw)}
					</p>
				</div>
			</div>
			<div className="relative">
				<button
					type="button"
					data-own-score={s ?? "none"}
					aria-haspopup="dialog"
					aria-expanded={picking}
					onClick={() => setPicking(!picking)}
					className={`-m-1.5 flex cursor-pointer items-center gap-2.5 rounded-2xl p-1.5 text-left transition-colors hover:bg-white/10 ${FOCUS}`}
				>
					<Sized phone={52} wide={64}>
						{(size) =>
							s ? (
								<Ring size={size} fraction={s / 10} color={tone(s)}>
									{s}
								</Ring>
							) : (
								<Ring size={size} fraction={0} color={AMBER} dashed>
									<StarIcon className="h-[1em] w-[1em] text-amber-300" />
								</Ring>
							)
						}
					</Sized>
					<span className="leading-tight">
						<span className={`block whitespace-nowrap ${EYEBROW}`}>Your score</span>
						<span className="flex items-center gap-1 text-base font-bold md:text-lg" style={{ color: s ? tone(s) : AMBER }}>
							{s ? word(s) : "Rate it"}
							<ChevronDownIcon className="h-4 w-4 text-gray-400" />
						</span>
					</span>
				</button>
				<Floating open={picking} onClose={() => setPicking(false)} title="Your score">
					<ScorePicker
						value={s}
						kind={title.kind}
						onRate={(score) => {
							api.rate(score)
							setPicking(false)
						}}
						onClear={api.clear}
					/>
				</Floating>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Where to watch as a row of logos
// ---------------------------------------------------------------------------------------------------------

const OFFERS: Record<Offer, string> = { stream: "Stream", rent: "Rent", buy: "Buy" }
const FLAG = { background: "linear-gradient(#000 33%, #d00 33% 66%, #fc0 66%)" }

/**
 * Logos only, your services first with a green ring. One small control ("Stream · DE") opens the rest: the offer
 * types, every service by name, the country.
 */
function ProviderStrip({ providers, kind, max = 5, label = "Watch on" }: { providers: ProviderKey; kind: string; max?: number; label?: string }) {
	const [offer, setOffer] = useState<Offer>("stream")
	const [open, setOpen] = useState(false)
	const { offers } = PROVIDERS[providers]
	const list = offers[offer]
	const nothing = !offers.stream.length && !offers.rent.length && !offers.buy.length
	const tick = (
		<span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-[9px] font-black text-black ring-2 ring-stone-950" aria-hidden="true">
			✓
		</span>
	)
	// A phone has room for three logos beside the control.
	const PHONE = 3
	const more = (count: number, when: string) =>
		count > 0 && (
			<button type="button" onClick={() => setOpen(true)} aria-label={`Show all ${list.length} services`} className={`h-9 shrink-0 cursor-pointer rounded-lg border border-dashed border-white/25 px-2 text-xs font-semibold text-gray-200 hover:bg-white/10 ${when} ${FOCUS}`}>
				+{count}
			</button>
		)
	const logo = (p: Provider, i: number) => (
		<a key={p.name} href="#streaming" title={p.owned ? `${p.name}: one of your services` : `${OFFERS[offer]} on ${p.name}`} className={`relative block h-9 w-9 shrink-0 rounded-lg hover:brightness-125 ${i >= PHONE ? "max-sm:hidden" : ""} ${p.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/20"}`}>
			<img src={img("w92", p.logo)} alt={p.name} width={36} height={36} className="h-full w-full rounded-lg" />
			{p.owned && tick}
		</a>
	)
	return (
		<div data-providers={providers} className="relative flex min-w-0 items-center gap-2">
			<span className={`shrink-0 ${nothing || list.length <= 1 ? "" : "max-sm:hidden"} ${EYEBROW}`}>{label}</span>
			{nothing ? (
				<span className="truncate text-sm text-gray-400">No service in Germany has this {kind} yet</span>
			) : (
				<>
					{list.length === 0 && <span className="whitespace-nowrap text-xs text-gray-400">Nothing to {offer}</span>}
					{list.slice(0, max).map(logo)}
					{more(list.length - PHONE, "sm:hidden")}
					{more(list.length - max, "max-sm:hidden")}
					<button
						type="button"
						data-providers-control
						aria-haspopup="dialog"
						aria-expanded={open}
						onClick={() => setOpen(!open)}
						className={`ml-1 inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-gray-100 hover:bg-white/20 ${FOCUS}`}
					>
						{OFFERS[offer]}
						<span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[1px]" style={FLAG} />
						<ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
					</button>
					<Floating open={open} onClose={() => setOpen(false)} title="Where to watch" width="md:w-[26rem]">
						<div role="tablist" aria-label="Offer type" className="flex w-fit rounded-full bg-white/8 p-0.5 text-sm">
							{(Object.keys(OFFERS) as Offer[]).map((o) => (
								<button key={o} type="button" role="tab" aria-selected={offer === o} onClick={() => setOffer(o)} className={`cursor-pointer rounded-full px-3.5 py-1.5 ${offer === o ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}>
									{OFFERS[o]}
									<span className="ml-1.5 text-xs opacity-60">{offers[o].length}</span>
								</button>
							))}
						</div>
						<div className="mt-3 grid grid-cols-2 gap-2">
							{list.length === 0 && <p className="col-span-2 py-2 text-sm text-gray-400">No {OFFERS[offer].toLowerCase()} option in Germany yet.</p>}
							{list.map((p) => (
								<a key={p.name} href="#streaming" className={`flex h-11 items-center gap-2 rounded-lg bg-white/[0.07] pr-2 hover:bg-white/15 ${p.owned ? "ring-2 ring-green-500" : "ring-1 ring-white/10"}`}>
									<img src={img("w92", p.logo)} alt="" width={44} height={44} className="h-11 w-11 rounded-lg" />
									<span className="min-w-0 truncate text-sm font-medium text-white">{p.name}</span>
									{p.owned && <span className="ml-auto shrink-0 text-[11px] font-semibold text-green-300">Yours</span>}
								</a>
							))}
						</div>
						<p className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs text-gray-400">
							<span className="flex items-center gap-2">
								<span aria-hidden="true" className="inline-block h-2.5 w-4 rounded-[1px]" style={FLAG} />
								Services in Germany
							</span>
							<span className="underline decoration-white/25 underline-offset-2">Change country</span>
						</p>
					</Floating>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Tracking as one line, and compact actions
// ---------------------------------------------------------------------------------------------------------

/** Status pill with its menu, "16/22" with a small bar, and the Next episode as a chip that leads to the list. */
export function TrackLine({ m, api, className = "" }: { m: Member; api: Api; className?: string }) {
	const t = api.tracking
	if (!t) return null
	const next = m.status === "watching" || m.status === "on_hold"
	return (
		<div data-tracking={m.status} className={`flex min-w-0 items-center gap-2.5 ${className}`}>
			{m.status === "not_started" ? (
				<p className="min-w-0 flex-1 truncate text-sm text-gray-300">
					<span className="font-semibold text-white">{t.eyebrow}</span> <span className="max-sm:hidden">{t.line}</span>
				</p>
			) : (
				<>
					<StatusPill status={m.status} tracking={t} api={api} />
					<span className="flex shrink-0 items-center gap-2" title={`${t.count} episodes`}>
						<span className="text-xs font-semibold tabular-nums text-white">{t.short}</span>
						<ProgressBar percent={t.percent} className="w-10 sm:w-20 xl:w-32" />
					</span>
				</>
			)}
			<a href="#episodes" data-next-episode className={`group ml-auto flex min-w-0 items-center gap-2 rounded-lg ${FOCUS}`}>
				{next && (
					<>
						<span className="shrink-0 text-xs text-gray-400">
							Next<span className="max-xl:hidden"> episode</span>
						</span>
						<span className="min-w-0 truncate text-xs font-medium text-gray-200 max-xl:hidden">{t.line}</span>
					</>
				)}
				<GoChip className="!h-9 !text-xs">{t.chip}</GoChip>
			</a>
		</div>
	)
}

/** Want to See, Seen and the third action at 36px. On a phone the third is its icon alone. */
export function MiniActions({ api, className = "" }: { api: Api; className?: string }) {
	return (
		<div data-actions className={`flex min-w-0 gap-2 ${className}`}>
			{api.actions.map((action, i) => (
				<ActionButton key={action.label} action={action} compact phoneIcon={i === 2} className={i === 2 ? "sm:flex-1 lg:flex-none" : "flex-1 lg:flex-none"} />
			))}
		</div>
	)
}

// =========================================================================================================
// G - Strip and three cards
// The banner is only a strip for the poster and the title. Under it three cards of the same height side by side:
// the ratings (bar and chip runs), your show (status, progress, Next episode, actions), where to watch (named tiles).
// On a phone the cards stack and where to watch is the logo row.
// =========================================================================================================

function Card({ label, right, children, className = "" }: { label: string; right?: ReactNode; children: ReactNode; className?: string }) {
	return (
		<div className={`flex min-w-0 flex-col p-3 ${BOX} ${className}`}>
			<div className="mb-2.5 flex items-center justify-between gap-3">
				<h2 className={EYEBROW}>{label}</h2>
				{right}
			</div>
			{children}
		</div>
	)
}

export function VariantG({ title, m, api, providers }: VariantProps) {
	const t = api.tracking
	const show = title.kind === "show"
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative flex items-end gap-3 px-4 pb-3 pt-12 md:gap-5 md:px-5 md:pb-4 md:pt-10">
					<Poster title={title} trailer="none" className="aspect-[2/3] w-16 shrink-0 shadow-[0_8px_30px_rgba(0,0,0,.7)] md:w-[5.5rem]" />
					<TitleBlock title={title} className="flex-1 pb-0.5" />
				</div>
			</div>
			<div className="relative grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-3">
				<Card label="Ratings" right={show ? <EpisodeRatingsLink /> : undefined}>
					<ScoreBar title={title} m={m} api={api} />
					<SourceRuns title={title} link={false} className="mt-3 border-t border-white/10 pt-3 lg:mt-auto" />
				</Card>
				<Card label={show ? "Your show" : "Your movie"}>
					{t && m.status !== "not_started" && (
						<div className="mb-2.5 flex items-center gap-3">
							<StatusPill status={m.status} tracking={t} api={api} />
							<ProgressBar percent={t.percent} className="flex-1" />
							<p className="shrink-0 text-sm font-semibold tabular-nums text-white">{t.count}</p>
						</div>
					)}
					{t && <NextLine tracking={t} className="mb-2.5" />}
					{!t && <p className="mb-2.5 line-clamp-2 text-sm leading-relaxed text-gray-300">{title.overview}</p>}
					<div data-actions className="mt-auto flex gap-2">
						{api.actions.map((action, i) => (
							<ActionButton key={action.label} action={action} compact phoneIcon={i === 2} className={i === 2 ? "sm:flex-1" : "flex-1"} />
						))}
					</div>
				</Card>
				<div className={`min-w-0 p-3 ${BOX}`}>
					<div className="lg:hidden">
						<ProviderStrip providers={providers} kind={title.kind} max={4} />
					</div>
					<div className="hidden lg:block">
						<WhereToWatch providers={providers} max={{ phone: 4, wide: 3 }} kind={title.kind} />
					</div>
				</div>
			</div>
		</section>
	)
}

// =========================================================================================================
// H - One control
// The most folded one, and the comparison for the score display: A's two rings on the banner instead of D's bar.
// Under the banner a single row. A show you have started has no action buttons at all: the status control is the
// row, and Mark as Seen, Put on hold and Drop are in its menu. The sites are one chip, the services a row of logos.
// =========================================================================================================

export function VariantH({ title, m, api, providers }: VariantProps) {
	const started = title.kind === "show" && m.status !== "not_started"
	const [first, second, ...rest] = api.actions
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative flex items-end gap-3 px-4 pb-4 pt-12 md:gap-6 md:px-6 md:pb-5 md:pt-10">
					<Poster title={title} trailer="none" className="aspect-[2/3] w-[4.5rem] shrink-0 shadow-[0_8px_30px_rgba(0,0,0,.7)] md:w-32" />
					<div className="min-w-0 flex-1">
						<TitleBlock title={title} />
						<div className="mt-4 hidden flex-wrap items-center gap-x-6 gap-y-3 md:flex">
							<ScorePair title={title} m={m} api={api} />
							<SourcesSummary title={title} />
						</div>
					</div>
				</div>
			</div>
			<div className="relative flex flex-col gap-3 p-4 md:px-6 xl:flex-row xl:items-center xl:gap-5">
				<div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:hidden">
					<ScorePair title={title} m={m} api={api} />
					<SourcesSummary title={title} />
				</div>
				{started ? (
					<>
						<TrackLine m={m} api={api} className={`p-1.5 xl:flex-1 ${BOX}`} />
						{/* A Seen show's one action, Want to rewatch, stays a button: a bookmark has to show that it is on. */}
						{m.status === "seen" && <MiniActions api={api} />}
					</>
				) : (
					<div className="flex min-w-0 items-center gap-2 xl:flex-1">
						<div data-actions className="flex min-w-0 flex-1 gap-2 xl:flex-none">
							{[first, second].filter(Boolean).map((action) => (
								<ActionButton key={action.label} action={action} compact className="flex-1 xl:flex-none xl:px-4" />
							))}
						</div>
						{rest.length > 0 && (
							<Menu label="More" entries={rest.map((action) => ({ id: action.id, label: action.active ? `${action.label} (on)` : action.label, note: action.hint ?? "", run: action.run }))}>
								{({ open, toggle }) => (
									<button type="button" data-more aria-haspopup="menu" aria-expanded={open} aria-label="More" onClick={toggle} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 ${FOCUS}`}>
										<EllipsisHorizontalIcon className="h-5 w-5" />
									</button>
								)}
							</Menu>
						)}
						{api.tracking && (
							<a href="#episodes" data-next-episode className={`group ml-auto rounded-lg ${FOCUS}`}>
								<GoChip className="!h-9 !text-xs">Episodes</GoChip>
							</a>
						)}
					</div>
				)}
				<ProviderStrip providers={providers} kind={title.kind} max={5} />
			</div>
		</section>
	)
}
