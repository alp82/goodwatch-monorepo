// PROTOTYPE - throwaway. The title page (The Bear, from fixture-title.json) built from the real title page parts, with
// the Report a problem entry points of each variant around its data blocks:
// - A: a quiet "Report a problem" link under each block; it opens a bottom sheet about that block.
// - B: one "Something wrong?" button in the title header (and at the end of the page) that opens a full sheet with a
//   section picker. Trusted members also get an Edit pencil on each correctable block that edits in place.
// - C (the owner's pick): the global Feedback tab's "Fix something on this page" turns on fix mode. It marks every
//   block (correctable or flag only); a tap shows that block's questions in the docked Feedback panel, which leaves the
//   page usable, so the next field is one tap away.
// A live correction changes the page at once, with a quiet "Corrected by members" line and Undo.
import { CheckBadgeIcon, FlagIcon, PencilSquareIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import About from "~/ui/details/About"
import Actors from "~/ui/details/Actors"
import Crew from "~/ui/details/Crew"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { BelowFoldProvider } from "~/ui/details/below-fold"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ListActions from "~/ui/details/hero/ListActions"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import SeenScore from "~/ui/details/hero/SeenScore"
import { HeroBackdropImage, HeroPoster, TrailerButton } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import { navSections, sections } from "~/ui/details/sections"
import { MediaPreferenceProvider } from "~/ui/media-preference/MediaPreference"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import FeedbackHeader from "~/ui/prototype-feedback/Header"
import { AREAS, type Area, type Correction, TITLE_AREAS } from "~/ui/prototype-feedback/model"
import { ReportFlow } from "~/ui/prototype-feedback/ReportFlow"
import { Sheet } from "~/ui/prototype-feedback/Sheet"
import { useFeedback } from "~/ui/prototype-feedback/store"
import { unpackEpisodeGrid } from "~/utils/episode-grid-wire"
import type { EpisodeGridWire } from "~/utils/episode-grid-wire"
import { useScrollSections } from "~/utils/scroll"
import fixture from "~/ui/prototype-feedback/fixture-title.json"

const grid = unpackEpisodeGrid(fixture.episodeGrid as unknown as EpisodeGridWire)

export function useIsWide() {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const m = window.matchMedia("(min-width: 768px)")
		const on = () => setWide(m.matches)
		on()
		m.addEventListener("change", on)
		return () => m.removeEventListener("change", on)
	}, [])
	return wide
}

// --- Entry points and marks ---

export function ReportLink({ area, onOpen, label = "Report a problem" }: { area: Area; onOpen: (a: Area) => void; label?: string }) {
	return (
		<button
			type="button"
			onClick={() => onOpen(area)}
			aria-label={`Report a problem with ${AREAS[area].what}`}
			className="inline-flex min-h-6 cursor-pointer items-center gap-1 rounded text-xs text-gray-500 hover:text-gray-200"
		>
			<FlagIcon className="size-3.5" aria-hidden />
			{label}
		</button>
	)
}

/** "Corrected by members" with Undo for the member who made it, and the member's own pending fixes. */
export function Marks({ area }: { area: Area }) {
	const { corrections, undo } = useFeedback()
	const mine = corrections.filter((c) => c.area === area && !c.undone && c.outcome !== "flag")
	if (!mine.length) return null
	const last: Correction = mine[mine.length - 1]
	return last.outcome === "live" ? (
		<span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
			<CheckBadgeIcon className="size-3.5 shrink-0 text-emerald-400" aria-hidden />
			<span className="truncate">Corrected by members</span>
			<button type="button" onClick={() => undo(last.id)} className="cursor-pointer font-semibold text-gray-300 underline decoration-white/30 underline-offset-2 hover:text-white">
				Undo
			</button>
		</span>
	) : (
		<span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
			<span className="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
			<span className="truncate">Your fix is waiting for review</span>
		</span>
	)
}

/** One data block. Its meta line sits in the gap under it, so nothing below moves when a mark shows up. */
export function Block({ area, children, inline, metaClass = "right-0 left-0", overlayClass = "-inset-1.5 sm:-inset-2.5" }: { area: Area; children: ReactNode; inline?: boolean; metaClass?: string; overlayClass?: string }) {
	const { variant, viewer, fixMode, setOpen, open } = useFeedback()
	const flagOnly = AREAS[area].problems.every((p) => p.flag)
	const meta = (
		<div className={`flex items-center justify-end gap-4 ${inline ? "min-h-6" : `absolute top-full mt-1.5 min-h-6 ${metaClass}`}`}>
			<Marks area={area} />
			{variant === "A" && <ReportLink area={area} onOpen={setOpen} />}
			{variant === "B" && viewer === "trusted" && !flagOnly && <EditInPlace area={area} />}
		</div>
	)
	return (
		<div className="relative" data-block={area}>
			{children}
			{variant === "C" && (
				<button
					type="button"
					tabIndex={fixMode ? 0 : -1}
					aria-hidden={!fixMode}
					onClick={() => setOpen(area)}
					aria-label={`${flagOnly ? "Flag" : "Fix"} ${AREAS[area].what}`}
					className={`absolute ${overlayClass} z-20 cursor-pointer rounded-2xl border-2 border-dashed transition-opacity duration-200 ${fixMode ? "opacity-100" : "pointer-events-none opacity-0"} ${open === area ? "border-amber-400 bg-amber-400/[0.07]" : flagOnly ? "border-white/30 hover:bg-white/[0.04]" : "border-amber-500/70 hover:bg-amber-400/[0.05]"}`}
				>
					<span
						className={`absolute -top-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow-lg ${flagOnly ? "bg-gray-200 text-gray-950" : "bg-amber-400 text-gray-950"}`}
					>
						{flagOnly ? <FlagIcon className="size-3.5" /> : <PencilSquareIcon className="size-3.5" />}
						{flagOnly ? "Flag" : "Fix"} {AREAS[area].label.toLowerCase()}
					</span>
				</button>
			)}
			{meta}
		</div>
	)
}

/** B, trusted members: a pencil on the block that opens the editor right there, over the page (no layout shift). */
function EditInPlace({ area }: { area: Area }) {
	const wide = useIsWide()
	const [on, setOn] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!on || !wide) return
		const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOn(false)
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOn(false)
		document.addEventListener("pointerdown", away)
		document.addEventListener("keydown", esc)
		return () => {
			document.removeEventListener("pointerdown", away)
			document.removeEventListener("keydown", esc)
		}
	}, [on, wide])
	return (
		<div ref={ref} className="relative z-30">
			<button
				type="button"
				onClick={() => setOn((x) => !x)}
				aria-expanded={on}
				aria-label={`Edit ${AREAS[area].what}`}
				className={`inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 transition-colors ${on ? "bg-white text-black ring-white" : "bg-black/60 text-gray-200 ring-white/20 hover:ring-white/50"}`}
			>
				<PencilSquareIcon className="size-3.5" /> Edit
			</button>
			{wide ? (
				<div
					className={`absolute top-9 right-0 max-h-[min(36rem,calc(100dvh-9rem))] w-[26rem] origin-top-right overflow-y-auto overscroll-contain rounded-2xl bg-gray-950 px-4 pt-4 pb-4 shadow-2xl sm:px-5 ring-1 ring-white/15 transition-[transform,opacity] duration-150 ${on ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}
					data-feedback-private
				>
					{on && <ReportFlow key={area} area={area} layout="chips" onClose={() => setOn(false)} />}
				</div>
			) : (
				<Sheet open={on} onClose={() => setOn(false)} title={`Edit ${AREAS[area].what}`} placement="bottom">
					<ReportFlow key={area} area={area} layout="chips" onClose={() => setOn(false)} />
				</Sheet>
			)}
		</div>
	)
}

// --- Header controls per variant ---

export function HeaderExtra({ phone = false }: { phone?: boolean }) {
	const { variant, setOpen } = useFeedback()
	if (variant === "B")
		return (
			<button
				type="button"
				onClick={() => setOpen("pick")}
				className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-white/8 px-3 text-sm text-gray-200 ring-1 ring-white/15 hover:bg-white/15 ${phone ? "bg-black/60" : "max-sm:hidden"}`}
			>
				<FlagIcon className="size-4" aria-hidden />
				Something wrong?
			</button>
		)
	return null
}

/** The sheet A and B open: A at the bottom, B on the right. C's questions show in the Feedback panel (FeedbackDock). */
export function ReportSheet({ areas = TITLE_AREAS }: { areas?: Area[] }) {
	const { variant, open, setOpen } = useFeedback()
	const [picked, setPicked] = useState<Area | null>(null)
	useEffect(() => {
		if (open === "pick") setPicked(null)
	}, [open])
	const area = open === "pick" ? picked : open
	if (variant === "C") return null
	const placement = variant === "A" ? "bottom" : "right"
	const title = open === null ? "" : area ? AREAS[area].label : "Something wrong?"
	return (
		<Sheet open={open !== null} onClose={() => setOpen(null)} title={title} placement={placement}>
			{open !== null && (
				<ReportFlow
					key={`${open}-${area}`}
					area={area}
					areas={areas}
					layout={variant === "A" ? "steps" : "form"}
					onClose={() => setOpen(null)}
					onPickArea={setPicked}
				/>
			)}
		</Sheet>
	)
}

// --- The page ---

export default function TitlePage() {
	const { media } = useFeedback()
	return (
		<BelowFoldProvider titleKey={`show-${media.details.tmdb_id}`}>
			<MediaPreferenceProvider country="US">
				<Page />
			</MediaPreferenceProvider>
		</BelowFoldProvider>
	)
}

function Page() {
	const { media, variant, setOpen, fixMode } = useFeedback()
	const { activeSections, sectionProps, navigateToSection } = useScrollSections({ sections })
	const listed = navSections(true, false)
	const backdrop = `https://image.tmdb.org/t/p/w300${media.details.backdrop_path}`
	return (
		<div className={`relative ${variant === "C" && fixMode ? "pb-40" : ""}`}>
			<div
				className="pointer-events-none absolute top-0 z-0 h-full w-full"
				aria-hidden="true"
				style={{ backgroundImage: `url(${backdrop})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(64px) brightness(0.17)" }}
			/>
			<Breadcrumbs items={[...fixture.breadcrumb, { label: media.details.title, path: "/show/136315-the-bear" }]} className="relative" />
			<FeedbackHeader
				media={media}
				country="US"
				activeSections={activeSections}
				navigateToSection={navigateToSection}
				sections={listed}
				extra={<HeaderExtra />}
			/>
			<DetailsSideNav activeSections={activeSections} navigateToSection={navigateToSection} sections={listed} />

			{/* The hero, as details/hero/DetailsHero.tsx, with scores and where to watch as blocks. */}
			<div className="relative mx-auto mt-4 mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
				<div {...sectionProps.overview}>
					<section data-title-overview className="relative isolate z-30 min-w-0 rounded-2xl border border-white/10 bg-stone-950">
						<div className="relative">
							<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-t-2xl" aria-hidden="true">
								<HeroBackdropImage media={media} className="h-full w-full object-cover object-[center_22%]" />
								<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
								<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
							</div>
							<TrailerButton media={media} className="absolute top-3 right-3 md:top-4 md:right-5" />
							{variant === "B" && (
								<div className="absolute top-3 left-3 sm:hidden">
									<HeaderExtra phone />
								</div>
							)}
							<div className="flex flex-col gap-4 px-4 pt-14 pb-4 md:flex-row md:items-end md:justify-between md:px-6 md:pt-28 md:pb-5">
								<div className="flex min-w-0 items-end gap-3 md:gap-6">
									<HeroPoster media={media} className="w-[4.5rem] md:w-32" />
									<Block area="scores" inline>
										<div data-hero-ratings className="flex min-w-0 flex-col gap-2.5">
											<div className="md:hidden">
												<ScoreRing media={media} size={48} />
											</div>
											<div className="hidden md:block">
												<ScoreRing media={media} size={56} />
											</div>
											<div data-hero-sites className="flex min-w-0 flex-wrap items-center gap-3 empty:hidden">
												<RatingChips media={media} fill={false} />
												<EpisodeGridLink grid={grid} />
											</div>
										</div>
									</Block>
								</div>
								<div className="flex flex-col gap-2 max-md:w-full md:w-[22rem] md:shrink-0">
									<SeenScore media={media} className="w-full" />
									<ListActions media={media} />
								</div>
							</div>
						</div>
						<div className="mx-3 border-t border-white/10 pt-4 pb-2 md:mx-6 md:pt-5 md:pb-3">
							<Block area="watch" inline>
								<WhereToWatch media={media} country="US" />
							</Block>
						</div>
					</section>
				</div>
			</div>

			<div className="isolate">
				<div className="relative mx-auto max-w-7xl">
					<Block area="analysis" metaClass="right-4 left-4 sm:right-6 sm:left-6 lg:right-8 lg:left-8" overlayClass="inset-y-0 inset-x-1 sm:inset-x-3 lg:inset-x-5">
						<DetailsFingerprint media={media} sectionProps={sectionProps.fingerprint} />
					</Block>
				</div>
			</div>

			<div className="isolate flex flex-col items-center">
				<div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex flex-col gap-14 pt-12">
						<div {...sectionProps.episodes}>
							<Block area="episodes">
								<EpisodeGrid grid={grid} />
							</Block>
						</div>
						<div {...sectionProps.about}>
							<Block area="details">
								<About media={media} navigateToSection={navigateToSection} />
							</Block>
						</div>
						<div {...sectionProps.actors_and_crew}>
							<Block area="cast">
								<div className="flex flex-col gap-10 overflow-x-clip">
									<Actors cast={media.cast} total={media.cast_total} mediaType="show" tmdbId={media.details.tmdb_id} />
									<Crew crew={media.crew} />
								</div>
							</Block>
						</div>
						{variant === "B" && (
							<div className="mt-4 flex flex-col items-center gap-3 rounded-2xl bg-white/[0.04] p-5 text-center ring-1 ring-white/10 sm:flex-row sm:justify-between sm:text-left">
								<p className="text-gray-300">Something wrong or missing on this page?</p>
								<button
									type="button"
									onClick={() => setOpen("pick")}
									className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 font-semibold text-gray-100 hover:bg-white/10"
								>
									<FlagIcon className="size-4" /> Tell us
								</button>
							</div>
						)}
						<div className="h-24" />
					</div>
				</div>
			</div>
			<ReportSheet />
		</div>
	)
}
