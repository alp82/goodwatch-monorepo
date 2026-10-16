import { Link } from "@remix-run/react"
import {
	useIsNotInterested,
	useIsSkipped,
	useUserScore,
	useWatchState,
} from "~/hooks/useUserDataAccessors"
import type { TitleSides } from "~/server/title-sides.server"
import { TmdbImage } from "~/ui/TmdbImage"
import { TITLE_SIDES_COPY as COPY } from "~/ui/details/hero/title-sides-copy"
import { titleToDashed } from "~/utils/helpers"

interface TitleSidesLineProps {
	sides: TitleSides
	mediaType: "movie" | "show"
	tmdbId: number
}

// Taste groups in the overview card (#672): one row between the banner and the actions. A small stack of the loved
// titles closest to this one, the group's name, a badge for how the title fits the member's taste, and Watch next
// with the group's moods. The server decides it (title-sides.server.ts) and renders it with the page, so the card doesn't move.
// Rating, watching, or dismissing the title on the page takes the line away: it is no longer a recommendation.
export default function TitleSidesLine({
	sides,
	mediaType,
	tmdbId,
}: TitleSidesLineProps) {
	const score = useUserScore(mediaType, tmdbId)
	const watchState = useWatchState(mediaType, tmdbId)
	const notInterested = useIsNotInterested(mediaType, tmdbId)
	const skipped = useIsSkipped(mediaType, tmdbId)
	if (score || watchState || notInterested || skipped) return null

	const { side, other } = sides
	const between = sides.edge === "between" && other
	const sentence =
		sides.at === "on"
			? COPY.on(side.name)
			: between
				? COPY.between(side.name, other.name)
				: COPY.edge(side.name, sides.edgeTail)
	const stack = [...side.near, ...(other?.near ?? [])]
	const edge = sides.at === "edge"
	return (
		<section
			aria-label={COPY.label}
			className="mx-3 mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white/[0.05] p-3 ring-1 ring-white/10 md:mx-5 md:mt-4"
		>
			<div
				className={`flex shrink-0 -space-x-4 rounded-lg border-2 p-1 ${edge ? "border-dashed border-sky-400/60" : "border-amber-500/60"}`}
			>
				{stack.map((t) => (
					<Link
						key={`${t.mediaType}-${t.tmdbId}`}
						to={`/${t.mediaType}/${t.tmdbId}-${titleToDashed(t.title)}`}
						prefetch="intent"
						title={t.title}
						className="relative block w-9 shrink-0 overflow-hidden rounded-md bg-gray-900 ring-2 ring-stone-950 md:w-10"
					>
						<TmdbImage
							kind="poster"
							path={t.poster}
							width={40}
							alt={COPY.poster(t.title)}
							className="block aspect-[2/3] w-full object-cover"
							draggable={false}
						/>
					</Link>
				))}
			</div>
			<div className="min-w-0 flex-1">
				{sentence && (
					<p className="font-bold leading-snug text-white md:text-lg">
						{sentence}
					</p>
				)}
				{/* The title page's badge, as About's essence tags (ui/fingerprint/Badges). */}
				<span
					className={`inline-block rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs font-medium text-gray-300 ${sentence ? "mt-1.5" : ""}`}
				>
					{edge ? COPY.close : COPY.fits}
				</span>
			</div>
			<Link
				to={
					side.moods.length
						? `/watch-next?moods=${side.moods.join(",")}`
						: "/watch-next"
				}
				className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 max-sm:w-full max-sm:justify-center"
			>
				{COPY.watchNext}
				<span aria-hidden>→</span>
			</Link>
		</section>
	)
}
