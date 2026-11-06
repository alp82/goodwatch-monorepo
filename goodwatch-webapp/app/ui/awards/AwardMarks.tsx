// A title's award mark where titles are listed: on a poster card beside the year in the title band ("Oscar" on a
// small card, "Oscar winner" from 11rem), on a best-of row under its meta line ("Oscar winner"), and in the quick view
// as the title's most notable reported results. Cards and rows show wins only; a title without a win shows nothing,
// and the quick view shows nothing for a title without rows. Never a count, never a person. Rules:
// domain/award-marks.ts.
import { TrophyIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import {
	type AwardMediaType,
	type NotableAward,
	winnerLabel,
} from "~/domain/award-marks"

/** Heroicons' 20 px solid trophy, the path `TrophyIcon` draws. */
const TROPHY =
	"M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 0 0-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 0 0-.552.698 5 5 0 0 0 4.503 5.152 6 6 0 0 0 2.946 1.822A6.451 6.451 0 0 1 7.768 13H7.5A1.5 1.5 0 0 0 6 14.5V17h-.75C4.56 17 4 17.56 4 18.25c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75c0-.69-.56-1.25-1.25-1.25H14v-2.5a1.5 1.5 0 0 0-1.5-1.5h-.268a6.453 6.453 0 0 1-.684-2.202 6 6 0 0 0 2.946-1.822 5 5 0 0 0 4.503-5.152.75.75 0 0 0-.552-.698A31.804 31.804 0 0 0 16 2.562v-.387a.75.75 0 0 0-.629-.74A33.227 33.227 0 0 0 10 1ZM2.525 4.422C3.012 4.3 3.504 4.19 4 4.09V5c0 .74.134 1.448.38 2.103a3.503 3.503 0 0 1-1.855-2.68Zm14.95 0a3.503 3.503 0 0 1-1.854 2.68C15.866 6.449 16 5.74 16 5v-.91c.496.099.988.21 1.475.332Z"

/** Opacity only: a mark that arrives after the card fades in. */
const FADE = "motion-safe:animate-fade-in"

/** Beside the year in a poster card's title band. */
export function BandAward({ mark }: { mark: string }) {
	return (
		<span
			className={`ml-auto inline-flex min-w-0 items-center gap-0.5 text-[0.625rem] font-semibold text-amber-200/90 @min-[7.5rem]/card:text-xs ${FADE}`}
		>
			<TrophyIcon
				className="size-2.5 shrink-0 text-amber-400 @min-[7.5rem]/card:size-3"
				aria-hidden
			/>
			<span className="truncate">
				{mark}
				<span className="hidden @min-[11rem]/card:inline"> winner</span>
			</span>
		</span>
	)
}

/**
 * The trophy once per list, as a symbol that every row's mark uses: a 250-row best-of page would otherwise carry the
 * icon's path in its HTML once per winner (about 1 KB each).
 */
export function RowAwardSymbol({ id }: { id: string }) {
	return (
		<svg aria-hidden="true" className="absolute size-0 overflow-hidden">
			<symbol id={id} viewBox="0 0 20 20">
				<path fillRule="evenodd" clipRule="evenodd" d={TROPHY} />
			</symbol>
		</svg>
	)
}

/** A best-of row's line under the year and kind; `icon` is the list's `RowAwardSymbol` id. */
export function RowAward({
	mark,
	icon,
}: { mark: string | undefined; icon: string }) {
	if (!mark) return null
	return (
		<span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-amber-200/85">
			<svg
				aria-hidden="true"
				className="size-3 shrink-0 fill-current text-amber-400"
			>
				<use href={`#${icon}`} />
			</svg>
			<span className="truncate">{winnerLabel(mark)}</span>
		</span>
	)
}

async function fetchAwards(
	mediaType: AwardMediaType,
	tmdbId: number,
): Promise<NotableAward[]> {
	const response = await fetch(
		`/api/title-awards?type=${mediaType}&id=${tmdbId}`,
	)
	if (!response.ok) throw new Error(`HTTP ${response.status}`)
	return ((await response.json()) as { results: NotableAward[] }).results
}

/** The quick view's section: the title's most notable reported results, loaded when the view shows the title. */
export function QuickViewAwards({
	mediaType,
	tmdbId,
}: { mediaType: AwardMediaType; tmdbId: number }) {
	const { data: results } = useQuery({
		queryKey: ["title-awards", mediaType, tmdbId],
		queryFn: () => fetchAwards(mediaType, tmdbId),
		staleTime: 60 * 60 * 1000,
	})
	if (!results?.length) return null
	const won = results.some((r) => r.won)
	return (
		<section className={`py-3 ${FADE}`} aria-label="Awards">
			<p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-gray-500 uppercase">
				{won ? "Award wins" : "Award nominations"}
			</p>
			<ul className="space-y-1">
				{results.map((r) => (
					<li
						key={`${r.award}|${r.category}|${r.year}`}
						className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5"
					>
						<TrophyIcon
							className={`size-3 shrink-0 translate-y-0.5 ${r.won ? "text-amber-400" : "text-gray-600"}`}
							aria-hidden
						/>
						<span className="shrink-0 font-semibold text-gray-200">
							{r.award}
						</span>
						<span className="min-w-0 truncate text-gray-400">
							{r.category}, {r.year}
						</span>
						<span
							className={`ml-auto shrink-0 text-xs ${r.won ? "text-amber-300/90" : "text-gray-500"}`}
						>
							{r.won ? "won" : "nominated"}
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}
