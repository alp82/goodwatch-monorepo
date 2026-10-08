// PROTOTYPE - throwaway. Four layouts of the title page's overview for a signed-in member (/prototype/title-overview).
// Each groups the ratings, shows the member's own score compactly, keeps the full picker behind one control, and
// has its own answer to the space under the poster. They share small parts (kit.tsx) and no layout.
import { ChevronDownIcon, PencilIcon } from "@heroicons/react/20/solid"
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"
import {
	ActionButton,
	Divider,
	EYEBROW,
	EpisodeRatingsLink,
	FOCUS,
	Floating,
	NextLine,
	PanelBackdrop,
	PhoneBanner,
	Poster,
	ProgressBar,
	Ring,
	SITES,
	ScorePicker,
	SiteChip,
	SiteMark,
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
import { type Api, type Member, type ProviderKey, type Title, img } from "./model"

export interface VariantProps {
	title: Title
	m: Member
	api: Api
	providers: ProviderKey
}

const PANEL = "relative min-w-0 rounded-2xl border border-white/10 bg-stone-950"
const BOX = "rounded-xl bg-white/[0.07] ring-1 ring-white/10"
const AMBER = "#fbbf24"

/** The same ring at two sizes: `phone` below md, `wide` from md up. */
function Sized({ phone, wide, children }: { phone: number; wide: number; children: (size: number) => ReactNode }) {
	return (
		<>
			<span className="contents md:hidden">{children(phone)}</span>
			<span className="hidden md:contents">{children(wide)}</span>
		</>
	)
}

/** Status, progress and the Next episode in one row from lg up, two rows below. Nothing for a movie. */
function TrackingRow({ m, api, className = "" }: { m: Member; api: Api; className?: string }) {
	const t = api.tracking
	if (!t) return null
	const started = m.status !== "not_started"
	return (
		<div data-tracking={m.status} className={`flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:gap-4 ${BOX} ${className}`}>
			{started && (
				<div className="flex items-center gap-3 lg:w-[42%]">
					<StatusPill status={m.status} tracking={t} api={api} />
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold tabular-nums text-white">
							{t.count} <span className="font-normal text-gray-400">episodes</span>
						</p>
						<ProgressBar percent={t.percent} className="mt-1.5" />
					</div>
				</div>
			)}
			<NextLine tracking={t} className={`lg:flex-1 ${started ? "lg:border-l lg:border-white/10 lg:pl-4" : ""}`} />
		</div>
	)
}

/** Want to See, Seen and the third action: one row, or two on a phone when there are three. */
function Actions({ api, className = "" }: { api: Api; className?: string }) {
	return (
		<div data-actions className={`grid grid-cols-2 gap-2 sm:flex ${className}`}>
			{api.actions.map((action, i) => (
				<ActionButton key={action.label} action={action} className={`${api.actions.length === 1 ? "col-span-2 sm:min-w-64" : "sm:flex-1"} ${i === 2 ? "col-span-2" : ""}`} />
			))}
		</div>
	)
}

// =========================================================================================================
// A - Scoreboard
// Two rings side by side, the title's and yours, next to a table of the three sites with critics and audience in
// columns. Your ring is the control: it opens the picker as a popover (a sheet on a phone). The poster follows the
// panel's height, and fills it when it can't.
// =========================================================================================================

const POSTER_MIN = 208
const POSTER_MAX = 400
const POSTER_SHARE = 0.36

/** The poster column is 2/3 of the panel's height wide, within limits, so a 2:3 poster ends where the panel ends. */
function usePosterWidth() {
	const row = useRef<HTMLDivElement>(null)
	const box = useRef<HTMLElement>(null)
	const [width, setWidth] = useState<number | null>(null)
	useEffect(() => {
		const r = row.current
		const b = box.current
		if (!r || !b) return
		let current = -1
		let changes = 0
		let settle: ReturnType<typeof setTimeout> | undefined
		const measure = () => {
			if (!window.matchMedia("(min-width: 768px)").matches) return
			const max = Math.min(POSTER_MAX, Math.floor(r.clientWidth * POSTER_SHARE))
			const next = Math.round(Math.min(max, Math.max(POSTER_MIN, (b.offsetHeight * 2) / 3)))
			if (next === current || changes >= 6) return
			current = next
			changes += 1
			setWidth(next)
			clearTimeout(settle)
			settle = setTimeout(() => {
				changes = 0
			}, 600)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(r)
		observer.observe(b)
		return () => {
			observer.disconnect()
			clearTimeout(settle)
		}
	}, [])
	return { row, box, style: width == null ? undefined : ({ "--poster-w": `${width}px` } as CSSProperties) }
}

export function VariantA({ title, m, api, providers }: VariantProps) {
	const { row, box, style } = usePosterWidth()
	const [picking, setPicking] = useState(false)
	const s = m.score
	return (
		<div ref={row} style={style} className="grid gap-4 md:grid-cols-[var(--poster-w)_minmax(0,1fr)] md:[--poster-w:20rem]">
			{/* The poster takes the whole cell: 2:3 while the column can follow the panel, cropped at the sides beyond. */}
			<div className="relative hidden md:block">
				<div className="absolute inset-0">
					<Poster title={title} className="h-full" />
				</div>
			</div>
			<section ref={box} className={`${PANEL} flex flex-col md:min-h-[19.5rem]`}>
				<PanelBackdrop title={title} />
				<PhoneBanner title={title} />
				<div className="relative flex grow flex-col p-4 md:p-6">
					<div className="mb-4 flex items-center justify-between gap-3">
						<h2 className={EYEBROW}>Ratings</h2>
						{title.kind === "show" && <EpisodeRatingsLink />}
					</div>
					<div data-ratings className="grid items-center gap-x-8 gap-y-5 xl:grid-cols-[auto_minmax(0,1fr)]">
						<div className="grid grid-cols-2 gap-3 xl:flex xl:gap-8">
							<div className="flex items-center gap-3" title="GoodWatch score: critics and audiences combined">
								<Sized phone={64} wide={88}>
									{(size) => (
										<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
											{title.gw}
										</Ring>
									)}
								</Sized>
								<div className="min-w-0 leading-tight">
									<p className={EYEBROW}>GoodWatch</p>
									<p className="mt-0.5 text-lg font-bold" style={{ color: gwTone(title.gw) }}>
										{gwWord(title.gw)}
									</p>
									<p className="hidden text-xs text-gray-400 sm:block">Critics + audience</p>
								</div>
							</div>
							<div className="relative">
								<button
									type="button"
									data-own-score={s ?? "none"}
									aria-haspopup="dialog"
									aria-expanded={picking}
									onClick={() => setPicking(!picking)}
									className={`-m-1.5 flex cursor-pointer items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-white/10 ${FOCUS}`}
								>
									<Sized phone={64} wide={88}>
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
									<span className="min-w-0 leading-tight">
										<span className={`block ${EYEBROW}`}>Your score</span>
										<span className="mt-0.5 block text-lg font-bold" style={{ color: s ? tone(s) : AMBER }}>
											{s ? word(s) : "Rate it"}
										</span>
										<span className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-400">
											{s ? "Change" : "1 to 10"}
											<ChevronDownIcon className="h-3.5 w-3.5" />
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
						<table className="w-full text-sm xl:ml-auto xl:max-w-sm">
							<thead>
								<tr className={EYEBROW}>
									<th className="pb-1.5 text-left font-semibold">From</th>
									<th className="w-20 pb-1.5 text-right font-semibold">Critics</th>
									<th className="w-20 pb-1.5 text-right font-semibold">Audience</th>
								</tr>
							</thead>
							<tbody>
								{siteScores(title).map((site) => (
									<tr key={site.id} className="border-t border-white/10">
										<td className="py-1.5">
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
					</div>
					<Divider className="my-5" />
					<WhereToWatch providers={providers} max={{ phone: 4, wide: 4 }} kind={title.kind} />
					<div className="min-h-5 grow" />
					<TrackingRow m={m} api={api} className="mb-3" />
					<Actions api={api} />
				</div>
			</section>
		</div>
	)
}

// =========================================================================================================
// B - Yours under the poster
// The panel is about the title: its ratings as one group (the GoodWatch ring and a tile per site), the Next
// episode, where to watch, the synopsis. Everything that is the member's sits in one card under the poster: the
// score as a wide tile that opens the picker in place, and the actions. Both columns stretch to the same height.
// =========================================================================================================

function YoursCard({ title, m, api, className = "" }: VariantProps & { className?: string }) {
	const [open, setOpen] = useState(false)
	const s = m.score
	const actions = api.actions
	return (
		<div data-yours className={`flex-col gap-3 rounded-2xl border border-white/10 bg-stone-900 p-3 ${className}`}>
			<button
				type="button"
				data-own-score={s ?? "none"}
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition hover:brightness-125 ${s ? "" : "bg-amber-300/[0.09] ring-1 ring-amber-300/50"} ${FOCUS}`}
				style={s ? { background: `${tone(s)}24`, boxShadow: `inset 0 0 0 1px ${tone(s)}99` } : undefined}
			>
				{s ? (
					<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-black tabular-nums" style={{ background: tone(s), color: ink(s) }}>
						{s}
					</span>
				) : (
					<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black">
						<StarIcon className="h-6 w-6" />
					</span>
				)}
				<span className="min-w-0 flex-1 leading-tight">
					<span className={`block ${EYEBROW}`}>Your score</span>
					<span className="mt-0.5 block truncate text-lg font-bold text-white">{s ? word(s) : `Rate this ${title.kind}`}</span>
				</span>
				<ChevronDownIcon className={`h-5 w-5 shrink-0 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>
			{open && (
				<div className="px-1 pb-1">
					<ScorePicker value={s} kind={title.kind} onRate={api.rate} onClear={api.clear} even />
				</div>
			)}
			<div className="mt-auto grid grid-cols-2 gap-2">
				{actions.map((action, i) => (
					<ActionButton key={action.label} action={action} quiet={i === 2} className={`md:px-2 ${i === 2 || actions.length === 1 ? "col-span-2" : ""}`} />
				))}
			</div>
		</div>
	)
}

export function VariantB(props: VariantProps) {
	const { title, m, api, providers } = props
	const t = api.tracking
	return (
		<div className="grid gap-4 md:grid-cols-[20rem_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
			<Poster title={title} trailer="none" className="hidden aspect-[2/3] md:block" />
			<YoursCard {...props} className="hidden md:flex" />
			<section className={`${PANEL} flex flex-col md:col-start-2 md:row-span-2 md:row-start-1`}>
				<PanelBackdrop title={title} />
				<PhoneBanner title={title} />
				<div className="relative flex grow flex-col gap-5 p-4 md:p-6">
					<div data-ratings>
						<div className="mb-3 flex items-center justify-between gap-3">
							<h2 className={EYEBROW}>Ratings</h2>
							{title.kind === "show" && <EpisodeRatingsLink />}
						</div>
						<div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-6">
							<div className="flex items-center gap-3" title="GoodWatch score: critics and audiences combined">
								<Sized phone={64} wide={92}>
									{(size) => (
										<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
											{title.gw}
										</Ring>
									)}
								</Sized>
								<div className="leading-tight">
									<p className="text-lg font-bold" style={{ color: gwTone(title.gw) }}>
										{gwWord(title.gw)}
									</p>
									<p className="text-xs text-gray-300">GoodWatch score</p>
								</div>
							</div>
							<div className="grid grid-cols-3 gap-2">
								{siteScores(title).map((site) => (
									<div key={site.id} className={`min-w-0 p-2 sm:p-3 ${BOX}`}>
										<div className="flex items-center gap-2">
											<SiteMark id={site.id} />
											<span className="hidden truncate text-xs font-medium text-gray-300 sm:inline">{SITES[site.id].short}</span>
										</div>
										<dl className="mt-2 space-y-0.5">
											{(["critics", "audience"] as const).map((who) => (
												<div key={who} className="flex items-baseline justify-between gap-1">
													<dt className="text-[9px] font-semibold uppercase text-gray-500 sm:text-[10px] sm:tracking-wide">{who}</dt>
													<dd className={`text-sm font-bold tabular-nums sm:text-base ${site[who] ? "text-white" : "text-gray-600"}`}>{site[who] ?? "–"}</dd>
												</div>
											))}
										</dl>
									</div>
								))}
							</div>
						</div>
					</div>
					<YoursCard {...props} className="flex md:hidden" />
					{t && (
						<div data-tracking={m.status} className={`p-3 ${BOX}`}>
							{m.status !== "not_started" && (
								<div className="mb-3 flex items-center gap-3">
									<StatusPill status={m.status} tracking={t} api={api} />
									<ProgressBar percent={t.percent} className="flex-1" />
									<p className="shrink-0 text-sm font-semibold tabular-nums text-white">
										{t.count}
										<span className="hidden font-normal text-gray-400 sm:inline"> episodes</span>
									</p>
								</div>
							)}
							<NextLine tracking={t} />
						</div>
					)}
					<WhereToWatch providers={providers} max={{ phone: 4, wide: 8 }} kind={title.kind} />
					{/* The trailer as a still that takes whatever height is left, so the panel never ends in empty space. */}
					<div data-trailer-still className="relative hidden min-h-40 flex-1 overflow-hidden rounded-xl ring-1 ring-white/10 md:block">
						<img src={img("w1280", title.backdrop)} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />
						<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
						<div className="absolute inset-y-0 left-0 flex w-3/5 max-w-lg flex-col justify-end p-4">
							<p className={EYEBROW}>About</p>
							<p className="mt-1 line-clamp-3 text-sm leading-relaxed text-gray-200">{title.overview}</p>
						</div>
						<TrailerPill className="absolute right-5 top-1/2 -translate-y-1/2" />
					</div>
					<div className="border-t border-white/10 pt-4 md:hidden">
						<p className={EYEBROW}>About</p>
						<p className="mt-1.5 text-sm leading-relaxed text-gray-300">{title.overview}</p>
					</div>
				</div>
			</section>
		</div>
	)
}

// =========================================================================================================
// C - One card, poster inset
// No poster column: a small poster sits inside the card beside a strip of four tiles (GoodWatch, Critics,
// Audience, You), and the rows under it (the picker when open, where to watch) run the card's full width, so
// nothing can end above or below the poster. The You tile opens the picker in place.
// =========================================================================================================

const TILE = `min-w-0 p-3 ${BOX}`

function StripTiles({ title, m, open, toggle, only }: { title: Title; m: Member; open: boolean; toggle: () => void; only?: "scores" | "sites" }) {
	const s = m.score
	const sites = siteScores(title)
	return (
		<>
			{only !== "sites" && (
				<div className={TILE} title="GoodWatch score: critics and audiences combined">
					<p className={EYEBROW}>GoodWatch</p>
					<p className="mt-1.5 flex items-baseline gap-2">
						<span className="text-3xl font-black leading-none tabular-nums" style={{ color: gwTone(title.gw) }}>
							{title.gw}
						</span>
						<span className="truncate text-sm font-semibold text-gray-200">{gwWord(title.gw)}</span>
					</p>
					<span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
						<span className="block h-full rounded-full" style={{ width: `${title.gw}%`, background: gwTone(title.gw) }} />
					</span>
				</div>
			)}
			{only !== "scores" && (
				<>
					<div className={TILE}>
						<p className={EYEBROW}>Critics</p>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{sites
								.filter((site) => site.id !== "imdb")
								.map((site) => (
									<SiteChip key={site.id} id={site.id} value={site.critics} />
								))}
						</div>
					</div>
					<div className={TILE}>
						<p className={EYEBROW}>Audience</p>
						<div className="mt-2 flex flex-wrap gap-1.5">
							{sites.map((site) => (
								<SiteChip key={site.id} id={site.id} value={site.audience} />
							))}
						</div>
					</div>
				</>
			)}
			{only !== "sites" && (
				<button
					type="button"
					data-own-score={s ?? "none"}
					aria-expanded={open}
					onClick={toggle}
					className={`min-w-0 cursor-pointer rounded-xl p-3 text-left transition hover:brightness-125 ${s ? "" : "bg-amber-300/[0.09] ring-1 ring-amber-300/60"} ${FOCUS}`}
					style={s ? { background: `${tone(s)}26`, boxShadow: `inset 0 0 0 1.5px ${tone(s)}` } : undefined}
				>
					<span className="flex items-center justify-between gap-2">
						<span className={EYEBROW} style={{ color: s ? undefined : AMBER }}>
							You
						</span>
						<ChevronDownIcon className={`h-4 w-4 text-gray-300 transition-transform ${open ? "rotate-180" : ""}`} />
					</span>
					{s ? (
						<>
							<span className="mt-1.5 flex items-baseline gap-2">
								<span className="text-3xl font-black leading-none tabular-nums" style={{ color: tone(s) }}>
									{s}
								</span>
								<span className="truncate text-sm font-semibold text-gray-100">{word(s)}</span>
							</span>
							<span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
								<span className="block h-full rounded-full" style={{ width: `${s * 10}%`, background: tone(s) }} />
							</span>
						</>
					) : (
						<span className="mt-1.5 flex items-center gap-2 text-amber-300">
							<StarIcon className="h-7 w-7" />
							<span className="text-base font-bold leading-tight text-white">Rate it</span>
						</span>
					)}
				</button>
			)}
		</>
	)
}

export function VariantC({ title, m, api, providers }: VariantProps) {
	const [open, setOpen] = useState(false)
	const toggle = () => setOpen(!open)
	const show = title.kind === "show"
	const picker = open && (
		<div data-inline-picker className="mt-4 rounded-2xl bg-black/50 p-4 ring-1 ring-white/15 md:ml-auto md:max-w-xl">
			<ScorePicker value={m.score} kind={title.kind} onRate={api.rate} onClear={api.clear} />
			<div className="mt-3 flex justify-end">
				<button type="button" onClick={() => setOpen(false)} className={`h-9 cursor-pointer rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-gray-200 ${FOCUS}`}>
					Done
				</button>
			</div>
		</div>
	)
	const blurb = (
		<p className="line-clamp-3 max-w-3xl text-sm leading-relaxed text-gray-300">
			<span className="font-semibold text-gray-100">{title.facts.join(" · ")}.</span> {title.overview}
		</p>
	)
	return (
		<section className={PANEL}>
			<PanelBackdrop title={title} />
			<div className="relative p-4 md:p-6">
				{/* Phone: the poster beside GoodWatch and You, then Critics and Audience across. */}
				<div className="md:hidden">
					<div className="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3">
						<Poster title={title} trailer="dot" className="aspect-[2/3]" />
						<div className="grid grid-rows-2 gap-2">
							<StripTiles title={title} m={m} open={open} toggle={toggle} only="scores" />
						</div>
					</div>
					{picker}
					<div data-ratings className="mt-2 grid grid-cols-2 gap-2">
						<StripTiles title={title} m={m} open={open} toggle={toggle} only="sites" />
					</div>
					{show && (
						<p className="mt-2 text-right">
							<EpisodeRatingsLink />
						</p>
					)}
					<TrackingRow m={m} api={api} className="mt-3" />
					<Actions api={api} className="mt-3" />
				</div>
				{/* From md up: the poster beside the strip, the tracking row and the actions. */}
				<div className="hidden grid-cols-[13.5rem_minmax(0,1fr)] gap-6 md:grid">
					<Poster title={title} trailer="dot" className="aspect-[2/3] self-start" />
					<div className="flex min-w-0 flex-col justify-between gap-3">
						<div>
							<div data-ratings className="grid grid-cols-2 gap-2 lg:grid-cols-4">
								<StripTiles title={title} m={m} open={open} toggle={toggle} />
							</div>
							{picker}
						</div>
						{show ? (
							<div className="flex items-center justify-between gap-4">
								<p className="truncate text-sm text-gray-400">{title.facts.join(" · ")}</p>
								<EpisodeRatingsLink />
							</div>
						) : (
							blurb
						)}
						<TrackingRow m={m} api={api} />
						<Actions api={api} />
					</div>
				</div>
				<Divider className="my-5" />
				<WhereToWatch providers={providers} max={{ phone: 4, wide: 6 }} kind={title.kind} />
			</div>
		</section>
	)
}

// =========================================================================================================
// D - Banner
// The backdrop is a wide banner, the poster a small card that overlaps its lower edge, and one frosted bar holds
// every rating: the GoodWatch ring, your score as a pill, then critics and audience as two labelled runs of site
// chips. The pill opens the picker as a dialog (a sheet on a phone). With no poster column, nothing sits under one.
// =========================================================================================================

export function VariantD({ title, m, api, providers }: VariantProps) {
	const [picking, setPicking] = useState(false)
	const s = m.score
	const sites = siteScores(title)
	const show = title.kind === "show"
	const sources = (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-2.5">
			<span className="flex flex-wrap items-center gap-1.5">
				<span className={`mr-1 ${EYEBROW}`}>Critics</span>
				{sites
					.filter((site) => site.id !== "imdb")
					.map((site) => (
						<SiteChip key={site.id} id={site.id} value={site.critics} />
					))}
			</span>
			<span className="flex flex-wrap items-center gap-1.5">
				<span className={`mr-1 ${EYEBROW}`}>Audience</span>
				{sites.map((site) => (
					<SiteChip key={site.id} id={site.id} value={site.audience} />
				))}
			</span>
			{show && <EpisodeRatingsLink className="md:ml-auto" />}
		</div>
	)
	return (
		<section className={PANEL}>
			<div className="relative h-44 overflow-hidden rounded-t-2xl sm:h-64 lg:h-[21rem]">
				<img src={img("w1280", title.backdrop)} alt="" className="h-full w-full object-cover object-[center_22%]" />
				<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
				<TrailerPill className="absolute right-3 top-3 md:right-5 md:top-5" />
			</div>
			<div className="relative -mt-16 px-4 pb-5 md:-mt-40 md:px-7 md:pb-7">
				<div className="grid grid-cols-[5rem_minmax(0,1fr)] items-end gap-x-3 md:grid-cols-[11.5rem_minmax(0,1fr)] md:gap-x-6">
					<Poster title={title} trailer="none" className="aspect-[2/3] shadow-[0_12px_40px_rgba(0,0,0,.7)]" />
					<div data-ratings className="min-w-0 rounded-2xl bg-stone-900/90 p-2.5 ring-1 ring-white/10 md:p-4">
						<div className="flex items-center gap-3 md:gap-6">
							<div className="flex items-center gap-3" title="GoodWatch score: critics and audiences combined">
								<Sized phone={52} wide={84}>
									{(size) => (
										<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
											{title.gw}
										</Ring>
									)}
								</Sized>
								<div className="hidden leading-tight sm:block">
									<p className="text-lg font-bold" style={{ color: gwTone(title.gw) }}>
										{gwWord(title.gw)}
									</p>
									<p className="text-xs text-gray-300">GoodWatch score</p>
								</div>
							</div>
							<span className="hidden h-12 w-px bg-white/10 md:block" aria-hidden="true" />
							<button
								type="button"
								data-own-score={s ?? "none"}
								aria-haspopup="dialog"
								aria-expanded={picking}
								onClick={() => setPicking(true)}
								className={`flex min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl text-left transition hover:brightness-110 md:gap-3 ${s ? "h-14 pl-2 pr-3 md:h-16 md:pr-4" : "h-12 bg-amber-400 px-4 text-black md:h-14 md:px-5"} ${FOCUS}`}
								style={s ? { background: `${tone(s)}26`, boxShadow: `inset 0 0 0 1.5px ${tone(s)}` } : undefined}
							>
								{s ? (
									<>
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl font-black tabular-nums md:h-12 md:w-12 md:text-2xl" style={{ background: tone(s), color: ink(s) }}>
											{s}
										</span>
										<span className="min-w-0 leading-tight">
											<span className={`block ${EYEBROW}`}>
												You<span className="hidden md:inline">r score</span>
											</span>
											<span className="block truncate text-sm font-bold text-white md:text-lg">{word(s)}</span>
										</span>
										<PencilIcon className="ml-1 hidden h-4 w-4 shrink-0 text-gray-300 md:block" />
									</>
								) : (
									<>
										<StarIcon className="h-5 w-5 shrink-0" />
										<span className="truncate text-sm font-bold md:text-base">
											Rate<span className="hidden sm:inline"> this {title.kind}</span>
										</span>
									</>
								)}
							</button>
						</div>
						<div className="mt-4 hidden border-t border-white/10 pt-3.5 md:block">{sources}</div>
					</div>
				</div>
				<div className="mt-3 rounded-2xl bg-stone-900/90 p-3 ring-1 ring-white/10 md:hidden">{sources}</div>
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
				<div className={`mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 md:mt-6 ${show ? "xl:grid-cols-[minmax(0,1fr)_auto]" : ""}`}>
					<TrackingRow m={m} api={api} />
					<div data-actions className="grid grid-cols-2 gap-2 sm:flex">
						{api.actions.map((action, i) => (
							<ActionButton key={action.label} action={action} className={`xl:h-auto xl:min-h-11 ${api.actions.length === 1 ? "col-span-2 sm:min-w-64" : "sm:flex-1"} ${show ? "xl:flex-none xl:px-5" : ""} ${i === 2 ? "col-span-2" : ""}`} />
						))}
					</div>
				</div>
				<Divider className="my-5" />
				<WhereToWatch providers={providers} max={{ phone: 4, wide: 6 }} kind={title.kind} />
			</div>
		</section>
	)
}
