// PROTOTYPE - throwaway. Round 4 of /prototype/title-overview: L, M and N. The owner chose round 3's I as the
// baseline and asked for five changes, which all three have:
// 1. Your score is J's rectangle (number on its colour, "Your score", the word, a pencil), not a second ring.
// 2. Every row uses its whole width: what starts it is at the left edge and what ends it at the right edge.
// 3. The way to the episode ratings is a picture, not a text link: a miniature of the ratings grid in its colours,
//    as in the Grid toggle of the Episodes section (ui/tracking/EpisodeList.tsx, `MINIATURE`). Shows only.
// 4. Where to watch has J's cards (logo beside name, two to a row, "All N services" opens the rest in place).
// 5. Without a score, your score is the same rectangle with a dashed amber border and a hollow background.
// They differ in what is still open: where the ratings sit, where and how big the miniature is, whether the
// actions share the tracking line, and how dense it all is.
import { PencilIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useState } from "react"
import { imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { BannerImage, BannerTrailer, TitleBlock } from "./banner"
import { ActionButton, EYEBROW, FOCUS, Floating, GoChip, Poster, ProgressBar, Ring, ScorePicker, Sized, StarIcon, StatusPill, gwTone, gwWord, ink, tone, word } from "./kit"
import type { Api, Member, Title } from "./model"
import { SiteChips, WatchSection } from "./round3"
import type { VariantProps } from "./variants"

const PANEL = "relative min-w-0 rounded-2xl border border-white/10 bg-stone-950"
const BOX = "rounded-xl bg-white/[0.07] ring-1 ring-white/10"
const QUIET = "rounded-xl bg-white/[0.035] ring-1 ring-white/[0.07]"
const SHADOW = "shadow-[0_8px_30px_rgba(0,0,0,.7)]"

// ---------------------------------------------------------------------------------------------------------
// The scores row: GoodWatch at the left edge, yours at the right
// ---------------------------------------------------------------------------------------------------------

/** Your score as a rectangle. With a score it is J's pill; without one, the same shape, dashed and hollow. */
function OwnRect({ title, m, api, tight = false, narrow = false }: { title: Title; m: Member; api: Api; tight?: boolean; /** In a box on a phone there is no room for the pencil. */ narrow?: boolean }) {
	const [picking, setPicking] = useState(false)
	const s = m.score
	const h = tight ? "h-11" : "h-12"
	const tile = tight ? "h-8 w-8 text-base" : "h-9 w-9 text-lg"
	return (
		<>
			<button
				type="button"
				data-own-score={s ?? "none"}
				aria-haspopup="dialog"
				aria-expanded={picking}
				onClick={() => setPicking(true)}
				className={`flex ${h} min-w-0 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition ${s ? "pl-1.5 pr-3 hover:brightness-110" : "border-2 border-dashed border-amber-400/70 bg-amber-300/[0.06] pl-2.5 pr-3.5 hover:border-amber-300 hover:bg-amber-300/[0.12]"} ${FOCUS}`}
				style={s ? { background: `${tone(s)}26`, boxShadow: `inset 0 0 0 1.5px ${tone(s)}` } : undefined}
			>
				{s ? (
					<>
						<span className={`flex shrink-0 items-center justify-center rounded-lg font-black tabular-nums ${tile}`} style={{ background: tone(s), color: ink(s) }}>
							{s}
						</span>
						<span className="min-w-0 leading-tight">
							<span className={`block whitespace-nowrap ${EYEBROW}`}>Your score</span>
							<span className="block truncate text-sm font-bold text-white">{word(s)}</span>
						</span>
						<PencilIcon className={`h-3.5 w-3.5 shrink-0 text-gray-300 ${narrow ? "max-sm:hidden" : ""}`} />
					</>
				) : (
					<>
						<StarIcon className="h-5 w-5 shrink-0 text-amber-300" />
						<span className="leading-tight">
							<span className={`block whitespace-nowrap ${EYEBROW} !text-amber-200/80`}>Your score</span>
							<span className="block whitespace-nowrap text-sm font-bold text-white">
								Rate <span className="sm:hidden">it</span>
								<span className="max-sm:hidden">this {title.kind}</span>
							</span>
						</span>
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

function Scores({ title, m, api, tight = false, narrow = false }: VariantProps & { tight?: boolean; narrow?: boolean }) {
	return (
		<div data-row="scores" data-ratings className="flex items-center justify-between gap-3">
			<div className="flex min-w-0 items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
				<Sized phone={tight ? 44 : 48} wide={tight ? 48 : 56}>
					{(size) => (
						<Ring size={size} fraction={title.gw / 100} color={gwTone(title.gw)}>
							{title.gw}
						</Ring>
					)}
				</Sized>
				<div className="min-w-0 leading-tight">
					<p className={EYEBROW}>GoodWatch</p>
					<p className="text-base font-bold" style={{ color: gwTone(title.gw) }}>
						{gwWord(title.gw)}
					</p>
				</div>
			</div>
			<OwnRect title={title} m={m} api={api} tight={tight} narrow={narrow} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The episode ratings as a picture
// ---------------------------------------------------------------------------------------------------------

/** The Grid toggle's twelve cells (ui/tracking/EpisodeList.tsx). */
const MINIATURE = [8.2, 8.6, 7.9, 9.1, 7.4, 8.3, 8.8, 6.6, 8.0, 9.3, 8.5, 7.7]
/** A row per season, a cell per episode: the sample show's 22 episodes. */
const SEASONS = [
	[7.9, 8.2, 8.6, 8.4, 8.8, 9.1, 8.7, 9.3],
	[7.4, 7.8, 8.3, 8.0, 8.6, 8.8, 8.5, 9.0],
	[6.6, 7.2, 7.7, 7.5, 8.0, 8.5, null, null],
]

/**
 * The way down to the episode ratings, as a miniature of the grid in its colours. "tile" is the Grid toggle's own
 * picture at its own size; "seasons" is wider, a row per season. It is a link, so it is always in colour.
 */
function GridPreview({ size = "tile", label }: { size?: "tile" | "seasons"; label?: string }) {
	const cells: (number | null)[] = size === "tile" ? MINIATURE : SEASONS.flat()
	return (
		<a href="#episodes" data-episode-ratings aria-label="Episode ratings: every episode in one grid" title="Episode ratings: every episode in one grid" className={`group inline-flex shrink-0 items-center gap-2 rounded-lg ${FOCUS}`}>
			{label && <span className="text-xs font-semibold text-gray-300 group-hover:text-white max-sm:hidden">{label}</span>}
			<span className={`flex h-7 items-center justify-center rounded-lg bg-gray-900 ring-1 ring-white/20 transition group-hover:ring-white/60 ${size === "tile" ? "w-10" : "w-[4.5rem]"}`}>
				<span aria-hidden="true" className={`grid gap-px ${size === "tile" ? "grid-cols-4" : "grid-cols-8"}`}>
					{cells.map((score, index) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
							key={index}
							className={`h-[5px] rounded-[1px] ${size === "tile" ? "w-[7px]" : "w-[6px]"}`}
							style={{ background: score == null ? "transparent" : vibeTileColor(imdbVibe(score)) }}
						/>
					))}
				</span>
			</span>
		</a>
	)
}

/** The site chips at the left edge and the miniature at the right. With nothing for the right, the chips share the width. */
function ChipsRow({ title, preview }: { title: Title; preview?: ReactNode }) {
	const right = title.kind === "show" ? preview : null
	return (
		<div data-row="sites" className="flex items-center justify-between gap-3">
			<SiteChips title={title} fill={!right} className={right ? "" : "flex-1"} />
			{right}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Tracking and actions
// ---------------------------------------------------------------------------------------------------------

/** Status and progress at the left edge, the Next episode chip at the right. `extra` stands just before the chip. */
function Track({ m, api, extra, bar = "w-10 sm:w-20 xl:w-28" }: { m: Member; api: Api; extra?: ReactNode; bar?: string }) {
	const t = api.tracking
	if (!t) return null
	const next = m.status === "watching" || m.status === "on_hold"
	return (
		<div data-row="tracking" data-tracking={m.status} className="flex min-w-0 flex-1 items-center gap-2.5">
			{m.status === "not_started" ? (
				<p className="min-w-0 truncate text-sm text-gray-300">
					<span className="font-semibold text-white">{t.eyebrow}</span> <span className="max-sm:hidden">{t.line}</span>
				</p>
			) : (
				<>
					<StatusPill status={m.status} tracking={t} api={api} />
					<span className="flex shrink-0 items-center gap-2" title={`${t.count} episodes`}>
						<span className="text-xs font-semibold tabular-nums text-white">{t.short}</span>
						<ProgressBar percent={t.percent} className={bar} />
					</span>
				</>
			)}
			<span className="ml-auto flex shrink-0 items-center gap-2">
				{extra}
				<a href="#episodes" data-next-episode className={`group flex items-center gap-2 rounded-lg ${FOCUS}`}>
					{next && !extra && <span className="text-xs text-gray-400">Next</span>}
					<GoChip className="!h-9 !text-xs">{t.chip}</GoChip>
				</a>
			</span>
		</div>
	)
}

/** The actions fill their row. On a phone a third one is its icon alone, at the right edge. */
function Actions({
	api,
	inline = false,
	thirdIcon = false,
}: { api: Api; /** From md up the buttons are as wide as their words, for a place on the tracking line. */ inline?: boolean; /** A third action is its icon alone at every width (a narrow column). */ thirdIcon?: boolean }) {
	return (
		<div data-row="actions" data-actions className={`flex min-w-0 gap-2 ${inline ? "md:shrink-0" : ""}`}>
			{api.actions.map((action, i) => (
				<ActionButton key={action.label} action={action} compact phoneIcon={i === 2} iconOnly={thirdIcon && i === 2} className={`${i === 2 ? (thirdIcon ? "" : "sm:flex-1") : "flex-1"} ${inline ? "md:flex-none" : ""}`} />
			))}
		</div>
	)
}

// =========================================================================================================
// L - I, with the five changes and nothing else
// The ratings stay on the banner: GoodWatch ring left and your score right, then the site chips left and the
// Grid toggle's miniature right. Under the banner the two blocks of I: your show (tracking line, then the
// actions in their own row) and where to watch.
// =========================================================================================================

export function VariantL(props: VariantProps) {
	const { title, m, api, providers } = props
	const ratings = (
		<div className="space-y-3">
			<Scores {...props} />
			<ChipsRow title={title} preview={<GridPreview label="Episodes" />} />
		</div>
	)
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative px-4 pb-4 pt-12 md:px-6 md:pb-5 md:pt-10">
					<div className="flex items-end gap-3 md:gap-6">
						<Poster title={title} trailer="none" className={`aspect-[2/3] w-[4.5rem] shrink-0 md:w-32 ${SHADOW}`} />
						<div className="min-w-0 flex-1">
							<TitleBlock title={title} />
							<div className="mt-4 hidden max-w-md md:block">{ratings}</div>
						</div>
					</div>
					<div className="mt-3.5 md:hidden">{ratings}</div>
				</div>
			</div>
			<div className="relative grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-2">
				<div data-your className={`flex flex-col justify-center gap-2.5 p-3 ${BOX}`}>
					<Track m={m} api={api} />
					<Actions api={api} />
				</div>
				<WatchSection providers={providers} kind={title.kind} layout="tiles" fill className={`p-3 ${QUIET}`} />
			</div>
		</section>
	)
}

// =========================================================================================================
// M - Ratings under a shorter banner
// The banner is only the poster, the title and the trailer. The ratings are the first of three blocks, in a box
// of their own; the site chips share its width, and the miniature moves to where the episodes are: the tracking
// line, right before the Next episode chip. Two columns from 1024 px (where to watch under them), three from 1280.
// =========================================================================================================

export function VariantM(props: VariantProps) {
	const { title, m, api, providers } = props
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative flex items-end gap-3 px-4 pb-3 pt-12 md:gap-5 md:px-5 md:pb-4 md:pt-10">
					<Poster title={title} trailer="none" className={`aspect-[2/3] w-16 shrink-0 md:w-[5.5rem] ${SHADOW}`} />
					<TitleBlock title={title} className="flex-1 pb-0.5" />
				</div>
			</div>
			<div className="relative grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-2 xl:grid-cols-3">
				<div className={`flex min-w-0 flex-col justify-center gap-3 p-3 ${BOX}`}>
					<Scores {...props} narrow />
					<ChipsRow title={title} />
				</div>
				<div data-your className={`flex min-w-0 flex-col justify-center gap-2.5 p-3 ${BOX}`}>
					<Track m={m} api={api} extra={<GridPreview />} bar="max-sm:hidden sm:w-20 lg:w-16 xl:w-12" />
					<Actions api={api} thirdIcon />
				</div>
				<WatchSection providers={providers} kind={title.kind} layout="tiles" fill className={`p-3 lg:col-span-2 xl:col-span-1 ${QUIET}`} />
			</div>
		</section>
	)
}

// =========================================================================================================
// N - Tighter, actions on the tracking line
// L made denser: a smaller ring and rectangle, less air, lower service cards. The miniature is the wider one, a
// row per season. From 768 px up the actions stand on the tracking line, after the Next episode chip, so "your
// show" is one row; on a phone they keep their own row. Where to watch is under it, and beside it from 1280.
// =========================================================================================================

export function VariantN(props: VariantProps) {
	const { title, m, api, providers } = props
	const ratings = (
		<div className="space-y-2.5">
			<Scores {...props} tight />
			<ChipsRow title={title} preview={<GridPreview size="seasons" />} />
		</div>
	)
	return (
		<section className={PANEL}>
			<div className="relative">
				<BannerImage title={title} rounded="rounded-t-2xl" />
				<BannerTrailer />
				<div className="relative px-3 pb-3 pt-11 md:px-5 md:pb-4 md:pt-8">
					<div className="flex items-end gap-3 md:gap-5">
						<Poster title={title} trailer="none" className={`aspect-[2/3] w-16 shrink-0 md:w-28 ${SHADOW}`} />
						<div className="min-w-0 flex-1">
							<TitleBlock title={title} />
							<div className="mt-3 hidden max-w-md md:block">{ratings}</div>
						</div>
					</div>
					<div className="mt-3 md:hidden">{ratings}</div>
				</div>
			</div>
			<div className="relative grid grid-cols-[minmax(0,1fr)] gap-2 p-2 md:p-4 md:pt-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div data-your className={`flex flex-col justify-center gap-2 p-2.5 md:flex-row md:items-center md:gap-3 ${BOX}`}>
					<Track m={m} api={api} />
					<Actions api={api} inline />
				</div>
				<WatchSection providers={providers} kind={title.kind} layout="tiles" fill tight className={`p-2.5 ${QUIET}`} />
			</div>
		</section>
	)
}
