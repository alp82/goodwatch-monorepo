// PROTOTYPE - throwaway (seen-score).
// Question: where should Seen and the own score sit in the title page overview, and how should one lead to the other?
// Four variants on the live title page, switched with ?variant= (live, A, B, C, D). Every variant reuses the live
// components (ScoreRing, the own-score rectangle, ActionButton, ScoreDialog, ScoreControl) and only moves them.
// Seen and the score run on an in-memory stub (store.tsx): nothing is saved.
import { useEffect, useRef, useState } from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import TitleSidesLine from "~/ui/details/hero/TitleSidesLine"
import { HeroBackdropImage, HeroPoster, TrailerButton } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import type { SectionIds } from "~/ui/details/sections"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import type { SectionProps } from "~/utils/scroll"
import { EyeIcon, HideButton, ProtoScoreDialog, ScoreRect, SeenButton, StateStrip, WantButton, useOpenAfterSeen, useProtoToasts } from "./pieces"
import { ProtoProvider, useFlash, useProto } from "./store"

export const SEEN_SCORE_VARIANTS = {
	live: "Live page (no change)",
	A: "Seen + score side by side in your block",
	B: "One control: Seen it? Rate it",
	C: "Both up top, score opens inline",
	D: "Live layout, linked flow only",
} as const

export type SeenScoreVariant = Exclude<keyof typeof SEEN_SCORE_VARIANTS, "live">

type Media = MovieResult | ShowResult

interface Props {
	variant: SeenScoreVariant
	media: Media
	country: string
	shownCountry?: string
	preview?: "loading" | "failed" | null
	episodeGrid?: EpisodeGrid | null
	sectionProps: SectionProps<SectionIds>
	sides?: TitleSides | null
}

export default function PrototypeHero(props: Props) {
	return (
		<ProtoProvider media={props.media}>
			<Frame {...props} />
		</ProtoProvider>
	)
}

// A copy of DetailsHero with two slots: what follows the GoodWatch ring in the ratings, and the actions block.
function Frame({ variant, media, country, shownCountry, preview, episodeGrid = null, sectionProps, sides = null }: Props) {
	useProtoToasts()
	const sites = (
		<div data-hero-sites className="flex min-w-0 items-center justify-between gap-3 empty:hidden">
			<RatingChips media={media} fill={!episodeGrid} />
			{episodeGrid && <EpisodeGridLink grid={episodeGrid} />}
		</div>
	)
	const v = VARIANTS[variant]
	return (
		<div className="relative mx-auto mb-10 mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview}>
				<section data-title-overview className="relative isolate z-30 min-w-0 rounded-2xl border border-white/10 bg-stone-950">
					<div className="relative">
						<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-t-2xl" aria-hidden="true">
							<HeroBackdropImage media={media} className="h-full w-full object-cover object-[center_22%]" />
							<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
							<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
						</div>
						<TrailerButton media={media} className="absolute right-3 top-3 md:right-5 md:top-4" />
						<div className="px-4 pb-4 pt-14 md:px-6 md:pb-5 md:pt-10">
							<div className="flex items-end gap-3 md:gap-6">
								<HeroPoster media={media} className="w-[4.5rem] md:w-32" />
								<div data-hero-ratings className={`min-w-0 flex-1 ${v.wideRatings ? "md:max-w-2xl" : "md:max-w-md"}`}>
									<div data-hero-scores className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
										<div className="md:hidden">
											<ScoreRing media={media} size={48} />
										</div>
										<div className="hidden md:block">
											<ScoreRing media={media} size={56} />
										</div>
										{v.ratings && <v.ratings />}
									</div>
									<div className="mt-3 max-md:hidden">{sites}</div>
								</div>
							</div>
							<div className="mt-3.5 md:hidden">{sites}</div>
							{v.underRatings && <v.underRatings />}
						</div>
					</div>
					{sides && <TitleSidesLine sides={sides} mediaType={media.mediaType} tmdbId={media.details.tmdb_id} />}
					<div className="grid grid-cols-[minmax(0,1fr)] gap-2.5 p-3 md:p-5 md:pt-4 lg:grid-cols-2">
						<div className="flex min-w-0 flex-col justify-center rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
							<v.actions />
						</div>
						<WhereToWatch media={media} country={country} shownCountry={shownCountry} preview={preview} className="rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.07]" />
					</div>
					<div className="px-3 pb-3 md:px-5 md:pb-4">
						<StateStrip />
					</div>
				</section>
			</div>
		</div>
	)
}

/** Want to See and Not interested, the two buttons every variant keeps in the block. */
function OtherActions() {
	return (
		<div className="flex min-w-0 gap-2">
			<WantButton className="flex-1" />
			<HideButton className="max-sm:w-9 max-sm:flex-none sm:flex-1" />
		</div>
	)
}

// A: Seen and the score rectangle sit side by side as the block's first row; Want and Not interested follow.
// Seen on asks for the score in the live dialog (with Skip). A score turns Seen on, and the Seen button glows.
function ActionsA() {
	const p = useProto()
	const dialog = useOpenAfterSeen()
	const rect = useRef<HTMLButtonElement>(null)
	return (
		<div className="flex flex-col gap-2">
			<p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">Your {p.media.mediaType}</p>
			<div className="grid grid-cols-2 gap-2">
				<SeenButton size="md" className="!h-12 !rounded-xl" />
				<ScoreRect ref={rect} score={p.state.score} mediaType={p.media.mediaType} onClick={dialog.openPlain} prompt={p.state.seen && p.state.score == null} />
			</div>
			<OtherActions />
			<ProtoScoreDialog open={dialog.open} afterSeen={dialog.afterSeen} onClose={dialog.close} opener={rect} />
		</div>
	)
}

// B: one control in the ratings, where the own score is today. It reads "Seen it? Rate it" before anything, "Seen,
// rate it" after Seen alone, and the score with a Seen mark after a score. The dialog holds both Seen and the score.
function RatingsB() {
	const p = useProto()
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLButtonElement>(null)
	const { seen, score } = p.state
	const glow = useFlash(p.event?.kind === "auto-seen" ? p.event.at : undefined)
	const color = score ? getVibeColorValue(score) : ""
	return (
		<>
			<button
				ref={ref}
				type="button"
				onClick={() => setOpen(true)}
				className={`flex h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left transition max-md:w-full md:min-w-[12.5rem] md:shrink-0 ${
					score
						? "pl-1.5 pr-3 hover:brightness-110"
						: seen
							? "border-2 border-dashed border-green-400/70 bg-green-400/[0.07] pl-2.5 pr-3.5 hover:bg-green-400/[0.12]"
							: "border-2 border-dashed border-amber-400/70 bg-amber-300/[0.06] pl-2.5 pr-3.5 hover:border-amber-300 hover:bg-amber-300/[0.12]"
				} ${glow ? "ring-2 ring-green-300" : ""}`}
				style={score ? { background: `${color}26`, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
			>
				{score ? (
					<span
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg font-black tabular-nums"
						style={{ background: color, color: score <= 3 ? "#fff" : "#0a0a0a" }}
					>
						{score}
					</span>
				) : (
					<EyeIcon className={`h-5 w-5 shrink-0 ${seen ? "text-green-400" : "text-amber-300"}`} />
				)}
				<span className="min-w-0 flex-1 leading-tight">
					<span className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.08em] ${score ? "text-gray-400" : seen ? "text-green-300/90" : "text-amber-200/80"}`}>
						{seen && (score ? <EyeIcon className="h-3 w-3 text-green-400" /> : null)}
						{seen ? "Seen" : "Seen it?"}
					</span>
					<span className="block truncate text-sm font-bold text-white">{score ? scoreLabels[score] : "Rate it"}</span>
				</span>
			</button>
			<ProtoScoreDialog open={open} onClose={() => setOpen(false)} opener={ref} seenToggle />
		</>
	)
}

// C: Seen and the score both move up into the ratings, next to each other. Seen on, or a press on the score, opens
// the score control inline under the ratings, not in a dialog.
function RatingsC() {
	const p = useProto()
	return (
		<div className="flex gap-2 max-md:w-full md:shrink-0">
			<SeenButton size="md" label="auto" className="!h-12 !w-auto flex-1 !rounded-xl md:!w-36 md:flex-none" />
			<ScoreRect
				score={p.state.score}
				mediaType={p.media.mediaType}
				onClick={() => window.dispatchEvent(new Event("proto:inline-score"))}
				prompt={p.state.seen && p.state.score == null}
				className="flex-1 md:min-w-[10.75rem]"
			/>
		</div>
	)
}

function UnderRatingsC() {
	const p = useProto()
	const [open, setOpen] = useState(false)
	const last = useRef(0)
	useEffect(() => {
		const onOpen = () => setOpen((o) => !o)
		window.addEventListener("proto:inline-score", onOpen)
		return () => window.removeEventListener("proto:inline-score", onOpen)
	}, [])
	useEffect(() => {
		if (p.event?.kind === "seen-on" && p.event.at !== last.current) {
			last.current = p.event.at
			if (p.state.score == null) setOpen(true)
		}
		if (!p.state.seen && p.event === null) setOpen(false)
	}, [p.event, p.state.score, p.state.seen])
	if (!open) return null
	return (
		<div className="mt-4 rounded-xl bg-stone-900/90 p-3 ring-1 ring-white/10 md:ml-38 md:max-w-2xl">
			<div className="mb-2 flex items-center justify-between gap-3">
				<p className="flex items-center gap-2 text-sm font-bold text-white">
					{p.state.seen && <EyeIcon className="h-4 w-4 text-green-400" />}
					{p.state.seen && p.state.score == null ? "Seen. How was it?" : "Your score"}
				</p>
				<button type="button" onClick={() => setOpen(false)} className="cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white">
					{p.state.score == null ? "Skip for now" : "Done"}
				</button>
			</div>
			<ScoreControl
				size="compact"
				value={p.state.score}
				onRate={(s) => {
					p.rate(s)
					setOpen(false)
				}}
				onClear={p.state.score != null ? p.clearScore : undefined}
			/>
		</div>
	)
}

// D: the live layout. Only the flow changes: Seen on opens the live score dialog, and a score turns Seen on.
function RatingsD() {
	const p = useProto()
	return (
		<ScoreRect
			score={p.state.score}
			mediaType={p.media.mediaType}
			onClick={() => window.dispatchEvent(new Event("proto:open-score-d"))}
			className="max-md:w-full md:min-w-[10.75rem] md:shrink-0"
		/>
	)
}

function ActionsD() {
	const dialog = useOpenAfterSeen()
	const ref = useRef<HTMLButtonElement>(null)
	const { openPlain } = dialog
	useEffect(() => {
		window.addEventListener("proto:open-score-d", openPlain)
		return () => window.removeEventListener("proto:open-score-d", openPlain)
	}, [openPlain])
	return (
		<div className="flex min-w-0 gap-2">
			<WantButton className="flex-1" />
			<SeenButton className="flex-1" />
			<HideButton className="max-sm:w-9 max-sm:flex-none sm:flex-1" />
			<span ref={ref} />
			<ProtoScoreDialog open={dialog.open} afterSeen={dialog.afterSeen} onClose={dialog.close} opener={ref} />
		</div>
	)
}

const VARIANTS: Record<
	SeenScoreVariant,
	{ ratings?: () => React.ReactNode; underRatings?: () => React.ReactNode; actions: () => React.ReactNode; wideRatings?: boolean }
> = {
	A: { actions: ActionsA },
	B: { ratings: RatingsB, actions: OtherActions },
	C: { ratings: RatingsC, underRatings: UnderRatingsC, actions: OtherActions, wideRatings: true },
	D: { ratings: RatingsD, actions: ActionsD },
}
