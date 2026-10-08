// PROTOTYPE - throwaway. Round 1 of the title page's overview for a signed-in member (/prototype/title-overview): the
// two layouts the owner kept for reference, A (Scoreboard) and D (Banner). B and C were rejected and are gone.
// Round 2, the banner's descendants, is in banner.tsx.
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
